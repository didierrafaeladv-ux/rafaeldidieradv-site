/* Recuperação de contribuição previdenciária patronal sobre verbas da folha — PlanejaTrib RD (v1.0, 04/11/2026).
 * Porta para o navegador o robô robo_previdenciario.py (dev/recuperacao_previdenciaria).
 * Entrada: folha por rubrica (competência; código; descrição; valor; vínculo), extrato de GPS do e-CAC e parâmetros.
 * Indébito = base da verba × (patronal + RAT × FAP), limitado ao recolhido em GPS na competência quando o extrato é informado;
 * atualização pela Selic do mês seguinte ao pagamento até o mês anterior à compensação, + 1% (Lei 8.212/1991, art. 89, § 4º).
 * Regra de ouro do escritório: a máquina aponta; a verba só entra no total com o status "entra", definido pelo advogado. */
(function (root) {
  'use strict';
  const numBR = root.numBR || (v => { const x = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return isFinite(x) ? x : 0; });
  // Selic mensal, Banco Central, série SGS 4390 (consulta de 03/11/2026)
  const SELIC = {'2005-11': 1.38, '2005-12': 1.47, '2006-01': 1.43, '2006-02': 1.15, '2006-03': 1.42, '2006-04': 1.08, '2006-05': 1.28, '2006-06': 1.18, '2006-07': 1.17, '2006-08': 1.26, '2006-09': 1.06, '2006-10': 1.09, '2006-11': 1.02, '2006-12': 0.99, '2007-01': 1.08, '2007-02': 0.87, '2007-03': 1.05, '2007-04': 0.94, '2007-05': 1.03, '2007-06': 0.91, '2007-07': 0.97, '2007-08': 0.99, '2007-09': 0.80, '2007-10': 0.93, '2007-11': 0.84, '2007-12': 0.84, '2008-01': 0.93, '2008-02': 0.80, '2008-03': 0.84, '2008-04': 0.90, '2008-05': 0.88, '2008-06': 0.96, '2008-07': 1.07, '2008-08': 1.02, '2008-09': 1.10, '2008-10': 1.18, '2008-11': 1.02, '2008-12': 1.12, '2009-01': 1.05, '2009-02': 0.86, '2009-03': 0.97, '2009-04': 0.84, '2009-05': 0.77, '2009-06': 0.76, '2009-07': 0.79, '2009-08': 0.69, '2009-09': 0.69, '2009-10': 0.69, '2009-11': 0.66, '2009-12': 0.73, '2010-01': 0.66, '2010-02': 0.59, '2010-03': 0.76, '2010-04': 0.67, '2010-05': 0.75, '2010-06': 0.79, '2010-07': 0.86, '2010-08': 0.89, '2010-09': 0.85, '2010-10': 0.81, '2010-11': 0.81, '2010-12': 0.93, '2011-01': 0.86, '2011-02': 0.84, '2011-03': 0.92, '2011-04': 0.84, '2011-05': 0.99, '2011-06': 0.96, '2011-07': 0.97, '2011-08': 1.07, '2011-09': 0.94, '2011-10': 0.88, '2011-11': 0.86, '2011-12': 0.91, '2012-01': 0.89, '2012-02': 0.75, '2012-03': 0.82, '2012-04': 0.71, '2012-05': 0.74, '2012-06': 0.64, '2012-07': 0.68, '2012-08': 0.69, '2012-09': 0.54, '2012-10': 0.61, '2012-11': 0.55, '2012-12': 0.55, '2013-01': 0.60, '2013-02': 0.49, '2013-03': 0.55, '2013-04': 0.61, '2013-05': 0.60, '2013-06': 0.61, '2013-07': 0.72, '2013-08': 0.71, '2013-09': 0.71, '2013-10': 0.81, '2013-11': 0.72, '2013-12': 0.79, '2014-01': 0.85, '2014-02': 0.79, '2014-03': 0.77, '2014-04': 0.82, '2014-05': 0.87, '2014-06': 0.82, '2014-07': 0.95, '2014-08': 0.87, '2014-09': 0.91, '2014-10': 0.95, '2014-11': 0.84, '2014-12': 0.96, '2015-01': 0.94, '2015-02': 0.82, '2015-03': 1.04, '2015-04': 0.95, '2015-05': 0.99, '2015-06': 1.07, '2015-07': 1.18, '2015-08': 1.11, '2015-09': 1.11, '2015-10': 1.11, '2015-11': 1.06, '2015-12': 1.16, '2016-01': 1.06, '2016-02': 1.00, '2016-03': 1.16, '2016-04': 1.06, '2016-05': 1.11, '2016-06': 1.16, '2016-07': 1.11, '2016-08': 1.22, '2016-09': 1.11, '2016-10': 1.05, '2016-11': 1.04, '2016-12': 1.12, '2017-01': 1.09, '2017-02': 0.87, '2017-03': 1.05, '2017-04': 0.79, '2017-05': 0.93, '2017-06': 0.81, '2017-07': 0.80, '2017-08': 0.80, '2017-09': 0.64, '2017-10': 0.64, '2017-11': 0.57, '2017-12': 0.54, '2018-01': 0.58, '2018-02': 0.47, '2018-03': 0.53, '2018-04': 0.52, '2018-05': 0.52, '2018-06': 0.52, '2018-07': 0.54, '2018-08': 0.57, '2018-09': 0.47, '2018-10': 0.54, '2018-11': 0.49, '2018-12': 0.49, '2019-01': 0.54, '2019-02': 0.49, '2019-03': 0.47, '2019-04': 0.52, '2019-05': 0.54, '2019-06': 0.47, '2019-07': 0.57, '2019-08': 0.50, '2019-09': 0.46, '2019-10': 0.48, '2019-11': 0.38, '2019-12': 0.37, '2020-01': 0.38, '2020-02': 0.29, '2020-03': 0.34, '2020-04': 0.28, '2020-05': 0.24, '2020-06': 0.21, '2020-07': 0.19, '2020-08': 0.16, '2020-09': 0.16, '2020-10': 0.16, '2020-11': 0.15, '2020-12': 0.16, '2021-01': 0.15, '2021-02': 0.13, '2021-03': 0.20, '2021-04': 0.21, '2021-05': 0.27, '2021-06': 0.31, '2021-07': 0.36, '2021-08': 0.43, '2021-09': 0.44, '2021-10': 0.49, '2021-11': 0.59, '2021-12': 0.77, '2022-01': 0.73, '2022-02': 0.76, '2022-03': 0.93, '2022-04': 0.83, '2022-05': 1.03, '2022-06': 1.02, '2022-07': 1.03, '2022-08': 1.17, '2022-09': 1.07, '2022-10': 1.02, '2022-11': 1.02, '2022-12': 1.12, '2023-01': 1.12, '2023-02': 0.92, '2023-03': 1.17, '2023-04': 0.92, '2023-05': 1.12, '2023-06': 1.07, '2023-07': 1.07, '2023-08': 1.14, '2023-09': 0.97, '2023-10': 1.00, '2023-11': 0.92, '2023-12': 0.89, '2024-01': 0.97, '2024-02': 0.80, '2024-03': 0.83, '2024-04': 0.89, '2024-05': 0.83, '2024-06': 0.79, '2024-07': 0.91, '2024-08': 0.87, '2024-09': 0.84, '2024-10': 0.93, '2024-11': 0.79, '2024-12': 0.93, '2025-01': 1.01, '2025-02': 0.99, '2025-03': 0.96, '2025-04': 1.06, '2025-05': 1.14, '2025-06': 1.10, '2025-07': 1.28, '2025-08': 1.16, '2025-09': 1.22, '2025-10': 1.28, '2025-11': 1.05, '2025-12': 1.22, '2026-01': 1.16, '2026-02': 1.00, '2026-03': 1.21, '2026-04': 1.09, '2026-05': 1.07, '2026-06': 1.12, '2026-07': 1.22, '2026-08': 1.09, '2026-09': 1.08, '2026-10': 1.07};
  const SELIC_ATE = '2026-10';
  // Catálogo de verbas. perfil "empresa": situação nos tribunais superiores (conferir antes de ofertar); perfil "titulo": o que o título judicial do cliente decidir.
  const VERBAS = [
    { id: 'quinze', curto: '15 dias de afastamento', nome: '15 primeiros dias de afastamento por doença ou acidente', empresa: 'entra',
      fundamento: 'STJ, Tema 738 (REsp 1.230.957/RS): não incide', palavras: ['15 (primeiros )?dias', 'quinze (primeiros )?dias', 'aux(ilio)? ?doenca', 'aux(ilio)? ?acidente', 'afastamento.{0,15}(doenca|acidente)', 'atestado medico'] },
    { id: 'aviso', curto: 'Aviso prévio indenizado', nome: 'Aviso prévio indenizado', empresa: 'entra',
      fundamento: 'STJ, Tema 478 (REsp 1.230.957/RS): não incide', excluir: ['trabalhad'], palavras: ['aviso prev(io)? ?(indeniz|ind\\b)', 'aviso previo$', '\\bapi\\b'] },
    { id: 'salmat', curto: 'Salário-maternidade', nome: 'Salário-maternidade', empresa: 'entra',
      fundamento: 'STF, Tema 72 (RE 576.967/PR): inconstitucional a contribuição patronal', palavras: ['sal(ario)? ?matern', 'licenca.{0,3}matern', 'lic ?gestante'] },
    { id: 'fundeb', curto: 'Rateio FUNDEF/FUNDEB', nome: 'Rateio de sobras do FUNDEF/FUNDEB com professores', empresa: 'fora',
      fundamento: 'Só com título judicial próprio (ex.: MS coletivo APRECE 0001242-10.2010.4.05.8102)', palavras: ['rateio', 'sobra.{0,20}fund(ef|eb)', 'abono.{0,20}fund(ef|eb)', 'fund(ef|eb).{0,20}(abono|rateio)'] },
    { id: 'terco', curto: '1/3 de férias', nome: 'Adicional de 1/3 de férias gozadas', empresa: 'fora',
      fundamento: 'STF, Tema 985 (RE 1.072.485/PR): incide; só para conferência', palavras: ['1/3 (de |das )?ferias', 'um terco', 'terco (constitucional|de ferias|ferias)', 'adicional (de )?ferias', 'abono (constitucional )?(de )?ferias'] }
  ];
  const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_.,;:()\[\]]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const RX = VERBAS.map(v => ({ id: v.id, p: v.palavras.map(x => new RegExp(x)), e: (v.excluir || []).map(x => new RegExp(x)) }));
  function classificar(descricao, codigo, codigos) {
    const cod = String(codigo || '').trim();
    const d = norm(descricao), kd = 'd:' + d;
    if (cod && codigos && codigos[cod]) return { verba: codigos[cod] === '-' ? '' : codigos[cod], motivo: 'código ' + cod + ' (definido pelo advogado)' };
    if (codigos && codigos[kd]) return { verba: codigos[kd] === '-' ? '' : codigos[kd], motivo: 'definido pelo advogado' };
    for (const r of RX) { if (r.e.some(x => x.test(d))) continue; const h = r.p.find(x => x.test(d)); if (h) return { verba: r.id, motivo: 'palavra-chave' }; }
    return { verba: '', motivo: '' };
  }
  function comp(v) {
    const s = String(v || '').trim(); let m;
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return m[2] + '-' + m[1].padStart(2, '0');
    if ((m = s.match(/^(\d{4})-?(\d{2})$/))) return m[1] + '-' + m[2];
    return '';
  }
  const linhas = txt => String(txt || '').split(/\r?\n/).map(l => l.split(/[;\t]/).map(x => x.trim())).filter(c => c.some(Boolean));
  // folha: competência; código; descrição; valor; [vínculo]. Cabeçalho é ignorado. Agrega por rubrica.
  function lerFolha(txt, codigos) {
    const rub = {}, erros = [];
    linhas(txt).forEach((c, i) => {
      const k = comp(c[0]); if (!k) { if (i > 0) erros.push('linha ' + (i + 1) + ': competência inválida'); return; }
      const codigo = c[1] || '', desc = c[2] || '', valor = numBR(c[3]), vinc = (c[4] || 'RGPS').toUpperCase();
      const chave = (codigo || '') + '|' + norm(desc);
      const r = rub[chave] = rub[chave] || { codigo, descricao: desc, vinculo: vinc, total: 0, meses: {} };
      if (vinc === 'RPPS') r.vinculo = 'RPPS';
      r.total += valor; r.meses[k] = (r.meses[k] || 0) + (vinc === 'RPPS' ? 0 : valor);
    });
    const lista = Object.values(rub).map(r => Object.assign(r, classificar(r.descricao, r.codigo, codigos)));
    return { rubricas: lista, erros };
  }
  // extrato do e-CAC copiado ou exportado: competência na 1ª coluna, valor recolhido = última coluna numérica
  function lerGps(txt) {
    const out = {};
    linhas(txt).forEach(c => { const k = comp(c[0]); if (!k) return; const v = c.slice(1).filter(x => /\d/.test(x) && /[.,]\d{2}$/.test(x)).pop(); if (v !== undefined) out[k] = (out[k] || 0) + numBR(v); });
    return out;
  }
  // bases por competência e verba (só RGPS); é o que se guarda no cliente, sem a folha bruta
  function bases(rubricas) {
    const b = {};
    rubricas.forEach(r => { if (!r.verba || r.vinculo === 'RPPS') return; for (const [k, v] of Object.entries(r.meses)) { b[k] = b[k] || {}; b[k][r.verba] = (b[k][r.verba] || 0) + v; } });
    return b;
  }
  function mesPagamento(c) { const [a, m] = c.split('-').map(Number); return m === 13 ? [a, 12] : [a + (m === 12 ? 1 : 0), m === 12 ? 1 : m + 1]; }
  const soma = ([a, m], n) => { const t = a * 12 + (m - 1) + n; return [Math.floor(t / 12), t % 12 + 1]; };
  const chave = ([a, m]) => a + '-' + String(m).padStart(2, '0');
  function selicAcumulada(c, mesComp, tabela) {
    const T = tabela || SELIC; let am = soma(mesPagamento(c), 1); const fim = soma(mesComp.split('-').map(Number), -1); let pct = 0; const faltam = [];
    while (am[0] * 12 + am[1] <= fim[0] * 12 + fim[1]) { const k = chave(am); if (T[k] === undefined) faltam.push(k); else pct += T[k]; am = soma(am, 1); }
    return { pct: Math.round((pct + 1) * 100) / 100, faltam };
  }
  const r2 = v => Math.round((+v || 0) * 100) / 100;
  // p: { inicio, fim, mesComp, patronal, rat:{padrao, 'AAAA':x}, fap:{padrao,'AAAA':x}, status:{verba:'entra'|'pendente'|'fora'} }
  function calcular(base, gps, p) {
    const st = id => (p.status && p.status[id]) || 'fora', temGps = gps && Object.keys(gps).length > 0;
    const ratA = a => (p.rat && (p.rat[a] !== undefined ? p.rat[a] : p.rat.padrao)) || 0, fapA = a => (p.fap && (p.fap[a] !== undefined ? p.fap[a] : p.fap.padrao)) || 1;
    const meses = [...new Set(Object.keys(base).concat(temGps ? Object.keys(gps) : []))].filter(k => (!p.inicio || k >= p.inicio) && (!p.fim || k <= p.fim)).sort();
    const alertas = [], linhasOut = [];
    for (const k of meses) {
      const a = k.slice(0, 4), aliq = (p.patronal || 20) + ratA(a) * fapA(a), b = base[k] || {};
      const porVerba = {}; VERBAS.forEach(v => porVerba[v.id] = r2(b[v.id] || 0));
      const entra = VERBAS.filter(v => st(v.id) === 'entra').reduce((s, v) => s + porVerba[v.id], 0);
      const pend = VERBAS.filter(v => st(v.id) === 'pendente').reduce((s, v) => s + porVerba[v.id], 0);
      const nominal = r2(entra * aliq / 100), pendNom = r2(pend * aliq / 100), rec = temGps ? (gps[k] || 0) : null;
      const limitado = rec === null ? nominal : Math.min(nominal, rec);
      const pendente = rec === null ? pendNom : Math.min(pendNom, Math.max(0, rec - limitado));   // o que está a aprovar também cabe no recolhido
      if (rec !== null && nominal > rec + 0.005) alertas.push({ mes: k, tipo: 'teto', texto: 'indébito calculado maior que o recolhido em GPS; limitado ao recolhido' });
      if (rec !== null && entra > 0 && !gps[k]) alertas.push({ mes: k, tipo: 'sem GPS', texto: 'verbas na folha, mas sem recolhimento no extrato' });
      if (temGps && gps[k] && !base[k]) alertas.push({ mes: k, tipo: 'sem folha', texto: 'GPS sem folha informada para a competência' });
      const s = selicAcumulada(k, p.mesComp);
      if (s.faltam.length) alertas.push({ mes: k, tipo: 'Selic', texto: 'Selic ausente para ' + s.faltam.slice(0, 3).join(', ') + (s.faltam.length > 3 ? '…' : '') });
      linhasOut.push({ mes: k, porVerba, aliq: r2(aliq * 100) / 100, nominal, pendente: r2(pendente), recolhido: rec, limitado: r2(limitado), selic: s.pct, atualizado: r2(limitado * (1 + s.pct / 100)), pendenteAtualizado: r2(pendente * (1 + s.pct / 100)) });
    }
    const tot = f => r2(linhasOut.reduce((x, l) => x + l[f], 0));
    const porAno = {}; linhasOut.forEach(l => { const a = l.mes.slice(0, 4); porAno[a] = porAno[a] || { nominal: 0, atualizado: 0 }; porAno[a].nominal = r2(porAno[a].nominal + l.limitado); porAno[a].atualizado = r2(porAno[a].atualizado + l.atualizado); });
    const basesVerba = {}; VERBAS.forEach(v => basesVerba[v.id] = r2(linhasOut.reduce((x, l) => x + l.porVerba[v.id], 0)));
    return { linhas: linhasOut, alertas, porAno, basesVerba, total: { nominal: tot('limitado'), atualizado: tot('atualizado'), pendente: tot('pendente'), pendenteAtualizado: tot('pendenteAtualizado') }, temGps,
      base: 'Lei 8.212/1991, art. 22, I e II (20% + RAT × FAP); art. 89, § 4º (Selic + 1%); Selic do Banco Central, série 4390, até ' + SELIC_ATE };
  }
  function csv(res) {
    const br = v => (v === null || v === undefined) ? '' : String(v.toFixed ? v.toFixed(2) : v).replace('.', ',');
    const cab = ['Competência'].concat(VERBAS.map(v => 'Base ' + v.curto), ['Alíquota (%)', 'Indébito nominal', 'GPS recolhido', 'Indébito limitado', 'Selic acumulada (%)', 'Indébito atualizado', 'Pendente (nominal)']);
    return [cab.join(';')].concat(res.linhas.map(l => [l.mes.split('-').reverse().join('/')].concat(VERBAS.map(v => br(l.porVerba[v.id])), [br(l.aliq), br(l.nominal), br(l.recolhido), br(l.limitado), br(l.selic), br(l.atualizado), br(l.pendente)]).join(';'))).join('\n');
  }
  function padrao(perfil, hojeISO) {
    const h = (hojeISO || new Date().toISOString()).slice(0, 7), [a, m] = h.split('-').map(Number);
    const status = {}; VERBAS.forEach(v => status[v.id] = perfil === 'titulo' ? 'pendente' : (v.empresa === 'entra' ? 'pendente' : 'fora'));   // nada entra no total sem o advogado
    return { perfil: perfil || 'empresa', inicio: perfil === 'titulo' ? '' : chave(soma([a, m], -60)), fim: '', mesComp: chave(soma([a, m], 1)), patronal: 20, rat: { padrao: 2 }, fap: { padrao: 1 }, status, codigos: {}, bases: {}, gps: {}, rubricas: [] };
  }
  const chaveRub = r => r.codigo ? String(r.codigo).trim() : 'd:' + norm(r.descricao);
  // o que se guarda no cliente: todas as rubricas classificadas e as 40 maiores sem verba (para o advogado revisar)
  function compactar(rubricas) {
    const c = r => ({ k: chaveRub(r), codigo: r.codigo, descricao: r.descricao, verba: r.verba, motivo: r.motivo, vinculo: r.vinculo, total: r2(r.total) });
    return rubricas.filter(r => r.verba).map(c).concat(rubricas.filter(r => !r.verba).sort((a, b) => b.total - a.total).slice(0, 40).map(c));
  }
  // "2005-2009=1; 2010=2" → { 2005: 1, ..., 2009: 1, 2010: 2 }
  function porAno(txt) { const o = {}; String(txt || '').split(/[;\n]/).forEach(p => { const m = p.trim().match(/^(\d{4})(?:\s*-\s*(\d{4}))?\s*=\s*([\d.,]+)$/); if (!m) return; for (let a = +m[1]; a <= +(m[2] || m[1]); a++) o[a] = numBR(m[3]); }); return o; }
  // CSV do Excel brasileiro costuma vir em Windows-1252
  function decodificar(buf) { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); } }
  const API = { chaveRub, compactar, porAno, decodificar, VERBAS, SELIC, SELIC_ATE, norm, classificar, comp, lerFolha, lerGps, bases, mesPagamento, selicAcumulada, calcular, csv, padrao, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RecFolha = API;
})(typeof window !== 'undefined' ? window : globalThis);
