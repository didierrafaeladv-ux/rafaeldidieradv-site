#!/usr/bin/env python3
"""PlanejaTrib RD — painel "Contribuição previdenciária sobre verbas da folha" na aba Recuperação (04/11/2026).
Inclui o módulo recupera_folha.js (RecFolha), a renderização, a leitura de arquivos e as ações.
Uso: python3 patch_folha.py pagina.html  (depois do patch_numeros.py)"""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))

def troca(s, a, b):
    n = s.count(a)
    if n != 1: sys.exit(f'[erro] trecho encontrado {n} vezes: {a[:90]}')
    return s.replace(a, b)

p = sys.argv[1]; s = open(p, encoding='utf-8').read()
if 'root.RecFolha = API' in s: sys.exit('[ok] já aplicado')
if 'function numBR(' not in s: sys.exit('[erro] aplique antes o patch_numeros.py')
mod = open(os.path.join(AQUI, 'recupera_folha.js'), encoding='utf-8').read()
i = s.find('<script', s.find('function numBR(')); s = s[:i] + '<script>\n' + mod + '\n</script>\n' + s[i:]

RENDER = r'''const folhaMem={}; const rs=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});   // com centavos: é memória de cálculo   // folha lida nesta sessão (com os valores mês a mês); no cliente só ficam as bases agregadas
function folhaEstado(c){ const F=Object.assign(RecFolha.padrao((c.folha&&c.folha.perfil)||'empresa'),c.folha||{}); F.status=Object.assign(RecFolha.padrao(F.perfil).status,(c.folha||{}).status||{}); return F; }
function renderFolha(c){
  const F=folhaEstado(c), V=RecFolha.VERBAS, temBase=Object.keys(F.bases||{}).length>0, temGps=Object.keys(F.gps||{}).length>0;
  const r=RecFolha.calcular(F.bases||{},F.gps||{},F), mb=k=>k?k.split('-').reverse().join('/'):'';
  const opt=(v,l,a)=>`<option value="${v}"${v===a?' selected':''}>${l}</option>`;
  const stt={entra:'entra no total',pendente:'a aprovar',fora:'fora'};
  const rub=(F.rubricas||[]), cls=rub.filter(x=>x.verba), sem=rub.filter(x=>!x.verba);
  const linRub=x=>`<tr><td>${esc(x.codigo||'—')}</td><td>${esc(x.descricao)}${x.vinculo==='RPPS'?' <span class="tag warn">RPPS</span>':''}</td><td>${rs(x.total)}</td><td><select data-folhacod="${esc(x.k)}" aria-label="Verba da rubrica ${esc(x.descricao)}">${opt('-','sem verba',x.verba||'-')}${V.map(v=>opt(v.id,v.curto,x.verba)).join('')}</select></td></tr>`;
  return `<details class="tool"${temBase||temGps?' open':''}><summary>Contribuição previdenciária sobre verbas da folha</summary>
    <p class="mini" style="margin-top:6px">Contribuição patronal (20% + RAT × FAP) paga sobre verbas que não deveriam integrar a base. Importe a folha por rubrica em CSV (competência; código; descrição; valor; vínculo RGPS ou RPPS) e o extrato de GPS do e-CAC. Só a verba marcada "entra no total" compõe o valor; "a aprovar" aparece à parte até a sua decisão.</p>
    <div class="form2">
      <label>Perfil<select data-folha="perfil">${opt('empresa','Empresa: teses dos tribunais, 60 meses',F.perfil)}${opt('titulo','Título judicial do cliente',F.perfil)}</select></label>
      <label>Mês da compensação<input type="month" data-folha="mesComp" value="${esc(F.mesComp)}"></label>
      <label>Competência inicial<input type="text" data-folha="inicio" placeholder="MM/AAAA" value="${esc(mb(F.inicio))}"></label>
      <label>Competência final<input type="text" data-folha="fim" placeholder="MM/AAAA (vazio = todas)" value="${esc(mb(F.fim))}"></label>
      <label>Patronal (%)<input type="number" step="any" data-folha="patronal" value="${esc(F.patronal)}"></label>
      <label>RAT padrão (%)<input type="number" step="any" data-folha="ratPadrao" value="${esc(F.rat.padrao)}"></label>
      <label>RAT por ano<input type="text" data-folha="ratTxt" placeholder="2005-2009=1; 2010=2" value="${esc(F.ratTxt||'')}"></label>
      <label>FAP padrão<input type="number" step="any" data-folha="fapPadrao" value="${esc(F.fap.padrao)}"></label>
      <label>FAP por ano<input type="text" data-folha="fapTxt" placeholder="2015=0,85; 2016=1,1" value="${esc(F.fapTxt||'')}"></label>
      <label>Folha por rubrica (CSV)<input type="file" accept=".csv,.txt,text/csv,text/plain" data-folhaarq="folha"></label>
      <label>Extrato de GPS do e-CAC (CSV)<input type="file" accept=".csv,.txt,text/csv,text/plain" data-folhaarq="gps"></label>
      <label style="grid-column:1/-1">Ou cole o extrato de GPS (competência, quantidade, valor)<textarea data-folha="gpsTxt" rows="3" style="width:100%;font-family:var(--f-mono);font-size:.82rem" placeholder="11/2005	8	75.769,52"></textarea></label>
    </div>
    <div class="tablewrap" style="margin-top:8px"><table style="min-width:620px"><thead><tr><th>Verba</th><th>Fundamento</th><th>Situação</th><th>Base no período</th></tr></thead><tbody>
      ${V.map(v=>`<tr><td>${esc(v.nome)}</td><td class="mini">${esc(v.fundamento)}</td><td><select data-folhav="${v.id}" aria-label="Situação: ${esc(v.curto)}">${['entra','pendente','fora'].map(x=>opt(x,stt[x],F.status[v.id])).join('')}</select></td><td>${rs(r.basesVerba[v.id])}</td></tr>`).join('')}
    </tbody></table></div>
    ${temBase||temGps?`<div class="retres"><b>Indébito (entra no total):</b> ${rs(r.total.nominal)} · <b>atualizado pela Selic:</b> ${rs(r.total.atualizado)}
      <br><b>A aprovar:</b> ${rs(r.total.pendente)} · atualizado ${rs(r.total.pendenteAtualizado)} · <b>competências:</b> ${r.linhas.length}${r.temGps?' · limitado ao recolhido em GPS':' · <span class="tag warn">sem extrato de GPS: teto não conferido</span>'}
      ${!temBase?'<br><span class="tag warn">Falta a folha por rubrica: sem ela não há base de cálculo</span>':''}
      <br><span class="mini">${esc(r.base)}. Estimativa para decisão; o valor final depende da conferência com as folhas, GFIP/eSocial e guias.</span></div>
    <div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Ano</th><th>Nominal</th><th>Atualizado</th></tr></thead><tbody>${Object.entries(r.porAno).map(([a,v])=>`<tr><td>${a}</td><td>${rs(v.nominal)}</td><td>${rs(v.atualizado)}</td></tr>`).join('')}</tbody></table></div>
    ${r.alertas.length?`<details style="margin-top:6px"><summary>${r.alertas.length} alerta(s)</summary><ul class="mini">${r.alertas.slice(0,60).map(a=>`<li>${esc(mb(a.mes))} · ${esc(a.tipo)}: ${esc(a.texto)}</li>`).join('')}${r.alertas.length>60?'<li>…</li>':''}</ul></details>`:''}
    <div class="row" style="margin-top:8px"><button type="button" class="btn" data-acao="folhaCsv">Baixar memória de cálculo (CSV)</button><button type="button" class="btn ghost" data-acao="folhaResumo">Copiar resumo</button><button type="button" class="btn ghost" data-acao="folhaLimpar">Limpar dados da folha</button></div>`:''}
    ${rub.length?`<details style="margin-top:8px"${sem.length?' open':''}><summary>Rubricas: ${cls.length} com verba, ${sem.length} maiores sem verba (revise)</summary><p class="mini">A classificação automática é por palavra-chave. Corrija aqui; a escolha vale para os próximos arquivos deste cliente${folhaMem[c.id]?'':' (para recalcular agora, importe a folha de novo)'}.</p>
      <div class="tablewrap"><table style="min-width:620px"><thead><tr><th>Código</th><th>Rubrica</th><th>Total no arquivo</th><th>Verba</th></tr></thead><tbody>${cls.concat(sem).map(linRub).join('')}</tbody></table></div></details>`:''}
  </details>`;
}
async function folhaChange(c,el){
  const F=folhaEstado(c); let acao='atualizou recuperação pela folha', det='';
  try{
    if(el.dataset.folhaarq){ const f=el.files&&el.files[0]; if(!f) return; const txt=RecFolha.decodificar(await f.arrayBuffer());
      if(el.dataset.folhaarq==='folha'){ const x=RecFolha.lerFolha(txt,F.codigos); folhaMem[c.id]=x.rubricas; F.bases=RecFolha.bases(x.rubricas); F.rubricas=RecFolha.compactar(x.rubricas);
        acao='importou folha por rubrica'; det=`${f.name} · ${x.rubricas.length} rubricas`; if(x.erros.length) toast(x.erros.length+' linha(s) ignoradas: '+x.erros[0]); }
      else { F.gps=RecFolha.lerGps(txt); acao='importou extrato de GPS'; det=`${f.name} · ${Object.keys(F.gps).length} competências`; } }
    else if(el.dataset.folhav){ F.status[el.dataset.folhav]=el.value; det=`${el.dataset.folhav}: ${el.value}`; }
    else if(el.dataset.folhacod!==undefined){ F.codigos=Object.assign({},F.codigos,{[el.dataset.folhacod]:el.value}); det=`rubrica ${el.dataset.folhacod} → ${el.value}`;
      const m=folhaMem[c.id]; if(m){ m.forEach(r=>Object.assign(r,RecFolha.classificar(r.descricao,r.codigo,F.codigos))); F.bases=RecFolha.bases(m); F.rubricas=RecFolha.compactar(m); }
      else toast('Classificação guardada. Importe a folha de novo para recalcular.'); }
    else if(el.dataset.folha){ const k=el.dataset.folha, v=el.value; det=k;
      if(k==='perfil'){ const n=RecFolha.padrao(v); F.perfil=v; F.status=n.status; if(!F.inicio||v==='empresa') F.inicio=n.inicio; }
      else if(k==='inicio'||k==='fim') F[k]=v.trim()?RecFolha.comp(v):'';
      else if(k==='patronal') F.patronal=numBR(v);
      else if(k==='ratPadrao') F.rat=Object.assign({},RecFolha.porAno(F.ratTxt),{padrao:numBR(v)});
      else if(k==='ratTxt'){ F.ratTxt=v; F.rat=Object.assign({padrao:F.rat.padrao},RecFolha.porAno(v)); }
      else if(k==='fapPadrao') F.fap=Object.assign({},RecFolha.porAno(F.fapTxt),{padrao:numBR(v)||1});
      else if(k==='fapTxt'){ F.fapTxt=v; F.fap=Object.assign({padrao:F.fap.padrao},RecFolha.porAno(v)); }
      else if(k==='gpsTxt'){ F.gps=RecFolha.lerGps(v); acao='colou extrato de GPS'; det=Object.keys(F.gps).length+' competências'; }
      else if(k==='mesComp') F.mesComp=v; }
    c.folha=F; salvarCliente(c,acao,det);
  }catch(err){ toast('Não foi possível ler: '+(err&&err.message||err)); }
  if(typeof renderRec==='function') renderRec();
}
async function folhaClick(c,acao){
  const F=folhaEstado(c), r=RecFolha.calcular(F.bases||{},F.gps||{},F);
  if(acao==='folhaCsv'){ const t=RecFolha.csv(r); await salvarArquivo(nomeArq('Memoria_folha',c)+'.csv',new Blob(['﻿'+t],{type:'text/csv;charset=utf-8'}),()=>t,'Memória de cálculo da folha'); return; }
  if(acao==='folhaResumo'){ const V=RecFolha.VERBAS; copyText(`Recuperação pela folha · ${c.cad.nome||''}\nIndébito (entra no total): ${rs(r.total.nominal)} · atualizado ${rs(r.total.atualizado)}\nA aprovar: ${rs(r.total.pendente)} · atualizado ${rs(r.total.pendenteAtualizado)}\nCompetências: ${r.linhas.length}${r.temGps?' (limitado ao GPS)':' (sem extrato de GPS)'}\n${V.map(v=>`- ${v.nome}: ${F.status[v.id]} · base ${rs(r.basesVerba[v.id])}`).join('\n')}\n${r.base}. Estimativa sujeita à conferência documental e à aprovação do advogado.`,'Resumo copiado'); return; }
  if(acao==='folhaLimpar'){ delete folhaMem[c.id]; c.folha=Object.assign(folhaEstado(c),{bases:{},gps:{},rubricas:[]}); salvarCliente(c,'limpou dados da folha'); if(typeof renderRec==='function') renderRec(); }
}
function renderPresc(c){'''

s = troca(s, 'function renderPresc(c){', RENDER)
s = troca(s, '${renderSeg(c)}${renderPresc(c)}</section>', '${renderSeg(c)}${renderPresc(c)}${renderFolha(c)}</section>')
s = troca(s, "function cliChange(e){ const c=cliAtual(); if(!c) return; const el=e.target;\n",
          "function cliChange(e){ const c=cliAtual(); if(!c) return; const el=e.target;\n  if(el.dataset.folha!==undefined||el.dataset.folhav||el.dataset.folhacod!==undefined||el.dataset.folhaarq){ folhaChange(c,el); return; }\n")
s = troca(s, "function cliClick(e){ const c=cliAtual(); if(!c) return; const b=e.target.closest('button'); if(!b) return;",
          "function cliClick(e){ const c=cliAtual(); if(!c) return; const b=e.target.closest('button'); if(!b) return;\n  if(b.dataset.acao&&b.dataset.acao.startsWith('folha')){ folhaClick(c,b.dataset.acao); return; }")
open(p, 'w', encoding='utf-8').write(s); print('[ok] painel da folha aplicado em', p)
