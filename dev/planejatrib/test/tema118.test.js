// Testes do Tema 118 (dados fictícios). Uso: node test/tema118.test.js
const assert = require('node:assert/strict'); require('../numero_br.js'); require('../recupera_folha.js'); const T = require('../tema118.js'); let ok = 0;
const t = (n, f) => { f(); ok++; console.log('ok  ', n); };
t('agrega NFS-e por competência e lê a EFD', () => {
  const r = T.deDocs([{ tipo: 'nfse', v: 1000, iss: 50, competencia: '2024-01', emit: { cnpj: '1' } }, { tipo: 'nfse', v: 500, iss: 25, mes: '2024-01' }, { tipo: 'nfse', v: 0, iss: 9, mes: '2024-01' },
    { tipo: 'efd-contrib', mes: '2024-01', pis: 10, cofins: 46, receita: 1500, regime: '2' }]);
  assert.deepEqual(r.issMes, { '2024-01': 75 }); assert.equal(r.pcMes['2024-01'].regime, 'cum'); assert.equal(r.notas, 2);
});
t('cumulativo 3,65%, não cumulativo 9,25%, teto e prescrição', () => {
  const r = T.calcular({ '2021-09': 1000, '2021-10': 1000, '2024-01': 1000, '2024-02': 1000 }, { '2024-02': { pis: 1, cofins: 1, receita: 1e5, regime: 'ncum' } }, { hoje: '2026-11-05', mesComp: '2026-11' });
  const L = Object.fromEntries(r.linhas.map(l => [l.mes, l]));
  assert.equal(L['2021-09'].situacao, 'prescrito'); assert.equal(L['2021-10'].situacao, 'vence em até 90 dias'); assert.equal(L['2021-10'].prescreve, '2026-11-25');
  assert.equal(L['2024-01'].indebito, 36.5); assert.equal(L['2024-02'].indebito, 2);   // 92,50 limitado a 2,00
  assert.equal(r.total.prescrito, 36.5); assert.ok(r.alertas.some(a => /limitado/.test(a.texto)));
});
t('cenário de modulação na data do julgamento', () => {
  const r = T.calcular({ '2026-08': 100, '2026-09': 100, '2026-10': 100 }, {}, { hoje: '2026-11-05', mesComp: '2026-11' });
  assert.equal(r.cenarioCorte.indebito, 7.3);   // set/2026 (vence 25/10) e out/2026 (vence 25/11) ficam depois do corte de 21/10/2026
});
t('CSV', () => { const c = T.csv(T.calcular({ '2024-01': 100 }, {}, { hoje: '2026-11-05' })).split('\n'); assert.equal(c.length, 2); assert.match(c[1], /^01\/2024;100,00;cumulativo;0,65;3,00;3,65/); });
console.log(ok + ' ok');
