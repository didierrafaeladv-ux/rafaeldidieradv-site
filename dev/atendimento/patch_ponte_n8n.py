#!/usr/bin/env python3
"""Ponte com o n8n no Atendimento RD e no CRM (11/11/2026).

- Embute equipe/js/webhook_bridge.js (RDWebhookBridge) nas duas páginas; token por pessoa só no navegador.
- Atendimento: painel "Conexão com o n8n e o Google Drive" (endereço, nome, token, testar), enviar conversas ao Drive e trazer
  de volta (junta por conversa); aplicaCNPJ passa a ser a função que leva a consulta do CNPJ à ficha (antes estava solta).
- CRM: mesmo painel; enviar/trazer leads; botão "Criar pasta no Drive" na ficha, ligado a CRM.travas().prontoDrive
  (antes calculado e nunca usado), e "Criar pastas pendentes" para todos os leads prontos.
Cada troca usa âncora exata e falha se não achar. Uso: python3 patch_ponte_n8n.py [equipe/atendimento.html] [equipe/crm.html]
"""
import os, sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PONTE = open(os.path.join(RAIZ, 'equipe', 'js', 'webhook_bridge.js'), encoding='utf-8').read().strip()
MARCA = '/* Ponte com o n8n (RDWebhookBridge)'


def troca(s, a, b, nome):
    if s.count(a) != 1: raise SystemExit(f'[erro] âncora "{nome}" encontrada {s.count(a)} vez(es)')
    return s.replace(a, b, 1)


def embute(s):
    if MARCA in s:   # já embutida: atualiza para a versão do arquivo
        i = s.index(MARCA); f = s.index('</script>', i)
        return s[:i] + PONTE + '\n' + s[f:]
    return troca(s, '</head>', '<script>\n' + PONTE + '\n</script>\n</head>', 'fim do head')


def atendimento(p):
    s = embute(open(p, encoding='utf-8').read())
    if 'id="rb-box"' in s: open(p, 'w', encoding='utf-8').write(s); print('[ok] atendimento: ponte atualizada'); return
    # aplicaCNPJ: a função que aplica o resultado (colado ou buscado) na ficha
    s = troca(s, '''document.getElementById("cn-aplica").addEventListener("click",()=>{const msg=document.getElementById("cn-msg");let n;
  try{n=CNPJ.normalizar(document.getElementById("cn-cola").value)}catch(e){msg.textContent=e.message;return}
  const dig=''', '''document.getElementById("cn-aplica").addEventListener("click",()=>{const msg=document.getElementById("cn-msg");let n;
  try{n=CNPJ.normalizar(document.getElementById("cn-cola").value)}catch(e){msg.textContent=e.message;return}
  aplicaCNPJ(n) });
/* aplicaCNPJ(n): leva à ficha da aba Documentos o resultado normalizado da consulta do CNPJ (colado ou buscado). Devolve true se aplicou. */
function aplicaCNPJ(n){ const msg=document.getElementById("cn-msg");
  const dig=''', 'cn-aplica')
    s = troca(s, 'if(dig.length===14&&dig!==n.cnpj){msg.textContent="O resultado colado é de outro CNPJ ("+CNPJ.fmtCNPJ(n.cnpj)+").";return}',
              'if(dig.length===14&&dig!==n.cnpj){msg.textContent="O resultado é de outro CNPJ ("+CNPJ.fmtCNPJ(n.cnpj)+").";return false}', 'outro CNPJ')
    s = troca(s, '''Confira o representante no contrato social e informe o CPF dele."});
function triagemConv''', '''Confira o representante no contrato social e informe o CPF dele."; return true }
function triagemConv''', 'fim do cn-aplica')
    s = troca(s, 'function aplicaCNPJ(n){ document.getElementById("cn-cola").value=JSON.stringify(n.__bruto||{}); }\n', '', 'aplicaCNPJ solta')
    s = troca(s, 'const tx=await r.text(); CNPJ.normalizar(tx); document.getElementById("cn-cola").value=tx; document.getElementById("cn-aplica").click(); return }catch(e){} }',
              'aplicaCNPJ(CNPJ.normalizar(await r.text())); return }catch(e){} }', 'busca automática do CNPJ')
    # painel da ponte, ao lado da conexão ao vivo
    s = troca(s, '<div class="hint" id="lv-st" role="status">Desconectado.</div></div></details>',
              '<div class="hint" id="lv-st" role="status">Desconectado.</div></div></details>\n'
              '        <details id="rb-box" style="margin:0 0 8px"><summary class="hint">Conexão com o n8n e o Google Drive</summary><div id="rb-painel" style="margin-top:6px"></div>'
              '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn small" type="button" id="rb-enviar">Enviar conversas ao Drive</button>'
              '<button class="btn small ghost" type="button" id="rb-trazer">Trazer do Drive</button></div><div class="hint" id="rb-st" role="status"></div></details>', 'painel ao vivo')
    s = troca(s, 'if(lv.url&&lv.chave){ lvBusca(); lvTimer=setInterval(lvBusca,30000) }\n', '''if(lv.url&&lv.chave){ lvBusca(); lvTimer=setInterval(lvBusca,30000) }
/* Ponte com o n8n (11/11/2026): conversas reais (sem as de exemplo) vão ao JSON mestre no Drive; ao trazer, junta por conversa (a do Drive prevalece). */
RDWebhookBridge.painel(document.getElementById("rb-painel"),{btn:"btn small"});
document.getElementById("rb-enviar").addEventListener("click",async()=>{ const el=document.getElementById("rb-st"); el.textContent="Enviando…";
  const dados={convs:st.convs.filter(c=>!EX_IDS.has(c.id)),seq:st.seq}; const r=await RDWebhookBridge.syncBase("salvar","atendimento",dados);
  el.textContent=r.ok?"Enviado ao Drive: "+dados.convs.length+" conversa(s).":r.erro });
document.getElementById("rb-trazer").addEventListener("click",async()=>{ const el=document.getElementById("rb-st"); el.textContent="Buscando no Drive…";
  const r=await RDWebhookBridge.syncBase("ler","atendimento"), d=r.ok?r.dados:(r.cache&&r.cache.dados);
  if(!d||!Array.isArray(d.convs)){ el.textContent=r.ok?"Ainda não há conversas salvas no Drive.":r.erro; return }
  if(!confirm("Juntar "+d.convs.length+" conversa(s) do Drive"+(r.ok?"":" (última cópia guardada neste navegador)")+" com as deste navegador? Em conversa repetida, fica a do Drive.")){ el.textContent="Nada alterado."; return }
  const pos=new Map(st.convs.map((c,i)=>[c.id,i])); let novas=0;
  d.convs.forEach(c=>{ if(!c||!c.id) return; if(pos.has(c.id)) st.convs[pos.get(c.id)]=c; else { st.convs.push(c); novas++ } });
  st.seq=Math.max(st.seq||0,+d.seq||0); salvar(); renderMesa(); el.textContent=d.convs.length+" conversa(s) do Drive; "+novas+" nova(s) neste navegador."+(r.ok?"":" "+r.erro) });
''', 'arranque ao vivo')
    open(p, 'w', encoding='utf-8').write(s); print('[ok] atendimento:', p)


