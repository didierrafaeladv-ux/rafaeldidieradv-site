# Patch sobre equipe/atendimento.html: painel "Controles de qualidade" na aba Indicadores (02/11/2026)
# Indicadores: prazos conferidos (dupla checagem), prazos lançados no Astrea, revisão registrada, escopo definido, lições no encerramento.
import sys
P = sys.argv[1]
s = open(P, encoding='utf-8').read()
def troca(s, a, b):
    assert s.count(a) == 1, ('âncora não única ou ausente', a[:80], s.count(a))
    return s.replace(a, b)
SEC = '''<div class="panel" id="cq-panel" style="margin-bottom:12px"><h3>Controles de qualidade</h3><p class="hint" style="margin:4px 0 8px">Meta: 100% em todos. Prazos: vencimentos dos últimos 30 dias e dos próximos 5 dias úteis. Casos: fichas desta página.</p><div id="cq-res"></div></div>
    '''
JS = r'''
// ---------- indicadores dos controles de qualidade (02/11/2026) ----------
function indicadoresQualidade(convs,pubs,hoje){ const menos=(d,n)=>{ const x=new Date(d+"T12:00:00Z"); x.setUTCDate(x.getUTCDate()-n); return x.toISOString().slice(0,10) };
  const ate=(typeof Tarefas!=="undefined"&&Tarefas.somaUteis)?Tarefas.somaUteis(hoje,5):hoje, de=menos(hoje,30);
  const P=(pubs||[]).filter(p=>p.venc&&p.venc>=de&&p.venc<=ate&&p.status!=="cumprida");
  const fichas=(convs||[]).filter(c=>c.ficha).map(c=>c.ficha);
  const proc=fichas.filter(f=>f.astrea&&f.astrea.cnj&&(f.rota==="urgencia"||f.rota==="processo"));
  const abertas=fichas.filter(f=>f.status!=="Concluída"&&["nova","docs","processo","urgencia"].includes(f.rota)&&!(f.encerramento&&/conflito/.test(f.encerramento.motivo||"")));
  const concl=fichas.filter(f=>f.status==="Concluída"&&f.rota!=="fin"&&f.rota!=="agenda"&&!(f.encerramento&&/conflito/.test(f.encerramento.motivo||"")));
  const ind=(nome,feitos,total,pend,dica)=>({nome,feitos,total,pct:total?Math.round(100*feitos/total):null,pend,dica});
  const semConf=P.filter(p=>!p.conferidaPor), vencSemConf=semConf.filter(p=>p.venc<=hoje);
  return [ind("Prazos lançados no Astrea",P.filter(p=>p.status==="lancada").length,P.length,P.filter(p=>p.status!=="lancada").map(p=>p.cnj||p.tipoNome),"Prazos > Processos acompanhados"),
    ind("Prazos conferidos por outra pessoa",P.length-semConf.length,P.length,semConf.map(p=>p.cnj||p.tipoNome),vencSemConf.length?vencSemConf.length+" já vencido(s) sem conferência":"dupla checagem"),
    ind("Processos com revisão da peça registrada",proc.filter(f=>(f.revisoes||[]).length).length,proc.length,proc.filter(f=>!(f.revisoes||[]).length).map(f=>f.proto),"ficha > Escopo, revisão e encerramento"),
    ind("Casos abertos com escopo definido",abertas.filter(f=>f.escopo&&f.escopo.dentro).length,abertas.length,abertas.filter(f=>!(f.escopo&&f.escopo.dentro)).map(f=>f.proto),"ficha > Escopo"),
    ind("Casos concluídos com lições registradas",concl.filter(f=>f.licoes).length,concl.length,concl.filter(f=>!f.licoes).map(f=>f.proto),"ficha > Encerramento")] }
function renderQualidade(){ const el=document.getElementById("cq-res"); if(!el) return; const L=indicadoresQualidade(st.convs,pubsTodas(),hojeISO());
  el.innerHTML='<div style="overflow-x:auto"><table class="doc-tab"><thead><tr><th>Indicador</th><th>Resultado</th><th>Pendentes</th><th>Onde resolver</th></tr></thead><tbody>'+L.map(x=>'<tr><td>'+esc(x.nome)+'</td><td>'+(x.pct==null?'<span class="hint">sem casos</span>':'<span class="pill '+(x.pct===100?"ok":x.pct>=80?"warn":"crit")+'">'+x.pct+'%</span> <span class="hint">'+x.feitos+' de '+x.total+'</span>')+'</td><td class="hint">'+(x.pend.length?esc(x.pend.slice(0,5).join(", "))+(x.pend.length>5?' e mais '+(x.pend.length-5):''):'—')+'</td><td class="hint">'+esc(x.dica)+'</td></tr>').join("")+'</tbody></table></div>' }
window.__qualidade={calcular:(c,p,h)=>indicadoresQualidade(c,p,h),render:()=>renderQualidade()};
'''
s = troca(s, '<div class="panel" id="rot-panel" style="margin-bottom:12px">', SEC + '<div class="panel" id="rot-panel" style="margin-bottom:12px">')
s = troca(s, 'ind:()=>{ renderInd(); renderRotinas() }', 'ind:()=>{ renderInd(); renderQualidade(); renderRotinas() }')
i = s.find('window.__atend='); assert i > 0
s = s[:i] + JS + s[i:]
open(P, 'w', encoding='utf-8').write(s); print('ok', len(s))
