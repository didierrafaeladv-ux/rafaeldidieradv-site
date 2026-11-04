/* Leitura de valores numéricos vindos de SPED, PDF, XML, planilhas e portais — PlanejaTrib RD (v1.0, 04/11/2026).
 * Substitui os quatro leitores antigos, que tiravam todos os pontos: "1000.50" virava 100050.
 * Regras: com vírgula e ponto, o separador que vem por último é o decimal; só vírgula → vírgula decimal;
 * só ponto → um ponto seguido de exatamente 3 dígitos (e parte inteira diferente de zero) é milhar ("1.000"),
 * qualquer outro ponto único é decimal ("1000.50", "0.125"); vários pontos → milhar ("1.234.567").
 * Aceita "R$", espaços, sinal e parênteses contábeis "(1.234,56)". Inválido → 0. */
(function (root) {
  'use strict';
  function numBR(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    let s = String(v == null ? '' : v).replace(/R\$|\s| /g, '');
    if (!s) return 0;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    if (!/^[\d.,]+$/.test(s)) return 0;
    const iv = s.lastIndexOf(','), ip = s.lastIndexOf('.');
    if (iv >= 0 && ip >= 0) s = iv > ip ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (iv >= 0) s = (s.match(/,/g).length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
    else if (ip >= 0) {
      const pontos = s.match(/\./g).length;
      if (pontos > 1) s = s.replace(/\./g, '');
      else if (/^[1-9]\d{0,2}\.\d{3}$/.test(s)) s = s.replace('.', '');
    }
    const x = parseFloat(s);
    return isFinite(x) ? (neg ? -x : x) : 0;
  }
  const API = { numBR, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.numBR = numBR;
})(typeof window !== 'undefined' ? window : globalThis);
