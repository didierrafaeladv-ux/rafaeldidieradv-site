/* Validação de formato do SPED antes do cálculo — PlanejaTrib RD (v1.0, 03/11/2026).
 * O leitor localiza cada valor pela posição do campo. Se o arquivo vier com campo a mais ou a menos, linha cortada
 * ou número com ponto decimal, o valor sai errado sem aviso. Aqui se confere, para cada registro que o leitor usa,
 * o tipo de cada campo lido (as mesmas posições do leitor) e a integridade do arquivo (registro 9999).
 * Navegador (window.ValidaSped) e node. Sem dependências. */
(function (root) {
  'use strict';
  const T = {
    num: v => v === '' || /^-?\d+(,\d+)?$/.test(v),
    cfop: v => v === '' || /^[1-7]\d{3}$/.test(v),
    cst2: v => /^\d{2}$/.test(v),
    cst3: v => /^\d{3}$/.test(v),
    ncm: v => v === '' || /^\d{8}$/.test(v),
    chave: v => v === '' || /^\d{44}$/.test(v),
    ind01: v => /^[01]$/.test(v),
    tipo2: v => v === '' || /^\d{2}$/.test(v),
    inc: v => /^[123]$/.test(v),
    data: v => { if (!/^\d{8}$/.test(v)) return false; const d = +v.slice(0, 2), m = +v.slice(2, 4), a = +v.slice(4); const x = new Date(Date.UTC(a, m - 1, d)); return x.getUTCDate() === d && x.getUTCMonth() === m - 1 && a >= 2000 && a <= 2100; }
  };
  const ESPERADO = { num: 'número com vírgula decimal, sem ponto (ex.: 1234,56)', cfop: 'CFOP de 4 dígitos', cst2: 'CST de 2 dígitos', cst3: 'CST de 3 dígitos', ncm: 'NCM de 8 dígitos', chave: 'chave de 44 dígitos', ind01: '0 ou 1', tipo2: 'tipo do item com 2 dígitos', inc: '1, 2 ou 3', data: 'data DDMMAAAA' };
  const MOV = { 2: 'cst3', 3: 'cfop', 5: 'num', 7: 'num', 9: 'num' };   // C190, C590, D190: as posições lidas pelo leitor
  const M2 = { 2: 'num', 3: 'num', 4: 'num', 9: 'num', 13: 'num' };
  const ESPEC = {
    'efd-contrib': { '0000': { 6: 'data', 7: 'data' }, '0110': { 2: 'inc' }, '0200': { 7: 'tipo2', 8: 'ncm' }, C100: { 2: 'ind01' },
      C170: { 7: 'num', 8: 'num', 11: 'cfop', 25: 'cst2', 26: 'num', 30: 'num', 36: 'num' }, C175: { 2: 'cfop', 3: 'num', 5: 'cst2', 6: 'num' },
      M100: { 8: 'num' }, M500: { 8: 'num' }, F150: { 9: 'num', 12: 'num' }, M200: M2, M600: M2, M210: { 3: 'num' }, M400: { 2: 'cst2', 3: 'num' } },
    'efd-icms': { '0000': { 4: 'data', 5: 'data' }, '0200': { 7: 'tipo2', 8: 'ncm' }, C100: { 2: 'ind01', 9: 'chave' }, C190: MOV, C590: MOV, D190: MOV,
      E110: { 13: 'num' }, E111: { 4: 'num' }, E210: { 7: 'num', 8: 'num', 13: 'num', 15: 'num' }, E310: { 4: 'num' }, G110: { 9: 'num' } },
    ecf: { '0000': {} }
  };
  /* validar(texto, tipo) → { tipo, linhas, registros, problemas[], totalProblemas, integridade, gravidade: 'ok'|'atencao'|'bloqueante', resumo } */
  function validar(txt, tipo) {
    const brutas = String(txt || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
    const esp = ESPEC[tipo] || {}, problemas = [], registros = {}; let total = 0, cortadas = 0, pontoDecimal = 0, comProblema = new Set();
    const anota = (linha, reg, campo, valor, esperado) => { total++; comProblema.add(linha); if (problemas.length < 50) problemas.push({ linha, reg, campo, valor: String(valor).slice(0, 40), esperado }); };
    brutas.forEach((l, i) => {
      const n = i + 1;
      if (!l.startsWith('|')) { anota(n, '?', 0, l.slice(0, 20), 'linha começando com |'); return; }
      if (!l.trimEnd().endsWith('|')) { cortadas++; anota(n, l.split('|')[1] || '?', 0, '(fim da linha)', 'linha terminando com | (linha cortada?)'); }
      const r = l.trimEnd().split('|'), reg = r[1]; registros[reg] = (registros[reg] || 0) + 1;
      const campos = esp[reg]; if (!campos) return;
      for (const [pos, t] of Object.entries(campos)) {
        const v = (r[+pos] || '').trim();
        if (r.length <= +pos) { anota(n, reg, +pos, '(campo ausente)', ESPERADO[t]); continue; }
        if (!T[t](v)) { if (t === 'num' && /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+\.\d+$/.test(v)) pontoDecimal++; anota(n, reg, +pos, v, ESPERADO[t]); }
      }
    });
    const r9999 = brutas.map(l => l.split('|')).find(r => r[1] === '9999');
    const declarada = r9999 ? parseInt(r9999[2], 10) : null;
    const integridade = { tem9999: !!r9999, linhasDeclaradas: declarada, linhasLidas: brutas.length, confere: r9999 ? declarada === brutas.length : false };
    const pct = brutas.length ? comProblema.size / brutas.length : 0;
    const bloqueante = !integridade.confere || pontoDecimal > 0 || cortadas > 0 || pct > 0.01;
    const gravidade = total === 0 && integridade.confere ? 'ok' : bloqueante ? 'bloqueante' : 'atencao';
    const partes = [];
    if (!integridade.tem9999) partes.push('arquivo sem o registro final 9999 (pode estar incompleto)');
    else if (!integridade.confere) partes.push(`o arquivo declara ${declarada} linhas e tem ${brutas.length}`);
    if (pontoDecimal) partes.push(`${pontoDecimal} valor(es) com ponto decimal, que seriam lidos multiplicados`);
    if (cortadas) partes.push(`${cortadas} linha(s) cortada(s)`);
    if (total - pontoDecimal - cortadas > 0) partes.push(`${total - pontoDecimal - cortadas} campo(s) fora do formato esperado`);
    return { tipo, linhas: brutas.length, registros, problemas, totalProblemas: total, integridade, gravidade,
      resumo: gravidade === 'ok' ? 'formato conferido: sem inconsistências' : partes.join('; ') };
  }
  const API = { validar, ESPEC, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; if (root) root.ValidaSped = API;
})(typeof window !== 'undefined' ? window : globalThis);
