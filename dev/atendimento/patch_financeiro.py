# Patch sobre equipe/atendimento.html: aba "Financeiro" (contratos, parcelas, pagamentos, cobrança, êxito) — 02/11/2026
# Coleções: fin_contratos, fin_parcelas. Cobranças viram tarefas do Financeiro (Victor) e, com 15 dias, da Direção. Nada é enviado ao cliente.
import sys, os
P = sys.argv[1]
s = open(P, encoding='utf-8').read()
MOD = open(os.path.join(os.path.dirname(os.path.abspath(P)), 'js', 'financeiro.js'), encoding='utf-8').read()
def troca(s, a, b):
    assert s.count(a) == 1, ('âncora não única ou ausente', a[:80], s.count(a))
    return s.replace(a, b)
TAB = '<button role="tab" aria-selected="false" data-view="fin" id="tab-fin">Financeiro</button>\n    '
SEC = r'''<!-- FINANCEIRO -->
  <section id="v-fin" hidden>
    <h2 class="sec">Financeiro</h2>
    <p class="sub">Contratos de honorários, parcelas e recebimentos. Parcela vencida vira tarefa de cobrança do Financeiro (1 e 7 dias) e da Direção (15 dias); nada é enviado ao cliente automaticamente. Política padrão: êxito de 30% líquido do proveito, com gross-up de 14,33%.</p>
    <div class="kpis" id="fin-kpis"></div>
    <div class="panel" style="margin:12px 0"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">Parcelas</h3><label class="hint">Mostrar <select id="fin-filtro"><option value="vencidas">Vencidas</option><option value="30">Próximos 30 dias</option><option value="abertas">Todas em aberto</option><option value="pagas">Pagas</option></select></label></div><div id="fin-parc" style="margin-top:8px"></div><div class="hint" id="fin-msg" role="status"></div></div>
    <div class="cols">
      <div class="panel"><h3>Novo contrato</h3><div style="display:grid;gap:8px;margin-top:6px">
        <label class="hint">Cliente (escolha o caso ou digite)<input id="fin-cli" list="fin-casos" autocomplete="off"><datalist id="fin-casos"></datalist></label>
        <label class="hint">Tipo de honorário<select id="fin-tipo"></select></label>
        <div class="grid2"><label class="hint" id="fin-vlab">Valor fixo total (R$)<input id="fin-valor" inputmode="decimal" placeholder="0,00"></label><label class="hint">Nº de parcelas<input id="fin-n" type="number" min="1" max="120" value="1"></label></div>
        <div class="grid2"><label class="hint">1º vencimento<input id="fin-venc" type="date"></label><label class="hint">Êxito (% líquido)<input id="fin-pct" type="number" min="0" max="100" step="0.5" value="30"></label></div>
        <label class="hint">Observação<input id="fin-obs" placeholder="ex.: entrada na assinatura; êxito sobre o crédito compensado"></label>
        <div class="hint" id="fin-prev"></div><div class="falta" id="fin-err" hidden></div>
        <div><button class="btn small" type="button" id="fin-salva">Salvar contrato e gerar parcelas</button></div></div></div>
      <div class="panel"><h3>Inadimplência por cliente</h3><div id="fin-inad"></div></div>
    </div>
    <div class="panel" style="margin-top:12px"><h3>Contratos</h3><div id="fin-contr"></div></div>
  </section>

  '''
