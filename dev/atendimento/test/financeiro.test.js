// Financeiro — testes com dados FICTÍCIOS
const assert = require('node:assert/strict'); const F = require('../../../equipe/js/financeiro.js');
let ok = 0, f = 0; const t = (n, fn) => { try { fn(); ok++; console.log('ok  ', n); } catch (e) { f++; console.log('FALHA', n, '\n     ', e.message); } };
t('valores em centavos e formato brasileiro', () => { assert.equal(F.cent('1.234,56'), 123456); assert.equal(F.cent(10), 1000); assert.equal(F.reais(123456789), 'R$ 1.234.567,89'); });
t('leitura de valores pela regra do numBR: 1000.50, 1.000,50 e 0.125', () => { const casos = require('../../planejatrib/test/casos_numero_br.json');
  casos.forEach(([e, esperado]) => assert.equal(F.numBR(e), esperado, String(e)));
  assert.equal(F.cent('1000.50'), 100050); assert.equal(F.cent('1.000,50'), 100050); assert.equal(F.cent('0.125'), 13); assert.equal(F.exito('1000.50').proveito, 100050); });
t('parcelado: divide e põe os centavos que sobram na última; meses curtos', () => {
  const P = F.gerarParcelas({ id: 'c1', tipo: 'parcelado', valorFixo: '1000,00', nParcelas: 3, primeiroVenc: '2026-01-31', cliente: 'Empresa Exemplo' });
  assert.deepEqual(P.map(p => p.valor), [33333, 33333, 33334]); assert.deepEqual(P.map(p => p.venc), ['2026-01-31', '2026-02-28', '2026-03-31']); assert.equal(P[2].id, 'c1-p3'); });
t('mensal: cada parcela é a mensalidade; só êxito não gera parcela', () => {
  assert.deepEqual(F.gerarParcelas({ id: 'c2', tipo: 'mensal', valorFixo: 1500, nParcelas: 2, primeiroVenc: '2026-11-10' }).map(p => p.valor), [150000, 150000]);
  assert.equal(F.gerarParcelas({ id: 'c3', tipo: 'exito', exitoPct: 30 }).length, 0); });
t('êxito: 30% líquido com gross-up de 14,33%', () => { const e = F.exito('100.000,00'); assert.equal(e.liquido, 3000000); assert.equal(e.bruto, Math.round(3000000 / (1 - 0.1433))); assert.equal(F.reais(e.bruto), 'R$ 35.018,09'); });
t('resumo do mês: vencido, a receber em 30 dias, realização e inadimplentes', () => {
  const P = [{ id: 'a', venc: '2026-10-10', valor: 100000, cliente: 'A' }, { id: 'b', venc: '2026-11-01', valor: 50000, cliente: 'B', pago: { em: '2026-11-01', valor: 50000 } },
    { id: 'c', venc: '2026-11-01', valor: 50000, cliente: 'A' }, { id: 'd', venc: '2026-11-20', valor: 70000, cliente: 'C' }, { id: 'e', venc: '2027-01-20', valor: 70000, cliente: 'C' }];
  const r = F.resumo(P, '2026-11-02'); assert.equal(r.vencido, 150000); assert.equal(r.qtVencidas, 2); assert.equal(r.aReceber30, 70000); assert.equal(r.previstoMes, 170000); assert.equal(r.recebidoMes, 50000); assert.equal(r.realizacaoMes, 29);
  assert.deepEqual(r.inadimplentes[0], { cliente: 'A', valor: 150000, parcelas: 2, maisAntiga: '2026-10-10' }); });
t('cobranças: lembrete 3 dias antes, nada no dia, marcos de 1, 7 e 15 dias (15 vai à Direção)', () => {
  const mk = venc => ({ id: 'x' + venc, n: 1, de: 3, venc, valor: 100000, cliente: 'Cliente X' }), hoje = '2026-11-20';
  const C = F.cobrancas([mk('2026-11-23'), mk('2026-11-20'), mk('2026-11-19'), mk('2026-11-13'), mk('2026-11-05'), Object.assign(mk('2026-11-01'), { pago: { em: '2026-11-01', valor: 100000 } })], hoje);
  assert.deepEqual(C.map(c => c.marco), [-3, 1, 7, 15]); assert.deepEqual(C.map(c => c.resp), ['Victor', 'Victor', 'Victor', 'Rafael']); assert.match(C[1].titulo, /vencida há 1 dia.*Cliente X · parcela 1\/3 · R\$ 1\.000,00 · venc\. 19\/11\/2026/); assert.equal(C[3].id, 'fin-x2026-11-05-15'); });
t('validação do contrato', () => { assert.deepEqual(F.validarContrato({ cliente: 'X', tipo: 'misto', valorFixo: '3000', nParcelas: 3, primeiroVenc: '2026-11-10', exitoPct: 30 }), []);
  assert.ok(F.validarContrato({ cliente: '', tipo: 'parcelado', valorFixo: '', nParcelas: 0 }).length >= 3); assert.deepEqual(F.validarContrato({ cliente: 'Y', tipo: 'exito', exitoPct: 30 }), []); });
console.log(`\n${ok} ok, ${f} falha(s)`); process.exit(f ? 1 : 0);
