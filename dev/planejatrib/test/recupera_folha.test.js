// Testes do módulo de recuperação pela folha (dados fictícios). Uso: node test/recupera_folha.test.js
const assert = require('node:assert/strict'); require('../numero_br.js'); const R = require('../recupera_folha.js'); let ok = 0;
const t = (nome, f) => { f(); ok++; console.log('ok  ', nome); };
t('classificação por palavra-chave e por código', () => {
  const c = d => R.classificar(d).verba;
  assert.equal(c('AUX. DOENÇA 15 DIAS'), 'quinze'); assert.equal(c('API - AVISO PREV. IND.'), 'aviso'); assert.equal(c('AVISO PREVIO TRABALHADO'), '');
  assert.equal(c('SALÁRIO-MATERNIDADE'), 'salmat'); assert.equal(c('RATEIO FUNDEB 70%'), 'fundeb'); assert.equal(c('1/3 DE FÉRIAS'), 'terco'); assert.equal(c('SALARIO BASE'), '');
  assert.equal(R.classificar('GRATIF', '777', { 777: 'aviso' }).verba, 'aviso'); assert.equal(R.classificar('AVISO PREVIO INDENIZADO', '9', { 9: '-' }).verba, '');
});
t('leitura da folha agrega por rubrica e ignora RPPS na base', () => {
  const txt = 'competencia;codigo;descricao;valor;vinculo\n01/2015;310;AVISO PREVIO INDENIZADO;1.000,00;RGPS\n02/2015;310;AVISO PREVIO INDENIZADO;500,00\n01/2015;520;RATEIO FUNDEB;9.000,00;RPPS\n01/2015;101;SALARIO BASE;150000,00';
  const f = R.lerFolha(txt); assert.equal(f.rubricas.length, 3); const b = R.bases(f.rubricas);
  assert.deepEqual(b, { '2015-01': { aviso: 1000 }, '2015-02': { aviso: 500 } });
});
t('leitura do extrato de GPS copiado do e-CAC', () => {
  const g = R.lerGps('Competência\tQuantidade\tValor\tImputação\n11/2005\t8\t75.769,52\t\n13/2006;5;38.592,98;x');
  assert.deepEqual(g, { '2005-11': 75769.52, '2006-13': 38592.98 });
});
t('Selic: mês seguinte ao pagamento até o anterior à compensação, + 1%; 13º pago em dezembro', () => {
  assert.deepEqual(R.mesPagamento('2015-12'), [2016, 1]); assert.deepEqual(R.mesPagamento('2015-13'), [2015, 12]);
  const T = { '2015-03': 1, '2015-04': 2 }; assert.deepEqual(R.selicAcumulada('2015-01', '2015-05', T), { pct: 4, faltam: [] });
  assert.equal(R.selicAcumulada('2005-11', '2026-11').pct, 207.97);   // mesmo valor do robô em Python (Milhã)
});
t('cálculo: status por verba, teto do GPS, alertas e totais', () => {
  const base = { '2015-01': { aviso: 1000, salmat: 5000, terco: 3000 }, '2015-02': { quinze: 100000 } };
  const gps = { '2015-01': 50000, '2015-02': 10000, '2015-03': 8000 };
  const p = { inicio: '2015-01', fim: '2015-03', mesComp: '2026-11', patronal: 20, rat: { padrao: 2 }, fap: { padrao: 1 }, status: { aviso: 'entra', quinze: 'entra', salmat: 'pendente', terco: 'fora', fundeb: 'fora' } };
  const r = R.calcular(base, gps, p); const L = Object.fromEntries(r.linhas.map(l => [l.mes, l]));
  assert.equal(L['2015-01'].nominal, 220); assert.equal(L['2015-01'].pendente, 1100); assert.equal(L['2015-02'].pendente, 0); assert.equal(L['2015-02'].limitado, 10000);
  assert.ok(r.alertas.some(a => a.mes === '2015-02' && a.tipo === 'teto')); assert.ok(r.alertas.some(a => a.mes === '2015-03' && a.tipo === 'sem folha'));
  assert.equal(r.total.nominal, 10220); assert.equal(r.basesVerba.terco, 3000);
  const semGps = R.calcular(base, {}, p); assert.equal(semGps.total.nominal, 22220); assert.equal(semGps.temGps, false);
});
t('RAT e FAP por ano', () => {
  const r = R.calcular({ '2009-05': { aviso: 100 }, '2010-05': { aviso: 100 } }, {}, { mesComp: '2026-11', patronal: 20, rat: { padrao: 2, 2009: 1 }, fap: { padrao: 1, 2010: 0.5 }, status: { aviso: 'entra' } });
  assert.deepEqual(r.linhas.map(l => l.nominal), [21, 21]);
});
t('perfis padrão: empresa (60 meses) e título judicial (tudo pendente até o advogado decidir)', () => {
  const e = R.padrao('empresa', '2026-11-04'); assert.equal(e.inicio, '2021-11'); assert.equal(e.status.terco, 'fora'); assert.equal(e.status.salmat, 'pendente');
  const j = R.padrao('titulo', '2026-11-04'); assert.ok(Object.values(j.status).every(s => s === 'pendente'));
});
t('CSV da memória de cálculo', () => { const r = R.calcular({ '2015-01': { aviso: 100 } }, {}, { mesComp: '2015-04', status: { aviso: 'entra' }, rat: { padrao: 2 } }); const c = R.csv(r).split('\n'); assert.equal(c.length, 2); assert.match(c[1], /^01\/2015;0,00;100,00/); });
t('reclassificação pelo advogado (sem código, pela descrição) e compactação', () => {
  const f = R.lerFolha('01/2015;;GRATIFICACAO ESPECIAL;100,00\n01/2015;;AVISO PREVIO INDENIZADO;50,00');
  const k = R.chaveRub(f.rubricas[0]); assert.equal(k, 'd:gratificacao especial');
  const g = R.lerFolha('01/2015;;GRATIFICACAO ESPECIAL;100,00', { [k]: 'quinze' }); assert.equal(g.rubricas[0].verba, 'quinze');
  const c = R.compactar(f.rubricas); assert.equal(c[0].verba, 'aviso'); assert.equal(c.length, 2);
});
t('RAT/FAP por ano em texto e CSV em Windows-1252', () => {
  assert.deepEqual(R.porAno('2005-2007=1; 2010=2,5'), { 2005: 1, 2006: 1, 2007: 1, 2010: 2.5 });
  const latin = Buffer.from('01/2015;;SAL\xc1RIO MATERNIDADE;10,00', 'latin1'); assert.match(R.decodificar(latin), /SALÁRIO/);
});
console.log(ok + ' ok');
