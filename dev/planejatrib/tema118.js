/* Tema 118/STF — ISS fora da base do PIS e da Cofins — PlanejaTrib RD (v1.0, 05/11/2026).
 * Entrada: ISS por competência (das NFS-e) e, se houver, PIS/Cofins devidos e regime por competência (da EFD-Contribuições).
 * Indébito do mês = ISS × (0,65% + 3%) no cumulativo ou × (1,65% + 7,6%) no não cumulativo, limitado ao PIS + Cofins do mês.
 * Prescrição: 5 anos do pagamento, considerado no dia 25 do mês seguinte (CTN, art. 168, I; LC 118/2005, art. 3º).
 * Atualização: Selic do mês seguinte ao pagamento até o anterior à compensação, + 1% (Lei 9.250/1995, art. 39, § 4º).
 * STF julgou em 21/10/2026 (6 x 5); a modulação está pendente: o cenário B mostra o efeito de um corte na data do julgamento. */
(function (root) {
  'use strict';
  const r2 = v => Math.round((+v || 0) * 100) / 100;
  const soma = (k, n) => { let [a, m] = k.split('-').map(Number); const t = a * 12 + m - 1 + n; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); };
  const ALIQ = { cum: { pis: 0.65, cofins: 3 }, ncum: { pis: 1.65, cofins: 7.6 } };
  // documentos lidos pelo Leitor → { issMes, pcMes }
  function deDocs(docs) {
    const issMes = {}, pcMes = {}; let notas = 0, cnpj = '';
    for (const d of docs || []) {
      if (d.tipo === 'nfse' && d.v > 0) { const k = d.competencia || d.mes; if (!k) continue; issMes[k] = r2((issMes[k] || 0) + (+d.iss || 0)); notas++; if (!cnpj && d.emit) cnpj = d.emit.cnpj || ''; }
      else if (d.tipo === 'efd-contrib' && d.mes) pcMes[d.mes] = { pis: r2(d.pis), cofins: r2(d.cofins), receita: r2(d.receita), regime: d.regime === '1' ? 'ncum' : 'cum' };
    }
    return { issMes, pcMes, notas, cnpj };
  }
  // p: { hoje 'AAAA-MM-DD', mesComp 'AAAA-MM', regime 'cum'|'ncum' (padrão quando não há EFD), corte 'AAAA-MM-DD' (cenário de modulação) }
  function calcular(issMes, pcMes, p) {
    p = p || {}; const hoje = p.hoje || new Date().toISOString().slice(0, 10), mesComp = p.mesComp || soma(hoje.slice(0, 7), 1), corte = p.corte || '2026-10-21';
    const S = (root.RecFolha && root.RecFolha.SELIC) || {}; const linhas = [], alertas = [];
    for (const k of Object.keys(issMes).sort()) {
      const pc = (pcMes || {})[k], reg = pc ? pc.regime : (p.regime || 'cum'), a = ALIQ[reg], iss = +issMes[k] || 0;
      const pag = soma(k, 1), venc = pag + '-25', lim = (+pag.slice(0, 4) + 5) + pag.slice(4) + '-25';
      const dias = Math.round((new Date(lim + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 864e5);
      const sit = dias < 0 ? 'prescrito' : dias <= 90 ? 'vence em até 90 dias' : 'no prazo';
      let ip = r2(iss * a.pis / 100), ic = r2(iss * a.cofins / 100);
      if (pc && ip + ic > pc.pis + pc.cofins + 0.005) { alertas.push({ mes: k, texto: 'indébito maior que o PIS + Cofins do mês; limitado ao apurado' }); const f = (pc.pis + pc.cofins) / (ip + ic); ip = r2(ip * f); ic = r2(ic * f); }
      if (!pc) alertas.push({ mes: k, texto: 'sem EFD-Contribuições do mês: regime presumido ' + (reg === 'cum' ? 'cumulativo' : 'não cumulativo') + ' e sem teto' });
      if (pc && pc.receita && iss > pc.receita * 0.05) alertas.push({ mes: k, texto: 'ISS acima de 5% da receita da EFD: conferir notas e competência' });
      let sel = 1, falta = []; for (let m = soma(pag, 1); m < mesComp; m = soma(m, 1)) { if (S[m] === undefined) falta.push(m); else sel += S[m]; }
      if (falta.length) alertas.push({ mes: k, texto: 'Selic ainda não carregada para ' + falta.slice(0, 3).join(', ') + (falta.length > 3 ? '…' : '') });
      const ind = r2(ip + ic), vivo = sit !== 'prescrito';
      linhas.push({ mes: k, iss: r2(iss), regime: reg, pis: ip, cofins: ic, indebito: ind, vencimento: venc, prescreve: lim, dias, situacao: sit, selic: r2(sel), atualizado: vivo ? r2(ind * (1 + sel / 100)) : 0, aposCorte: venc >= corte });
    }
    const vivos = linhas.filter(l => l.situacao !== 'prescrito'), t = (L, f) => r2(L.reduce((s, l) => s + l[f], 0));
    return { linhas, alertas, total: { iss: t(vivos, 'iss'), indebito: t(vivos, 'indebito'), atualizado: t(vivos, 'atualizado'), prescrito: t(linhas.filter(l => l.situacao === 'prescrito'), 'indebito') },
      cenarioCorte: { corte, indebito: t(vivos.filter(l => l.aposCorte), 'indebito'), atualizado: t(vivos.filter(l => l.aposCorte), 'atualizado') },
      urgentes: vivos.filter(l => l.situacao !== 'no prazo'), proximo: vivos[0] || null,
      base: 'STF, Tema 118 (RE 592.616), julgado em 21/10/2026, modulação pendente; CTN, art. 168, I; Lei 9.250/1995, art. 39, § 4º' };
  }
  function csv(res) {
    const br = v => String((+v || 0).toFixed(2)).replace('.', ','), mb = k => k.split('-').reverse().join('/');
    return ['Competência;ISS;Regime;PIS indevido;Cofins indevida;Indébito;Vencimento;Prescreve em;Situação;Selic + 1% (%);Atualizado']
      .concat(res.linhas.map(l => [mb(l.mes), br(l.iss), l.regime === 'cum' ? 'cumulativo' : 'não cumulativo', br(l.pis), br(l.cofins), br(l.indebito), mb(l.vencimento), mb(l.prescreve), l.situacao, br(l.selic), br(l.atualizado)].join(';'))).join('\n');
  }
  const API = { deDocs, calcular, csv, ALIQ, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Tema118 = API;
})(typeof window !== 'undefined' ? window : globalThis);
