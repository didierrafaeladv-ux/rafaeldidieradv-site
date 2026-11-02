/* Financeiro mínimo do escritório (v1.0, 02/11/2026): contrato → parcelas → pagamentos → cobrança → indicadores.
 * Política padrão do escritório: êxito de 30% LÍQUIDO do proveito econômico, com gross-up pela carga tributária estimada de 14,33%.
 * Valores em centavos (inteiros) para não errar arredondamento. Navegador (window.Financeiro) e node. */
(function (root) {
  'use strict';
  const POLITICA = { exitoPct: 30, carga: 14.33 };
  const TIPOS = { parcelado: 'Valor fixo parcelado', mensal: 'Mensalidade (assessoria)', exito: 'Só êxito', misto: 'Fixo + êxito' };
  const cent = v => Math.round((typeof v === 'string' ? +String(v).replace(/\./g, '').replace(',', '.') : +v) * 100) || 0;
  const reais = c => (c < 0 ? '-' : '') + 'R$ ' + (Math.abs(c) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const iso = d => d.toISOString().slice(0, 10);
  // soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02)
  function maisMeses(dataIso, n) { const [a, m, d] = dataIso.split('-').map(Number); const alvo = new Date(Date.UTC(a, m - 1 + n, 1)); const ult = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    alvo.setUTCDate(Math.min(d, ult)); return iso(alvo); }
  const dias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  /* gerarParcelas(contrato) → parcelas {id, contratoId, n, de, venc, valor (centavos), cliente}
   * parcelado/misto: valorFixo dividido em nParcelas (centavos que sobram vão na última); mensal: nParcelas mensalidades de valorFixo */
  function gerarParcelas(c) { const n = Math.max(0, +c.nParcelas || 0), total = cent(c.valorFixo), out = [];
    if (!n || !total || !c.primeiroVenc || c.tipo === 'exito') return out;
    const base = c.tipo === 'mensal' ? total : Math.floor(total / n);
    for (let i = 0; i < n; i++) out.push({ id: c.id + '-p' + (i + 1), contratoId: c.id, n: i + 1, de: n, venc: maisMeses(c.primeiroVenc, i), cliente: c.cliente || '', caso: c.caso || '',
      valor: c.tipo === 'mensal' ? total : (i === n - 1 ? total - base * (n - 1) : base), pago: null });
    return out; }
  /* exito(proveito, {pct, carga}) → {proveito, pct, carga, liquido, bruto} em centavos: líquido = pct do proveito; bruto = líquido / (1 − carga) */
  function exito(proveito, o) { o = Object.assign({}, POLITICA, o || {}); const p = cent(proveito), liq = Math.round(p * o.exitoPct / 100);
    return { proveito: p, pct: o.exitoPct, carga: o.carga, liquido: liq, bruto: Math.round(liq / (1 - o.carga / 100)) }; }
  function situacao(p, hoje) { if (p.pago) return 'paga'; if (p.venc < hoje) return 'vencida'; if (p.venc === hoje) return 'vence hoje'; return 'a vencer'; }
  const pagoValor = p => p.pago ? (+p.pago.valor || 0) : 0;
  /* resumo(parcelas, hoje) → totais em centavos para o mês corrente e carteira */
  function resumo(parcelas, hoje) { const mes = hoje.slice(0, 7), L = parcelas || [], abertas = L.filter(p => !p.pago);
    const doMes = L.filter(p => p.venc.slice(0, 7) === mes), recebidoMes = L.filter(p => p.pago && String(p.pago.em).slice(0, 7) === mes).reduce((a, p) => a + pagoValor(p), 0);
    const ate30 = iso(new Date(new Date(hoje + 'T12:00:00Z').getTime() + 30 * 864e5));
    const vencidas = abertas.filter(p => p.venc < hoje), previstoMes = doMes.reduce((a, p) => a + p.valor, 0), recebidoDoMes = doMes.filter(p => p.pago).reduce((a, p) => a + pagoValor(p), 0);
    const porCliente = {}; vencidas.forEach(p => { const k = p.cliente || '—'; porCliente[k] = porCliente[k] || { cliente: k, valor: 0, parcelas: 0, maisAntiga: p.venc }; porCliente[k].valor += p.valor; porCliente[k].parcelas++; if (p.venc < porCliente[k].maisAntiga) porCliente[k].maisAntiga = p.venc; });
    return { vencido: vencidas.reduce((a, p) => a + p.valor, 0), qtVencidas: vencidas.length, aReceber30: abertas.filter(p => p.venc >= hoje && p.venc <= ate30).reduce((a, p) => a + p.valor, 0),
      previstoMes, recebidoMes, realizacaoMes: previstoMes ? Math.round(100 * recebidoDoMes / previstoMes) : null,
      inadimplentes: Object.values(porCliente).sort((a, b) => b.valor - a.valor) }; }
  /* cobrancas(parcelas, hoje) → tarefas de cobrança para o Financeiro: 1, 7 e 15 dias de atraso (uma por marco; id fixo, não duplica)
   * e lembrete interno 3 dias antes do vencimento. Nada é enviado ao cliente automaticamente. */
  const MARCOS = [[-3, 'Vence em 3 dias: confirmar se o boleto/Pix foi enviado'], [1, 'Parcela vencida há 1 dia: confirmar pagamento e lembrar o cliente'], [7, 'Parcela vencida há 7 dias: contato de cobrança'], [15, 'Parcela vencida há 15 dias: levar à Direção']];
  function cobrancas(parcelas, hoje) { const out = [];
    (parcelas || []).filter(p => !p.pago).forEach(p => { const atraso = dias(p.venc, hoje);
      const marco = MARCOS.filter(([d]) => atraso >= d).pop(); if (!marco) return; if (marco[0] < 0 && atraso >= 0) return;
      const [d, txt] = marco; out.push({ id: ('fin-' + p.id + '-' + (d < 0 ? 'antes' : d)).replace(/[^A-Za-z0-9_\-]/g, ''), parcelaId: p.id, marco: d,
        titulo: txt + ' — ' + (p.cliente || 'cliente') + ' · parcela ' + p.n + '/' + p.de + ' · ' + reais(p.valor) + ' · venc. ' + p.venc.split('-').reverse().join('/'), resp: d >= 15 ? 'Rafael' : 'Victor' }); });
    return out; }
  function validarContrato(c) { const e = [];
    if (!String(c.cliente || '').trim()) e.push('Informe o cliente.');
    if (!TIPOS[c.tipo]) e.push('Escolha o tipo de honorário.');
    if (c.tipo !== 'exito') { if (!(cent(c.valorFixo) > 0)) e.push('Informe o valor ' + (c.tipo === 'mensal' ? 'da mensalidade.' : 'fixo total.')); if (!(+c.nParcelas >= 1 && +c.nParcelas <= 120)) e.push('Número de parcelas entre 1 e 120.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(c.primeiroVenc || '')) e.push('Informe o 1º vencimento.'); }
    if ((c.tipo === 'exito' || c.tipo === 'misto') && !(+c.exitoPct > 0 && +c.exitoPct <= 100)) e.push('Percentual de êxito entre 0 e 100.');
    return e; }
  const API = { POLITICA, TIPOS, cent, reais, maisMeses, gerarParcelas, exito, situacao, resumo, cobrancas, validarContrato, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Financeiro = API;
})(typeof window !== 'undefined' ? window : globalThis);
