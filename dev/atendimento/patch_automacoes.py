# Patch sobre equipe/atendimento.html: aba "Automações" (motor de regras "quando X, faça Y") — 02/11/2026
# Regras na coleção "automacoes"; registro de disparos em "automacoes_log". Ações só dentro do sistema: tarefa, histórico, situação.
import sys, os
P = sys.argv[1]
s = open(P, encoding='utf-8').read()
MOD = open(os.path.join(os.path.dirname(os.path.abspath(P)), 'js', 'automacoes.js'), encoding='utf-8').read()
def troca(s, a, b):
    assert s.count(a) == 1, ('âncora não única ou ausente', a[:80], s.count(a))
    return s.replace(a, b)
TAB = '<button role="tab" aria-selected="false" data-view="auto" id="tab-auto">Automações</button>\n    '
SEC = r'''<!-- AUTOMAÇÕES -->
  <section id="v-auto" hidden>
    <h2 class="sec">Automações</h2>
    <p class="sub">Regras do tipo “quando acontecer X, faça Y”, configuradas pela Direção. Elas só agem dentro do sistema (criam tarefa, anotam no histórico, mudam a situação do caso): nada é enviado ao cliente. Cada regra age uma única vez por caso ou publicação.</p>
    <div class="panel" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">Regras</h3><button class="btn small" type="button" id="au-nova">Nova regra</button></div><div id="au-lista" style="margin-top:8px"></div><div class="hint" id="au-msg" role="status"></div></div>
    <div class="panel" id="au-ed" hidden style="margin-bottom:12px"></div>
    <div class="panel" style="margin-bottom:12px"><h3>Modelos prontos</h3><p class="hint" style="margin:4px 0 8px">Entram desligados: revise, ajuste e ligue.</p><div id="au-modelos"></div></div>
    <div class="panel"><h3>Registro</h3><p class="hint" style="margin:4px 0 8px">O que as automações fizeram (últimos 40).</p><div id="au-log"></div></div>
  </section>

  '''
