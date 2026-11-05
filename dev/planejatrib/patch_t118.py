#!/usr/bin/env python3
"""PlanejaTrib RD — painel "ISS fora da base do PIS/Cofins (Tema 118)" na aba Recuperação (05/11/2026).
Requer patch_numeros.py, patch_folha.py e patch_nfse_iss.py aplicados."""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
def troca(s, a, b):
    n = s.count(a)
    if n != 1: sys.exit(f'[erro] trecho encontrado {n} vezes: {a[:90]}')
    return s.replace(a, b)
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
if 'root.Tema118 = API' in s: sys.exit('[ok] já aplicado')
if 'root.RecFolha = API' not in s or 'issRetido:' not in s: sys.exit('[erro] aplique antes patch_folha.py e patch_nfse_iss.py')
mod = open(os.path.join(AQUI, 'tema118.js'), encoding='utf-8').read()
i = s.find('<script', s.find('root.RecFolha = API')); s = s[:i] + '<script>\n' + mod + '\n</script>\n' + s[i:]
RENDER = r'''function renderT118(c){
  const V=Object.assign({issMes:{},pcMes:{},notas:0,mesComp:'',regime:'cum'},c.t118||{}), tem=Object.keys(V.issMes).length>0;
  const r=tem?Tema118.calcular(V.issMes,V.pcMes,{mesComp:V.mesComp||undefined,regime:V.regime}):null, mb=k=>k?k.split('-').reverse().join('/'):'';
  const rs=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), cls={prescrito:'tag bad','vence em até 90 dias':'tag warn','no prazo':'tag'};
  return `<details class="tool"${tem?' open':''}><summary>ISS fora da base do PIS/Cofins (Tema 118/STF)</summary>
    <p class="mini" style="margin-top:6px">Importe as NFS-e (XML ou ZIP) e a EFD-Contribuições (TXT ou ZIP) dos últimos 60 meses. O ISS de cada nota entra na competência; a EFD dá o regime e o teto do mês. Julgado em 21/10/2026, com modulação pendente: o cenário B mostra o que sobra se o STF cortar na data do julgamento.</p>
    <div class="form2"><label>Arquivos (NFS-e e EFD)<input type="file" multiple accept=".xml,.txt,.zip" data-t118arq="1"></label>
      <label>Mês previsto da compensação<input type="month" data-t118="mesComp" value="${esc(V.mesComp||'')}"></label>
      <label>Regime sem EFD no mês<select data-t118="regime"><option value="cum"${V.regime==='cum'?' selected':''}>cumulativo (3,65%)</option><option value="ncum"${V.regime==='ncum'?' selected':''}>não cumulativo (9,25%)</option></select></label></div>
    ${r?`<div class="retres"><b>A. Sem modulação:</b> indébito ${rs(r.total.indebito)} · atualizado ${rs(r.total.atualizado)} · ISS no período ${rs(r.total.iss)} (${V.notas} NFS-e, ${Object.keys(V.pcMes).length} EFD)
      <br><b>B. Corte em ${mb(r.cenarioCorte.corte)}:</b> ${rs(r.cenarioCorte.indebito)} · atualizado ${rs(r.cenarioCorte.atualizado)}
      ${r.total.prescrito?`<br><b>Já prescrito:</b> ${rs(r.total.prescrito)}`:''}
      ${r.urgentes.length?`<br><span class="tag bad">Prescrição: ${r.urgentes.map(l=>`${mb(l.mes)} vence em ${mb(l.prescreve)}`).join('; ')}. Ajuizar antes.</span>`:''}
      <br><span class="mini">${esc(r.base)}. Estimativa; o valor depende da conferência com os DARF pagos.</span></div>
      <div class="tablewrap" style="margin-top:8px"><table style="min-width:640px"><thead><tr><th>Competência</th><th>ISS</th><th>Indébito</th><th>Prescreve em</th><th>Situação</th><th>Atualizado</th></tr></thead><tbody>${r.linhas.map(l=>`<tr><td>${mb(l.mes)}</td><td>${rs(l.iss)}</td><td>${rs(l.indebito)}</td><td>${l.prescreve.split('-').reverse().join('/')}</td><td><span class="${cls[l.situacao]}">${l.situacao}</span></td><td>${rs(l.atualizado)}</td></tr>`).join('')}</tbody></table></div>
      ${r.alertas.length?`<details style="margin-top:6px"><summary>${r.alertas.length} alerta(s)</summary><ul class="mini">${r.alertas.slice(0,40).map(a=>`<li>${mb(a.mes)}: ${esc(a.texto)}</li>`).join('')}</ul></details>`:''}
      <div class="row" style="margin-top:8px"><button type="button" class="btn" data-acao="t118Csv">Baixar memória (CSV)</button><button type="button" class="btn ghost" data-acao="t118Limpar">Limpar</button></div>`:''}
  </details>`;
}
async function t118Change(c,el){
  const V=Object.assign({issMes:{},pcMes:{},notas:0,mesComp:'',regime:'cum'},c.t118||{});
  try{
    if(el.dataset.t118arq){ const txts=await textosDosArquivos([...el.files]); const docs=txts.map(t=>window.Leitor.lerTexto(t)); const x=Tema118.deDocs(docs);
      const raiz=v=>String(v||'').replace(/\D/g,'').slice(0,8); if(raiz(c.cad.cnpj)&&raiz(x.cnpj)&&raiz(c.cad.cnpj)!==raiz(x.cnpj)){ toast('As NFS-e são do CNPJ '+x.cnpj+', diferente do cliente.'); return; }
      Object.assign(V.issMes,x.issMes); Object.assign(V.pcMes,x.pcMes); V.notas+=x.notas; c.t118=V; salvarCliente(c,'importou NFS-e/EFD para o Tema 118',`${x.notas} NFS-e, ${Object.keys(x.pcMes).length} EFD`); }
    else if(el.dataset.t118){ V[el.dataset.t118]=el.value; c.t118=V; salvarCliente(c,'atualizou Tema 118',el.dataset.t118); }
  }catch(err){ toast('Não foi possível ler: '+(err&&err.message||err)); }
  if(typeof renderRec==='function') renderRec();
}
async function t118Click(c,acao){
  const V=c.t118||{}; if(acao==='t118Limpar'){ delete c.t118; salvarCliente(c,'limpou Tema 118'); if(typeof renderRec==='function') renderRec(); return; }
  const r=Tema118.calcular(V.issMes||{},V.pcMes||{},{mesComp:V.mesComp||undefined,regime:V.regime}), t=Tema118.csv(r);
  await salvarArquivo(nomeArq('Tema118_ISS_PIS_Cofins',c)+'.csv',new Blob(['﻿'+t],{type:'text/csv;charset=utf-8'}),()=>t,'Memória do Tema 118');
}
function renderFolha(c){'''
s = troca(s, 'function renderFolha(c){', RENDER)
s = troca(s, '${renderPresc(c)}${renderFolha(c)}</section>', '${renderPresc(c)}${renderT118(c)}${renderFolha(c)}</section>')
s = troca(s, "  if(el.dataset.folha!==undefined||el.dataset.folhav", "  if(el.dataset.t118!==undefined||el.dataset.t118arq){ t118Change(c,el); return; }\n  if(el.dataset.folha!==undefined||el.dataset.folhav")
s = troca(s, "  if(b.dataset.acao&&b.dataset.acao.startsWith('folha'))", "  if(b.dataset.acao&&b.dataset.acao.startsWith('t118')){ t118Click(c,b.dataset.acao); return; }\n  if(b.dataset.acao&&b.dataset.acao.startsWith('folha'))")
open(p, 'w', encoding='utf-8').write(s); print('[ok] painel do Tema 118 aplicado em', p)