JS = r'''
// ---------- financeiro (02/11/2026) ----------
let finCDb=null, finPDb=null; const FINDB={};
function finContratos(){ const m=new Map(); Object.values(st.finContratos||{}).forEach(x=>m.set(x.id,x)); (finCDb||[]).forEach(x=>m.set(x.id,x)); const ex=new Set(st.finExcl||[]); return [...m.values()].filter(x=>!ex.has(x.id)) }
function finParcelas(){ const m=new Map(); Object.values(st.finParcelas||{}).forEach(x=>m.set(x.id,x)); (finPDb||[]).forEach(x=>m.set(x.id,x)); const ex=new Set(st.finExcl||[]); return [...m.values()].filter(x=>!ex.has(x.id)&&!ex.has(x.contratoId)) }
function finGrava(col,x){ const k=col==="fin_contratos"?"finContratos":"finParcelas"; st[k]=Object.assign({},st[k],{[x.id]:x}); salvarLocal(); if(DBA){ FINDB[x.id]=(FINDB[x.id]||Promise.resolve()).then(()=>DBA.doc(col+"/"+x.id).set(x)).catch(()=>{ finMsg("Não foi possível salvar na base do escritório agora.") }) } }
function finApaga(col,id){ st.finExcl=(st.finExcl||[]).concat([id]); const k=col==="fin_contratos"?"finContratos":"finParcelas"; if(st[k]) delete st[k][id]; salvarLocal(); if(DBA) DBA.doc(col+"/"+id).delete().catch(()=>{}) }
function finMsg(t){ const m=document.getElementById("fin-msg"); if(m) m.textContent=t||"" }
function finCobrar(){ const L=finParcelas(); if(!L.length) return 0; const hoje=hojeISO(), existe=new Set(tarefasTodas().map(t=>t.id)); let n=0;
  Financeiro.cobrancas(L,hoje).forEach(c=>{ if(existe.has(c.id)) return; const p=L.find(x=>x.id===c.parcelaId)||{}, k=finContratos().find(x=>x.id===p.contratoId)||{};
    novaTarefa({id:c.id,titulo:c.titulo,resp:c.resp,prazo:hoje,origem:"financeiro",cliente:p.cliente||"",leadId:k.convId||""}); n++ }); return n }
const brD=s=>s?String(s).slice(0,10).split("-").reverse().join("/"):"—";
function renderFin(){ const hoje=hojeISO(), P=finParcelas(), K=finContratos(), R=Financeiro.resumo(P,hoje), $=Financeiro.reais;
  document.getElementById("fin-kpis").innerHTML=[["Vencido",$(R.vencido),R.qtVencidas+" parcela(s)",R.vencido?"crit":""],["A receber em 30 dias",$(R.aReceber30),"",""],["Previsto no mês",$(R.previstoMes),"",""],["Recebido no mês",$(R.recebidoMes),"",""],["Realização do mês",R.realizacaoMes==null?"—":R.realizacaoMes+"%","recebido sobre o que venceu no mês",R.realizacaoMes!=null&&R.realizacaoMes<80?"warn":""]]
    .map(([a,b,c,cl])=>'<div class="kpi"><div class="hint">'+a+'</div><div style="font-size:22px;font-weight:700'+(cl==="crit"?';color:var(--crit)':'')+'">'+b+'</div>'+(c?'<div class="hint">'+c+'</div>':'')+'</div>').join("");
  const f=document.getElementById("fin-filtro").value, lim=new Date(new Date(hoje+"T12:00:00Z").getTime()+30*864e5).toISOString().slice(0,10);
  let L=P.filter(p=>f==="pagas"?p.pago:!p.pago); if(f==="vencidas") L=L.filter(p=>p.venc<hoje); if(f==="30") L=L.filter(p=>p.venc>=hoje&&p.venc<=lim);
  L.sort((a,b)=>f==="pagas"?String(b.pago.em).localeCompare(String(a.pago.em)):a.venc.localeCompare(b.venc));
  const cls={paga:"ok",vencida:"crit","vence hoje":"warn","a vencer":"line"};
  document.getElementById("fin-parc").innerHTML=L.length?'<div style="overflow-x:auto"><table class="doc-tab"><thead><tr><th>Vencimento</th><th>Cliente</th><th>Parcela</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>'+L.slice(0,200).map(p=>{ const s=Financeiro.situacao(p,hoje);
    return '<tr><td>'+brD(p.venc)+'</td><td>'+esc(p.cliente||"—")+(p.caso?'<div class="hint">'+esc(p.caso)+'</div>':'')+'</td><td>'+(p.exito?'êxito':p.n+'/'+p.de)+'</td><td>'+$(p.valor)+'</td><td><span class="pill '+cls[s]+'">'+s+'</span>'+(p.pago?'<div class="hint">'+$(p.pago.valor)+' em '+brD(p.pago.em)+' ('+esc(p.pago.forma||"")+')'+(p.pago.por?' · '+esc(p.pago.por):'')+'</div>':'')+'</td><td style="white-space:nowrap">'+
      (p.pago?'<button class="btn ghost small" type="button" data-fin-desf="'+esc(p.id)+'">Desfazer</button>':'<span data-fin-box="'+esc(p.id)+'"><button class="btn small" type="button" data-fin-pg="'+esc(p.id)+'">Registrar pagamento</button></span>')+'</td></tr>' }).join("")+'</tbody></table></div>':'<div class="hint">Nenhuma parcela neste filtro.</div>';
  document.getElementById("fin-inad").innerHTML=R.inadimplentes.length?'<table class="doc-tab"><thead><tr><th>Cliente</th><th>Vencido</th><th>Desde</th></tr></thead><tbody>'+R.inadimplentes.map(x=>'<tr><td>'+esc(x.cliente)+'</td><td>'+$(x.valor)+' <span class="hint">('+x.parcelas+')</span></td><td>'+brD(x.maisAntiga)+'</td></tr>').join("")+'</tbody></table>':'<div class="hint">Nenhum cliente com parcela vencida.</div>';
  document.getElementById("fin-contr").innerHTML=K.length?'<div style="overflow-x:auto"><table class="doc-tab"><thead><tr><th>Cliente</th><th>Tipo</th><th>Fixo</th><th>Recebido</th><th>Êxito</th><th></th></tr></thead><tbody>'+K.sort((a,b)=>(b.criadoEm||"").localeCompare(a.criadoEm||"")).map(k=>{ const pk=P.filter(p=>p.contratoId===k.id), rec=pk.filter(p=>p.pago).reduce((a,p)=>a+(+p.pago.valor||0),0), tot=pk.filter(p=>!p.exito).reduce((a,p)=>a+p.valor,0), ex=pk.filter(p=>p.exito);
    return '<tr><td>'+esc(k.cliente)+(k.caso?'<div class="hint">'+esc(k.caso)+'</div>':'')+(k.obs?'<div class="hint">'+esc(k.obs)+'</div>':'')+'</td><td>'+esc(Financeiro.TIPOS[k.tipo]||k.tipo)+'</td><td>'+(tot?$(tot)+' <span class="hint">('+pk.filter(p=>!p.exito).length+'x)</span>':'—')+'</td><td>'+$(rec)+'</td><td>'+(k.tipo==="exito"||k.tipo==="misto"?k.exitoPct+'% líquido'+(ex.length?'<div class="hint">lançado: '+ex.map(p=>$(p.valor)).join(", ")+'</div>':''):'—')+'</td><td style="white-space:nowrap">'+
      ((k.tipo==="exito"||k.tipo==="misto")?'<span data-fin-exbox="'+esc(k.id)+'"><button class="btn ghost small" type="button" data-fin-ex="'+esc(k.id)+'">Lançar êxito</button></span> ':'')+(pk.some(p=>p.pago)?'':'<button class="btn ghost small" type="button" data-fin-del="'+esc(k.id)+'">Excluir</button>')+'</td></tr>' }).join("")+'</tbody></table></div>':'<div class="hint">Nenhum contrato cadastrado.</div>' }
function finPrev(){ const c=finLeForm(), el=document.getElementById("fin-prev"), $=Financeiro.reais; document.getElementById("fin-vlab").firstChild.textContent=c.tipo==="mensal"?"Mensalidade (R$)":"Valor fixo total (R$)";
  ["fin-valor","fin-n","fin-venc"].forEach(id=>{ document.getElementById(id).closest("label").style.display=c.tipo==="exito"?"none":"" }); document.getElementById("fin-pct").closest("label").style.display=(c.tipo==="exito"||c.tipo==="misto")?"":"none";
  const P=Financeiro.gerarParcelas(Object.assign({id:"prev"},c)); el.textContent=P.length?P.length+" parcela(s): "+P.slice(0,3).map(p=>$(p.valor)+" em "+brD(p.venc)).join("; ")+(P.length>3?"; …":""):(c.tipo==="exito"?"Sem parcelas fixas: o êxito é lançado quando houver proveito.":"") }
function finLeForm(){ const g=id=>document.getElementById(id).value; return {cliente:g("fin-cli").trim(),tipo:g("fin-tipo"),valorFixo:g("fin-valor"),nParcelas:+g("fin-n"),primeiroVenc:g("fin-venc"),exitoPct:+g("fin-pct"),obs:g("fin-obs").trim()} }
document.getElementById("fin-tipo").innerHTML=Object.entries(Financeiro.TIPOS).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");
["fin-tipo","fin-valor","fin-n","fin-venc","fin-pct"].forEach(id=>{ document.getElementById(id).addEventListener("input",finPrev); document.getElementById(id).addEventListener("change",finPrev) });
document.getElementById("fin-cli").addEventListener("focus",()=>{ document.getElementById("fin-casos").innerHTML=st.convs.filter(c=>c.ficha&&!EX_IDS.has(c.id)).map(c=>'<option value="'+esc(c.nome+" · "+c.ficha.proto)+'">').join("") });
document.getElementById("fin-filtro").addEventListener("change",renderFin);
document.getElementById("fin-salva").addEventListener("click",()=>{ const c=finLeForm(), er=Financeiro.validarContrato(c), box=document.getElementById("fin-err"); if(er.length){ box.hidden=false; box.innerHTML=er.map(esc).join("<br>"); return } box.hidden=true;
  const m=c.cliente.match(/^(.*) · (RD-\d{4}-\d{4})$/), conv=m?st.convs.find(x=>x.ficha&&x.ficha.proto===m[2]):null, agora=new Date().toISOString();
  const k=Object.assign(c,{id:"ct"+Date.now(),cliente:m?m[1]:c.cliente,caso:m?m[2]:"",convId:conv?conv.id:"",criadoEm:agora,criadoPor:quemSou(),status:"ativo"}); if(k.tipo!=="exito"&&k.tipo!=="misto") delete k.exitoPct;
  finGrava("fin_contratos",k); const P=Financeiro.gerarParcelas(k); P.forEach(p=>finGrava("fin_parcelas",p));
  if(conv&&conv.ficha){ conv.ficha.log.push("Contrato de honorários registrado no Financeiro ("+Financeiro.TIPOS[k.tipo]+(P.length?", "+P.length+" parcela(s)":"")+")"); salvar() }
  ["fin-cli","fin-valor","fin-obs"].forEach(id=>document.getElementById(id).value=""); finPrev(); finMsg("Contrato salvo"+(P.length?" com "+P.length+" parcela(s).":".")); renderFin() });
document.getElementById("v-fin").addEventListener("click",e=>{ const t=e.target, hoje=hojeISO(), $=Financeiro.reais;
  if(t.dataset.finPg!=null){ const p=finParcelas().find(x=>x.id===t.dataset.finPg); if(!p) return; const box=t.closest("[data-fin-box]");
    box.innerHTML='<input data-fin-v value="'+(p.valor/100).toFixed(2).replace(".",",")+'" style="width:100px" aria-label="Valor pago"> <input data-fin-d type="date" value="'+hoje+'" aria-label="Data"> <select data-fin-f aria-label="Forma"><option>Pix</option><option>Boleto</option><option>Transferência</option><option>Dinheiro</option><option>Cartão</option></select> <button class="btn small" type="button" data-fin-ok="'+esc(p.id)+'">Confirmar</button>'; return }
  if(t.dataset.finOk!=null){ const p=finParcelas().find(x=>x.id===t.dataset.finOk), box=t.closest("[data-fin-box]"); if(!p) return; const v=Financeiro.cent(box.querySelector("[data-fin-v]").value), d=box.querySelector("[data-fin-d]").value;
    if(!(v>0)||!d){ finMsg("Informe o valor e a data do pagamento."); return } finGrava("fin_parcelas",Object.assign({},p,{pago:{valor:v,em:d,forma:box.querySelector("[data-fin-f]").value,por:quemSou(),registradoEm:new Date().toISOString()}}));
    tarefasTodas().filter(x=>x.origem==="financeiro"&&x.status!=="feita"&&x.id.startsWith(("fin-"+p.id).replace(/[^A-Za-z0-9_\-]/g,""))).forEach(x=>{ x.status="feita"; x.feitaEm=new Date().toISOString(); x.feitaPor="Financeiro (pagamento registrado)"; salvarTarefa(x) });
    finMsg("Pagamento de "+$(v)+" registrado"+(v<p.valor?" (menor que a parcela: confira o saldo).":".")); renderFin(); return }
  if(t.dataset.finDesf!=null){ const p=finParcelas().find(x=>x.id===t.dataset.finDesf); if(!p) return; if(t.dataset.conf!=="1"){ t.dataset.conf="1"; t.textContent="Confirmar"; return } finGrava("fin_parcelas",Object.assign({},p,{pago:null})); finMsg("Pagamento desfeito."); renderFin(); return }
  if(t.dataset.finEx!=null){ const box=t.closest("[data-fin-exbox]"); box.innerHTML='<input data-fin-prov placeholder="proveito econômico (R$)" style="width:150px"> <input data-fin-exv type="date" value="'+hoje+'" aria-label="Vencimento"> <button class="btn small" type="button" data-fin-exok="'+esc(t.dataset.finEx)+'">Lançar</button> <span class="hint" data-fin-exprev></span>'; return }
  if(t.dataset.finExok!=null){ const k=finContratos().find(x=>x.id===t.dataset.finExok), box=t.closest("[data-fin-exbox]"); if(!k) return; const e=Financeiro.exito(box.querySelector("[data-fin-prov]").value,{exitoPct:k.exitoPct||30}), venc=box.querySelector("[data-fin-exv]").value;
    if(!(e.proveito>0)||!venc){ finMsg("Informe o proveito econômico e o vencimento."); return }
    finGrava("fin_parcelas",{id:k.id+"-ex"+Date.now(),contratoId:k.id,n:1,de:1,exito:{proveito:e.proveito,pct:e.pct,carga:e.carga,liquido:e.liquido},venc,valor:e.bruto,cliente:k.cliente,caso:k.caso||"",pago:null});
    finMsg("Êxito lançado: "+e.pct+"% de "+$(e.proveito)+" = "+$(e.liquido)+" líquido; com gross-up de "+String(e.carga).replace(".",",")+"%: "+$(e.bruto)+" a faturar."); renderFin(); return }
  if(t.dataset.finDel!=null){ if(t.dataset.conf!=="1"){ t.dataset.conf="1"; t.textContent="Confirmar exclusão"; return } const id=t.dataset.finDel; finParcelas().filter(p=>p.contratoId===id).forEach(p=>finApaga("fin_parcelas",p.id)); finApaga("fin_contratos",id); finMsg("Contrato excluído."); renderFin() } });
document.getElementById("v-fin").addEventListener("input",e=>{ const t=e.target; if(t.dataset.finProv==null) return; const box=t.closest("[data-fin-exbox]"), k=finContratos().find(x=>x.id===box.dataset.finExbox), ev=Financeiro.exito(t.value,{exitoPct:(k&&k.exitoPct)||30});
  box.querySelector("[data-fin-exprev]").textContent=ev.proveito?Financeiro.reais(ev.liquido)+" líquido → "+Financeiro.reais(ev.bruto)+" bruto":"" });
setTimeout(finCobrar,1500); setInterval(finCobrar,60*60000);
window.__fin={renderizar:()=>renderFin(),cobrar:()=>finCobrar(),contratos:()=>finContratos(),parcelas:()=>finParcelas()};
'''
s = troca(s, '<button role="tab" aria-selected="false" data-view="auto" id="tab-auto">', TAB + '<button role="tab" aria-selected="false" data-view="auto" id="tab-auto">')
s = troca(s, '<!-- AUTOMAÇÕES -->', SEC + '<!-- AUTOMAÇÕES -->')
s = troca(s, 'auto:()=>renderAuto()};', 'auto:()=>renderAuto(),fin:()=>{ if(!document.getElementById("fin-venc").value) document.getElementById("fin-venc").value=hojeISO(); finPrev(); renderFin() }};')
s = troca(s, "  try{ db.collection('automacoes').limit(200).onSnapshot(",
  "  try{ db.collection('fin_contratos').limit(2000).onSnapshot(sn=>{ finCDb=sn.docs.map(d=>d.data()).filter(x=>x&&x.id); if(typeof renderFin==='function'&&!document.getElementById('v-fin').hidden) renderFin(); },()=>{}); db.collection('fin_parcelas').limit(10000).onSnapshot(sn=>{ finPDb=sn.docs.map(d=>d.data()).filter(x=>x&&x.id); if(typeof finCobrar==='function') finCobrar(); if(typeof renderFin==='function'&&!document.getElementById('v-fin').hidden) renderFin(); },()=>{}); }catch(e){}\n  try{ db.collection('automacoes').limit(200).onSnapshot(")
i = s.find('<script'); s = s[:i] + '<script>\n' + MOD + '\n</script>\n' + s[i:]
i = s.find('window.__atend='); assert i > 0
s = s[:i] + JS + s[i:]
open(P, 'w', encoding='utf-8').write(s); print('ok', len(s))