JS = r'''
// ---------- automações: motor de regras (02/11/2026) ----------
let autoDb=null, autoLogDb=null, auEd=null, auRodando=false, auTimer=null; const AUDB={};
const auId=s=>String(s).replace(/[^A-Za-z0-9_\-]/g,"").slice(0,150);
function autoRegras(){ const m=new Map(); Object.values(st.automacoes||{}).forEach(r=>m.set(r.id,r)); (autoDb||[]).forEach(r=>m.set(r.id,r)); const ex=new Set(st.autoExcluidas||[]); return [...m.values()].filter(r=>!ex.has(r.id)).sort((a,b)=>(a.criadaEm||"").localeCompare(b.criadaEm||"")) }
function autoLog(){ const m=new Map(); Object.values(st.autoLog||{}).forEach(x=>m.set(x.chave,x)); (autoLogDb||[]).forEach(x=>m.set(x.chave,x)); return [...m.values()] }
function salvarRegra(r){ st.automacoes=Object.assign({},st.automacoes,{[r.id]:r}); salvarLocal(); if(DBA){ AUDB[r.id]=(AUDB[r.id]||Promise.resolve()).then(()=>DBA.doc("automacoes/"+r.id).set(r)).catch(()=>{}) } }
function excluirRegra(id){ if(st.automacoes) delete st.automacoes[id]; st.autoExcluidas=(st.autoExcluidas||[]).concat([id]); salvarLocal(); if(DBA) DBA.doc("automacoes/"+id).delete().catch(()=>{}); if(autoDb) autoDb=autoDb.filter(r=>r.id!==id) }
function auDados(){ return { casos:st.convs.filter(c=>c.ficha&&!EX_IDS.has(c.id)).map(c=>({c,f:c.ficha})), publicacoes:pubsTodas() } }
function rodarAutomacoes(){ if(auRodando) return 0; const R=autoRegras().filter(r=>r.ativa); if(!R.length) return 0; auRodando=true; let n=0;
  try{ const hoje=hojeISO(), ja=new Set(autoLog().map(x=>x.chave)), plano=Automacoes.planejar(R,auDados(),hoje,ja), existe=new Set(tarefasTodas().map(t=>t.id)); let mudou=false;
    plano.forEach(p=>{ const r=p.regra, caso=r.alvo==="caso"?p.alvo:null, pub=caso?null:p.alvo, conv=caso?caso.c:(pub.fichaId?st.convs.find(x=>x.id===pub.fichaId):null), feitas=[];
      p.acoes.forEach(a=>{
        if(a.tipo==="tarefa"){ if(existe.has(a.id)) return; const resp=a.resp==="setor"?respDaRota(conv&&conv.ficha?conv.ficha.rota:"processo"):a.resp, prazo=+a.prazoUteis>0?Tarefas.somaUteis(hoje,+a.prazoUteis):hoje;
          novaTarefa({id:a.id,titulo:a.titulo,resp,prazo,cliente:conv?(conv.nome+(conv.ficha?" · "+conv.ficha.proto:"")):((pub&&pub.cliente)||"")+(pub&&pub.cnj?" · "+pub.cnj:""),origem:"automacao",leadId:conv?conv.id:"",area:conv&&conv.ficha?conv.ficha.area||"":""}); existe.add(a.id); feitas.push("tarefa para "+resp+": "+a.titulo) }
        if(a.tipo==="historico"&&conv&&conv.ficha){ conv.ficha.log.push("[Automação “"+r.nome+"”] "+a.texto); mudou=true; feitas.push("histórico") }
        if(a.tipo==="status"&&conv&&conv.ficha&&conv.ficha.status!==a.valor){ conv.ficha.log.push("[Automação “"+r.nome+"”] situação: "+conv.ficha.status+" → "+a.valor); conv.ficha.status=a.valor; mudou=true; feitas.push("situação → "+a.valor) } });
      const e={chave:p.chave,regra:r.id,regraNome:r.nome,alvo:r.alvo,alvoId:p.alvoId,rotulo:caso?(caso.c.nome+" · "+caso.f.proto):((pub.cnj||pub.tipoNome||"publicação")),acoes:feitas,em:new Date().toISOString()};
      st.autoLog=Object.assign({},st.autoLog,{[auId(p.chave)]:e}); if(DBA) DBA.doc("automacoes_log/"+auId(p.chave)).set(e).catch(()=>{}); n++ });
    if(n){ salvarLocal(); if(mudou) salvar(); } }
  finally{ auRodando=false }
  if(n){ try{ renderMesa(); renderFila&&renderFila(); }catch(e){} if(!document.getElementById("v-auto").hidden) renderAuto() } return n }
function agendarAutomacoes(){ clearTimeout(auTimer); auTimer=setTimeout(rodarAutomacoes,700) }
{ const _s=salvar; salvar=function(){ _s.apply(this,arguments); if(!auRodando) agendarAutomacoes() } }
setInterval(rodarAutomacoes,30*60000);
// tela
function auSimular(r){ try{ return Automacoes.planejar([Object.assign({},r,{ativa:true})],auDados(),hojeISO(),new Set(autoLog().map(x=>x.chave))).length }catch(e){ return 0 } }
function renderAuto(){ const R=autoRegras(), L=autoLog(), cont={}; L.forEach(x=>{ cont[x.regra]=(cont[x.regra]||0)+1 });
  document.getElementById("au-lista").innerHTML=R.length?'<div style="overflow-x:auto"><table class="doc-tab"><thead><tr><th>Ligada</th><th>Regra</th><th>Disparos</th><th></th></tr></thead><tbody>'+R.map(r=>'<tr><td><input type="checkbox" data-au-on="'+esc(r.id)+'"'+(r.ativa?" checked":"")+' aria-label="Ligar '+esc(r.nome)+'"></td><td><b>'+esc(r.nome)+'</b><div class="hint">'+esc(Automacoes.descrever(r))+'</div>'+(r.existentes?'':'<div class="hint">Vale para '+(r.alvo==="caso"?"casos":"publicações")+' novos'+(r.desde?' (desde '+esc(r.desde.slice(0,10).split("-").reverse().join("/"))+')':' (a partir de quando for ligada)')+'.</div>')+'</td><td>'+(cont[r.id]||0)+'</td><td style="white-space:nowrap"><button class="btn ghost small" type="button" data-au-ed="'+esc(r.id)+'">Editar</button> <button class="btn ghost small" type="button" data-au-del="'+esc(r.id)+'">Excluir</button></td></tr>').join("")+'</tbody></table></div>':'<div class="hint">Nenhuma regra ainda. Comece por um modelo pronto ou crie uma nova.</div>';
  const ids=new Set(R.map(r=>r.modelo||r.id));
  document.getElementById("au-modelos").innerHTML=Automacoes.MODELOS.map(m=>'<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line)"><div><b>'+esc(m.nome)+'</b><div class="hint">'+esc(Automacoes.descrever(m))+'</div></div>'+(ids.has(m.id)?'<span class="pill ok">adicionado</span>':'<button class="btn ghost small" type="button" data-au-mod="'+esc(m.id)+'">Adicionar</button>')+'</div>').join("");
  const br=s=>new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  document.getElementById("au-log").innerHTML=L.length?'<ul style="margin:0;padding-left:18px">'+L.sort((a,b)=>b.em.localeCompare(a.em)).slice(0,40).map(x=>'<li class="hint">'+br(x.em)+' · <b>'+esc(x.regraNome)+'</b> · '+esc(x.rotulo)+(x.acoes&&x.acoes.length?' → '+esc(x.acoes.join("; ")):' (nada novo: a tarefa já existia)')+'</li>').join("")+'</ul>':'<div class="hint">Nada executado ainda.</div>' }
function auMsg(t){ document.getElementById("au-msg").textContent=t||"" }
function auValorHtml(alvo,c,i){ const k=(Automacoes.CAMPOS[alvo]||[]).find(x=>x.id===c.campo)||Automacoes.CAMPOS[alvo][0];
  if(k.tipo==="lista") return '<select data-auc-val="'+i+'" aria-label="Valor">'+k.opcoes.map(o=>'<option value="'+esc(o)+'"'+(o===c.valor?" selected":"")+'>'+esc(k.rotulos?k.rotulos[o]:o)+'</option>').join("")+'</select>';
  if(k.tipo==="sn") return '<select data-auc-val="'+i+'" aria-label="Valor">'+["sim","não"].map(o=>'<option'+(o===c.valor?" selected":"")+'>'+o+'</option>').join("")+'</select>';
  return '<input data-auc-val="'+i+'" value="'+esc(c.valor||"")+'" aria-label="Valor"'+(k.tipo==="dias"?' type="number" min="0" style="width:90px"':'')+'>' }
function renderEditor(){ const el=document.getElementById("au-ed"); if(!auEd){ el.hidden=true; el.innerHTML=""; return } const r=auEd, C=Automacoes.CAMPOS[r.alvo];
  el.hidden=false;
  el.innerHTML='<h3>'+(r.__nova?'Nova regra':'Editar regra')+'</h3><div style="display:grid;gap:8px;margin-top:6px">'+
    '<label class="hint">Nome<input id="au-nome" value="'+esc(r.nome||"")+'"></label>'+
    '<label class="hint">Vale para<select id="au-alvo"><option value="caso"'+(r.alvo==="caso"?" selected":"")+'>Casos (fichas do atendimento)</option><option value="publicacao"'+(r.alvo==="publicacao"?" selected":"")+'>Publicações</option></select></label>'+
    '<div class="hint" style="font-weight:600">Quando (todas as condições)</div>'+(r.condicoes||[]).map((c,i)=>{ const k=C.find(x=>x.id===c.campo)||C[0];
      return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select data-auc-campo="'+i+'" aria-label="Campo">'+C.map(x=>'<option value="'+x.id+'"'+(x.id===k.id?" selected":"")+'>'+esc(x.nome)+'</option>').join("")+'</select><select data-auc-op="'+i+'" aria-label="Comparação">'+Automacoes.OPS[k.tipo].map(o=>'<option value="'+o[0]+'"'+(o[0]===c.op?" selected":"")+'>'+o[1]+'</option>').join("")+'</select>'+auValorHtml(r.alvo,c,i)+'<button class="btn ghost small" type="button" data-auc-rm="'+i+'" aria-label="Remover condição">×</button></div>' }).join("")+
    '<div><button class="btn ghost small" type="button" id="au-c-add">+ condição</button></div>'+
    '<div class="hint" style="font-weight:600">Então</div>'+(r.acoes||[]).map((a,i)=>'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select data-aua-tipo="'+i+'" aria-label="Ação">'+Automacoes.ACOES.filter(x=>r.alvo==="caso"||x[0]!=="status").map(x=>'<option value="'+x[0]+'"'+(x[0]===a.tipo?" selected":"")+'>'+x[1]+'</option>').join("")+'</select>'+
      (a.tipo==="tarefa"?'<input data-aua-titulo="'+i+'" value="'+esc(a.titulo||"")+'" placeholder="Título (pode usar {cliente}, {protocolo}, {processo}, {tipo}, {vencimento})" style="flex:1;min-width:220px"><select data-aua-resp="'+i+'" aria-label="Responsável"><option value="setor"'+(a.resp==="setor"?" selected":"")+'>Responsável do setor</option>'+Tarefas.EQUIPE.map(e=>'<option'+(e.nome===a.resp?" selected":"")+'>'+e.nome+'</option>').join("")+'</select><label class="hint">prazo (dias úteis) <input data-aua-prazo="'+i+'" type="number" min="0" value="'+esc(a.prazoUteis==null?1:a.prazoUteis)+'" style="width:70px"></label>'
      :a.tipo==="historico"?'<input data-aua-texto="'+i+'" value="'+esc(a.texto||"")+'" placeholder="Texto para o histórico" style="flex:1;min-width:220px">'
      :'<select data-aua-valor="'+i+'" aria-label="Nova situação">'+Automacoes.STATUS.map(x=>'<option'+(x===a.valor?" selected":"")+'>'+x+'</option>').join("")+'</select>')+'<button class="btn ghost small" type="button" data-aua-rm="'+i+'" aria-label="Remover ação">×</button></div>').join("")+
    '<div><button class="btn ghost small" type="button" id="au-a-add">+ ação</button></div>'+
    '<label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="au-exist"'+(r.existentes?" checked":"")+'> Aplicar também aos '+(r.alvo==="caso"?"casos":"publicações")+' que já existem</label>'+
    '<div class="hint" id="au-sim"></div><div class="falta" id="au-err" hidden></div>'+
    '<div style="display:flex;gap:6px"><button class="btn small" type="button" id="au-salva">Salvar regra</button><button class="btn ghost small" type="button" id="au-cancela">Cancelar</button></div></div>';
  auAtualizaSim() }
function auLeEditor(){ const r=auEd, g=id=>document.getElementById(id); r.nome=g("au-nome").value.trim(); r.existentes=g("au-exist").checked;
  document.querySelectorAll("#au-ed [data-auc-val]").forEach(x=>{ r.condicoes[+x.dataset.aucVal].valor=x.value });
  document.querySelectorAll("#au-ed [data-aua-titulo]").forEach(x=>{ r.acoes[+x.dataset.auaTitulo].titulo=x.value });
  document.querySelectorAll("#au-ed [data-aua-resp]").forEach(x=>{ r.acoes[+x.dataset.auaResp].resp=x.value });
  document.querySelectorAll("#au-ed [data-aua-prazo]").forEach(x=>{ r.acoes[+x.dataset.auaPrazo].prazoUteis=+x.value||0 });
  document.querySelectorAll("#au-ed [data-aua-texto]").forEach(x=>{ r.acoes[+x.dataset.auaTexto].texto=x.value });
  document.querySelectorAll("#au-ed [data-aua-valor]").forEach(x=>{ r.acoes[+x.dataset.auaValor].valor=x.value }); return r }
function auAtualizaSim(){ const el=document.getElementById("au-sim"); if(!el||!auEd) return; const r=Object.assign({},auEd); if(Automacoes.validar(r).length){ el.textContent=""; return }
  const n=auSimular(Object.assign({},r,{desde:r.existentes?"":new Date().toISOString()}));
  el.textContent=r.existentes?"Se ligada agora, esta regra atinge "+n+" "+(r.alvo==="caso"?"caso(s)":"publicação(ões)")+" que já existe(m).":"Se ligada agora, vale só para o que chegar daqui em diante." }
function auNovaCond(alvo){ const k=Automacoes.CAMPOS[alvo][0]; return {campo:k.id,op:Automacoes.OPS[k.tipo][0][0],valor:k.opcoes?k.opcoes[0]:""} }
document.getElementById("au-nova").addEventListener("click",()=>{ auEd={__nova:true,id:"r"+Date.now(),nome:"",alvo:"caso",ativa:false,condicoes:[auNovaCond("caso")],acoes:[{tipo:"tarefa",titulo:"",resp:"setor",prazoUteis:1}],existentes:false}; renderEditor(); document.getElementById("au-ed").scrollIntoView({block:"nearest"}) });
document.getElementById("au-ed").addEventListener("change",e=>{ if(!auEd) return; const t=e.target; auLeEditor();
  if(t.id==="au-alvo"){ auEd.alvo=t.value; auEd.condicoes=[auNovaCond(t.value)]; auEd.acoes=auEd.acoes.filter(a=>t.value==="caso"||a.tipo!=="status"); if(!auEd.acoes.length) auEd.acoes=[{tipo:"tarefa",titulo:"",resp:"setor",prazoUteis:1}]; renderEditor(); return }
  if(t.dataset.aucCampo!=null){ const i=+t.dataset.aucCampo, k=Automacoes.CAMPOS[auEd.alvo].find(x=>x.id===t.value); auEd.condicoes[i]={campo:k.id,op:Automacoes.OPS[k.tipo][0][0],valor:k.opcoes?k.opcoes[0]:k.tipo==="sn"?"sim":""}; renderEditor(); return }
  if(t.dataset.aucOp!=null){ auEd.condicoes[+t.dataset.aucOp].op=t.value }
  if(t.dataset.auaTipo!=null){ const i=+t.dataset.auaTipo; auEd.acoes[i]=t.value==="tarefa"?{tipo:"tarefa",titulo:"",resp:"setor",prazoUteis:1}:t.value==="historico"?{tipo:"historico",texto:""}:{tipo:"status",valor:"Em andamento"}; renderEditor(); return }
  auAtualizaSim() });
document.getElementById("au-ed").addEventListener("input",()=>{ if(auEd){ auLeEditor(); auAtualizaSim() } });
document.getElementById("au-ed").addEventListener("click",e=>{ if(!auEd) return; const t=e.target; auLeEditor();
  if(t.id==="au-c-add"){ auEd.condicoes.push(auNovaCond(auEd.alvo)); renderEditor() }
  else if(t.dataset.aucRm!=null){ auEd.condicoes.splice(+t.dataset.aucRm,1); renderEditor() }
  else if(t.id==="au-a-add"){ auEd.acoes.push({tipo:"tarefa",titulo:"",resp:"setor",prazoUteis:1}); renderEditor() }
  else if(t.dataset.auaRm!=null){ auEd.acoes.splice(+t.dataset.auaRm,1); renderEditor() }
  else if(t.id==="au-cancela"){ auEd=null; renderEditor() }
  else if(t.id==="au-salva"){ const r=auEd, er=Automacoes.validar(r), box=document.getElementById("au-err"); if(er.length){ box.hidden=false; box.innerHTML=er.map(esc).join("<br>"); return }
    const ant=autoRegras().find(x=>x.id===r.id)||{}, agora=new Date().toISOString(), nova=Object.assign({},ant,r,{atualizadaEm:agora,atualizadaPor:quemSou()});
    delete nova.__nova; if(!nova.criadaEm){ nova.criadaEm=agora; nova.criadaPor=quemSou() } if(nova.ativa&&!nova.existentes&&!nova.desde) nova.desde=agora;
    salvarRegra(nova); auEd=null; renderEditor(); renderAuto(); auMsg("Regra “"+nova.nome+"” salva"+(nova.ativa?" e ligada.":". Ligue-a na lista quando quiser.")); if(nova.ativa) rodarAutomacoes() } });
document.getElementById("v-auto").addEventListener("click",e=>{ const t=e.target;
  if(t.dataset.auMod!=null){ const m=Automacoes.MODELOS.find(x=>x.id===t.dataset.auMod); if(!m) return; const agora=new Date().toISOString();
    salvarRegra(Object.assign(JSON.parse(JSON.stringify(m)),{id:"m-"+m.id,modelo:m.id,ativa:false,existentes:false,criadaEm:agora,criadaPor:quemSou()})); renderAuto(); auMsg("Modelo adicionado desligado. Revise e ligue na lista."); }
  if(t.dataset.auEd!=null){ const r=autoRegras().find(x=>x.id===t.dataset.auEd); if(r){ auEd=JSON.parse(JSON.stringify(r)); renderEditor(); document.getElementById("au-ed").scrollIntoView({block:"nearest"}) } }
  if(t.dataset.auDel!=null){ const id=t.dataset.auDel; if(t.dataset.conf!=="1"){ t.dataset.conf="1"; t.textContent="Confirmar exclusão"; return } excluirRegra(id); renderAuto(); auMsg("Regra excluída. As tarefas que ela já criou continuam na lista.") } });
document.getElementById("v-auto").addEventListener("change",e=>{ const t=e.target; if(t.dataset.auOn==null) return; const r=autoRegras().find(x=>x.id===t.dataset.auOn); if(!r) return;
  const agora=new Date().toISOString(), nova=Object.assign({},r,{ativa:t.checked,atualizadaEm:agora,atualizadaPor:quemSou()}); if(t.checked&&!nova.existentes&&!nova.desde) nova.desde=agora;
  salvarRegra(nova); const n=t.checked?rodarAutomacoes():0; renderAuto(); auMsg(t.checked?"Regra ligada"+(n?": agiu em "+n+" item(ns) agora.":"."):"Regra desligada.") });
window.__auto={salvar:()=>salvar(),hoje:()=>hojeISO(),rodar:()=>rodarAutomacoes(),regras:()=>autoRegras(),log:()=>autoLog(),render:()=>renderAuto()};
'''
s = troca(s, '<button role="tab" aria-selected="false" data-view="regras" id="tab-regras">', TAB + '<button role="tab" aria-selected="false" data-view="regras" id="tab-regras">')
s = troca(s, '<!-- REGRAS -->\n  <section id="v-regras" hidden>', SEC + '<!-- REGRAS -->\n  <section id="v-regras" hidden>')
s = troca(s, 'regras:()=>renderRegras()};', 'regras:()=>renderRegras(),auto:()=>renderAuto()};')
s = troca(s, "  try{ db.collection('rotinas').limit(50).onSnapshot(",
  "  try{ db.collection('automacoes').limit(200).onSnapshot(sn=>{ autoDb=sn.docs.map(d=>d.data()).filter(x=>x&&x.id); if(typeof agendarAutomacoes==='function') agendarAutomacoes(); if(typeof renderAuto==='function'&&!document.getElementById('v-auto').hidden) renderAuto(); },()=>{}); db.collection('automacoes_log').limit(5000).onSnapshot(sn=>{ autoLogDb=sn.docs.map(d=>d.data()).filter(x=>x&&x.chave); },()=>{}); }catch(e){}\n  try{ db.collection('rotinas').limit(50).onSnapshot(")
i = s.find('<script'); s = s[:i] + '<script>\n' + MOD + '\n</script>\n' + s[i:]
i = s.find('window.__atend='); assert i > 0
s = s[:i] + JS + s[i:]
open(P, 'w', encoding='utf-8').write(s); print('ok', len(s))