def crm(p):
    s = embute(open(p, encoding='utf-8').read())
    if 'id="t-drive"' in s: open(p, 'w', encoding='utf-8').write(s); print('[ok] crm: ponte atualizada'); return
    s = troca(s, '''      <label class="btn ghost" style="cursor:pointer">Importar CSV<input type="file" id="b-imp" accept=".csv,text/csv" hidden></label>
    </div>
  </header>''', '''      <label class="btn ghost" style="cursor:pointer">Importar CSV<input type="file" id="b-imp" accept=".csv,text/csv" hidden></label>
      <button class="btn ghost" type="button" id="b-pastas" hidden>Criar pastas no Drive</button>
    </div>
  </header>
  <details id="rb-box"><summary class="aviso">Conexão com o n8n e o Google Drive</summary><div id="rb-painel" style="margin-top:6px;max-width:560px"></div>
    <div class="acoes" style="margin-top:6px"><button class="btn sm" type="button" id="rb-enviar">Enviar leads ao Drive</button><button class="btn sm ghost" type="button" id="rb-trazer">Trazer do Drive</button></div>
    <div class="aviso" id="rb-st" role="status"></div></details>''', 'cabeçalho do CRM')
    s = troca(s, '''      <div class="aviso" id="t-status" role="status"></div>
    </fieldset>''', '''      <div class="aviso" id="t-status" role="status"></div>
      <div class="acoes" style="margin-top:8px"><button type="button" class="btn sm" id="t-drive" disabled>Criar pasta no Drive</button><span class="aviso" id="t-drive-st" role="status"></span></div>
    </fieldset>''', 'travas da ficha')
    # selo do cartão usa o sinal do módulo
    s = troca(s, '''  return tv.pastaDrive?'<span class="chip ok">pasta no Drive</span>':'<span class="chip ok">pronto para a pasta</span>' }''',
              '''  return tv.pastaDrive?'<span class="chip ok">pasta no Drive</span>':t.prontoDrive?'<span class="chip ok">pronto para a pasta</span>':'' }''', 'selo da pasta')
    s = troca(s, '''  $("t-status").innerHTML=travaStatus(v);
''', '''  $("t-status").innerHTML=travaStatus(v); botaoDrive(l);
''', 'abrir ficha')
    s = troca(s, '''function renderHist(l){''', '''/* Ponte com o n8n (11/11/2026): pasta do cliente no Drive quando CRM.travas().prontoDrive (contratado + G1, G3 e G4, ainda sem pasta). */
const cnpjDoLead=l=>{ const d=String(l.id||"").replace(/^doc-/,""); return /^\\d{14}$/.test(d)?d:"" };
function botaoDrive(l){ const b=$("t-drive"), pr=!!(l&&CRM.travas(l).prontoDrive); b.disabled=!pr;
  $("t-drive-st").textContent=!l?"":(l.travas||{}).pastaDrive?"Pasta já criada.":pr?(RDWebhookBridge.configurado()?"Pronto: cria a pasta pelo n8n.":"Pronto, mas falta configurar a conexão com o n8n (no topo da página)."):"Disponível quando o lead estiver contratado, com G1, G3 e G4." }
async function criarPasta(l){ const r=await RDWebhookBridge.prontoDrive({leadId:l.id,nome:l.empresa||l.nome,cnpj:cnpjDoLead(l),tipo:l.area||"Outra"});
  if(r.ok&&r.folderUrl){ l.travas=Object.assign({},l.travas,{pastaDrive:r.folderUrl}); l.hist=(l.hist||[]).concat([{data:HOJE(),canal:"Drive",nota:"Pasta criada no Drive pelo n8n",por:RDWebhookBridge.config().pessoa||""}]); persistir(l) }
  return r }
function pendentesDrive(){ return leads.filter(l=>CRM.travas(l).prontoDrive) }
function renderPastas(){ const n=pendentesDrive().length, b=$("b-pastas"); b.hidden=!n; b.textContent="Criar pastas no Drive ("+n+")" }
function renderHist(l){''', 'renderHist')
    s = troca(s, 'function render(){ renderKpis(); renderMetas(); renderMaterias(); renderTempos(); renderFiltros(); renderBoard(); renderDemo() }',
              'function render(){ renderKpis(); renderMetas(); renderMaterias(); renderTempos(); renderFiltros(); renderBoard(); renderDemo(); renderPastas() }', 'render')
    s = troca(s, '''// CSV
async function salvaArquivo''', '''$("t-drive").addEventListener("click",async()=>{ const l=leads.find(x=>x.id===editando); if(!l) return; $("t-drive").disabled=true; $("t-drive-st").textContent="Criando a pasta…";
  const r=await criarPasta(l); $("t-drive-st").textContent=r.ok?"Pasta criada.":r.erro; if(r.ok){ $("t-status").innerHTML=travaStatus(l); render() } else { botaoDrive(l); $("t-drive-st").textContent=r.erro } });
$("b-pastas").addEventListener("click",async()=>{ const L=pendentesDrive(); let ok=0, fila=0, erro="";
  for(const l of L){ const r=await criarPasta(l); if(r.ok) ok++; else if(r.naFila) fila++; else { erro=r.erro; if(r.recusado||r.semConfig) break } }
  render(); toast(ok+" pasta(s) criada(s)"+(fila?"; "+fila+" na fila do navegador":"")+(erro?". "+erro:".")) });
RDWebhookBridge.painel($("rb-painel"),{btn:"btn sm",aoMudar:()=>render()});
$("rb-enviar").addEventListener("click",async()=>{ $("rb-st").textContent="Enviando…"; const L=leads.filter(l=>!ehDemo(l));
  const r=await RDWebhookBridge.syncBase("salvar","crm",L); $("rb-st").textContent=r.ok?"Enviado ao Drive: "+L.length+" lead(s).":r.erro });
$("rb-trazer").addEventListener("click",async()=>{ $("rb-st").textContent="Buscando no Drive…"; const r=await RDWebhookBridge.syncBase("ler","crm"), d=r.ok?r.dados:(r.cache&&r.cache.dados);
  if(!Array.isArray(d)){ $("rb-st").textContent=r.ok?"Ainda não há leads salvos no Drive.":r.erro; return }
  if(!confirm("Juntar "+d.length+" lead(s) do Drive com os deste navegador? Em lead repetido, fica o do Drive.")){ $("rb-st").textContent="Nada alterado."; return }
  const pos=new Map(leads.map((l,i)=>[l.id,i])); let novos=0; d.forEach(l=>{ if(!l||!l.id) return; if(pos.has(l.id)) leads[pos.get(l.id)]=l; else { leads.push(l); novos++ } });
  salvaLocal(); d.forEach(l=>{ if(l&&l.id) persistir(l) }); render(); $("rb-st").textContent=d.length+" lead(s) do Drive; "+novos+" novo(s) neste navegador."+(r.ok?"":" "+r.erro) });

// CSV
async function salvaArquivo''', 'CSV')
    open(p, 'w', encoding='utf-8').write(s); print('[ok] crm:', p)


if __name__ == '__main__':
    a = sys.argv[1:]
    atendimento(a[0] if a else os.path.join(RAIZ, 'equipe', 'atendimento.html'))
    crm(a[1] if len(a) > 1 else os.path.join(RAIZ, 'equipe', 'crm.html'))
