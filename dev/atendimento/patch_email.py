# Patch: e-mails do escritório na triagem (03/11/2026)
# A rotina "Entrada de e-mails" grava na coleção "entradas_email" um resumo de cada e-mail novo (remetente, assunto, trecho, CPF/CNPJ/CNJ achados).
# Na Fila única, o painel "E-mails a triar" deixa a equipe abrir a demanda (formulário manual já preenchido), levar intimação de tribunal para Prazos,
# ou descartar. Nada é respondido ao remetente automaticamente.
import sys, re
P = sys.argv[1]; MOD = sys.argv[2] if len(sys.argv) > 2 else None
s = open(P, encoding='utf-8').read()
def troca(s, a, b):
    assert s.count(a) == 1, ('âncora não única ou ausente', a[:80], s.count(a))
    return s.replace(a, b)
ROT_OLD = "{ id: 'monitor', nome: 'Verificação das rotinas'"
ROT_NEW = "{ id: 'email', nome: 'Entrada de e-mails', dias: [1, 2, 3, 4, 5], horas: [8, 13], min: 13, folgaMin: 90 },\n    { id: 'monitor', nome: 'Verificação das rotinas'"
SEC = '''<div class="panel" id="em-panel" hidden style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">E-mails a triar <span class="pill warn" id="em-cnt"></span></h3><label class="hint"><input type="checkbox" id="em-todos"> mostrar já tratados</label></div><p class="hint" style="margin:4px 0 8px">Chegaram na caixa do escritório e ainda não viraram demanda. Abra a demanda (o formulário vem preenchido; confira o CPF/CNPJ e a base legal), leve a intimação de tribunal para Prazos ou descarte. Nenhuma resposta é enviada ao remetente.</p><div id="em-lista"></div></div>
    '''
JS = r'''
// ---------- e-mails a triar (03/11/2026) ----------
let emDb=null, emAtual=null; const EMDB={};
function emTodos(){ const m=new Map(); (emDb||[]).forEach(x=>m.set(x.id,x)); Object.values(st.emailsLocal||{}).forEach(x=>{ const a=m.get(x.id); m.set(x.id,Object.assign({},a||{},x)) }); return [...m.values()] }
function emGrava(x){ st.emailsLocal=Object.assign({},st.emailsLocal,{[x.id]:x}); salvarLocal(); if(DBA){ EMDB[x.id]=(EMDB[x.id]||Promise.resolve()).then(()=>DBA.doc("entradas_email/"+x.id).set(x)).catch(()=>{}) } }
function emMarca(id,status,extra){ const e=emTodos().find(x=>x.id===id); if(!e) return; emGrava(Object.assign({},e,{status,tratadoEm:new Date().toISOString(),tratadoPor:quemSou()},extra||{})); renderEmails() }
function emRota(e){ const t=((e.assunto||"")+" "+(e.trecho||"")).toLowerCase();
  if(e.tipo==="tribunal") return "processo"; if(/cita[cç][aã]o|penhora|bloqueio|sisbajud|mandado|prazo/.test(t)) return "urgencia";
  if(/boleto|honor[aá]rio|pagamento|nota fiscal|fatura/.test(t)) return "fin"; if(/agendar|reuni[aã]o|hor[aá]rio|visita/.test(t)) return "agenda";
  if(/segue|anexo|documento|em anexo/.test(t)) return "docs"; return "nova" }
function renderEmails(){ const box=document.getElementById("em-panel"); if(!box) return; const todos=document.getElementById("em-todos").checked, L=emTodos().filter(e=>todos||e.status==="nova").sort((a,b)=>(b.recebidoEm||"").localeCompare(a.recebidoEm||""));
  const n=emTodos().filter(e=>e.status==="nova").length; document.getElementById("em-cnt").textContent=n||""; box.hidden=!emTodos().length;
  const br=s=>s?new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
  document.getElementById("em-lista").innerHTML=L.length?L.slice(0,60).map(e=>'<div style="border-top:1px solid var(--line);padding:8px 0;display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap"><div style="flex:1;min-width:240px"><b>'+esc(e.assunto||"(sem assunto)")+'</b> '+(e.tipo==="tribunal"?'<span class="pill info">tribunal</span>':'')+(e.cnj?' <span class="mono hint">'+esc(e.cnj)+'</span>':'')+'<div class="hint">'+esc(e.deNome||"")+(e.deEmail?' &lt;'+esc(e.deEmail)+'&gt;':'')+' · '+br(e.recebidoEm)+(e.anexos?' · '+e.anexos+' anexo(s) no e-mail':'')+'</div><div class="hint" style="margin-top:2px">'+esc((e.trecho||"").slice(0,300))+'</div></div><div style="white-space:nowrap">'+
    (e.status==="nova"?(e.tipo==="tribunal"?'<button class="btn small" type="button" data-em-pub="'+esc(e.id)+'">Levar para Prazos</button> ':'<button class="btn small" type="button" data-em-abre="'+esc(e.id)+'">Abrir demanda</button> ')+'<button class="btn ghost small" type="button" data-em-desc="'+esc(e.id)+'">Descartar</button>'
      :'<span class="pill '+(e.status==="descartado"?"line":"ok")+'">'+esc(e.status)+(e.proto?' '+esc(e.proto):'')+'</span>')+'</div></div>').join(""):'<div class="hint">Nenhum e-mail pendente.</div>' }
document.getElementById("em-todos").addEventListener("change",renderEmails);
document.getElementById("em-panel").addEventListener("click",ev=>{ const t=ev.target, g=id=>document.getElementById(id);
  if(t.dataset.emDesc!=null){ if(t.dataset.conf!=="1"){ t.dataset.conf="1"; t.textContent="Confirmar"; return } emMarca(t.dataset.emDesc,"descartado"); return }
  if(t.dataset.emAbre!=null){ const e=emTodos().find(x=>x.id===t.dataset.emAbre); if(!e) return; mostrar("mesa"); abreManual(); emAtual=e.id;
    g("nm-canal").value="E-mail"; g("nm-nome").value=e.deNome||""; g("nm-contato").value=e.deEmail||""; g("nm-doc").value=e.doc||""; g("nm-rota").value=emRota(e);
    g("nm-resumo").value=((e.assunto?e.assunto+" — ":"")+(e.trecho||"")).slice(0,900); g("nm-por").value=quemSou(); g("nm-msg").textContent=e.doc?"":"Confira o CPF ou CNPJ: não veio no e-mail."; return }
  if(t.dataset.emPub!=null){ const e=emTodos().find(x=>x.id===t.dataset.emPub); if(!e) return; mostrar("prazos"); g("pub-data").value=(e.recebidoEm||"").slice(0,10)||hojeISO(); g("pub-tx").value=(e.cnj?"Processo "+e.cnj+" - ":"")+(e.assunto||"")+". "+(e.trecho||"");
    emMarca(e.id,"em Prazos"); const m=g("pub-tx"); if(m&&m.focus) m.focus() } });
{ const _rm=registraManual; registraManual=function(v){ const r=_rm(v); if(r&&r.ok&&emAtual){ emMarca(emAtual,"registrado",{proto:r.proto}); emAtual=null } return r } }
document.getElementById("nm-cancela").addEventListener("click",()=>{ emAtual=null });
{ const _rf=renderFila; renderFila=function(){ const x=_rf.apply(this,arguments); try{ renderEmails() }catch(e){} return x } }
window.__email={definir:L=>{ emDb=L; renderEmails() },todos:()=>emTodos(),rota:e=>emRota(e)};
'''
s = troca(s, ROT_OLD, ROT_NEW)
s = troca(s, '<p class="sub">Todas as demandas abertas, do WhatsApp e do site, numa fila só. A prioridade combina a gravidade do assunto com o tempo que resta para responder.</p>\n    <div class="toolbar">',
          '<p class="sub">Todas as demandas abertas, do WhatsApp e do site, numa fila só. A prioridade combina a gravidade do assunto com o tempo que resta para responder.</p>\n    ' + SEC + '<div class="toolbar">')
s = troca(s, "  try{ db.collection('fin_contratos').limit(2000).onSnapshot(",
  "  try{ db.collection('entradas_email').limit(500).onSnapshot(sn=>{ emDb=sn.docs.map(d=>d.data()).filter(x=>x&&x.id); if(typeof renderEmails==='function') renderEmails(); },()=>{}); }catch(e){}\n  try{ db.collection('fin_contratos').limit(2000).onSnapshot(")
i = s.find('window.__atend='); assert i > 0
s = s[:i] + JS + s[i:]
open(P, 'w', encoding='utf-8').write(s); print('ok página', len(s))
if MOD:
    m = open(MOD, encoding='utf-8').read(); m = troca(m, ROT_OLD, ROT_NEW); open(MOD, 'w', encoding='utf-8').write(m); print('ok módulo')
