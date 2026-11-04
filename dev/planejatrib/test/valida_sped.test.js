// Validação de formato do SPED — arquivos FICTÍCIOS montados no teste
const assert = require('node:assert/strict'); const V = require('../valida_sped.js');
let ok = 0, f = 0; const t = (n, fn) => { try { fn(); ok++; console.log('ok  ', n); } catch (e) { f++; console.log('FALHA', n, '\n     ', e.message); } };
const fecha = linhas => linhas.concat(['|9999|' + (linhas.length + 1) + '|']).join('\r\n');
const ICMS = ['|0000|017|0|01102026|31102026|EMPRESA EXEMPLO LTDA|11222333000181||CE|0612345678|2312345|||A|1|', '|0200|P1|PRODUTO|||UN|00|30049099||||||', '|C100|1|0|||55|00|1|' + '1'.repeat(44) + '|',
  '|C190|000|5102|18,00|1000,00|1000,00|180,00|0|0|0|0||', '|E110|0|0|0|0|0|0|0|0|0|0|0|180,00|0|0|'];
const CONTRIB = ['|0000|006|0|||01102026|31102026|EMPRESA EXEMPLO LTDA|11222333000181|CE|2312345|||00|1|', '|0110|1|1|1||', '|C100|1|0||55|00|1|1|' + '1'.repeat(44) + '|',
  '|C170|1|P1|PROD|1|UN|500,00|0|0|0|5102|1||0|0|0|0|0|0|0|0|0|0|0|01|500,00|1,65|||8,25|01|500,00|7,60|||38,00||', '|M200|8,25|0|0|0|0|0|0|0|0|0|0|8,25|'];
t('arquivos corretos passam (EFD ICMS e EFD-Contribuições)', () => {
  const a = V.validar(fecha(ICMS), 'efd-icms'), b = V.validar(fecha(CONTRIB), 'efd-contrib');
  assert.equal(a.gravidade, 'ok', JSON.stringify(a.problemas)); assert.equal(b.gravidade, 'ok', JSON.stringify(b.problemas)); assert.equal(a.integridade.confere, true); assert.equal(a.registros.C190, 1); });
t('ponto decimal vira atenção (o leitor usa numBR e lê o valor certo)', () => {
  const L = ICMS.slice(); L[3] = '|C190|000|5102|18,00|1000.50|1000,00|180,00|0|0|0|0||'; const r = V.validar(fecha(L), 'efd-icms');
  assert.equal(r.gravidade, 'atencao'); assert.match(r.resumo, /1 valor\(es\) com ponto decimal/); assert.deepEqual([r.problemas[0].reg, r.problemas[0].campo, r.problemas[0].valor], ['C190', 5, '1000.50']); });
t('campo deslocado (CFOP no lugar errado) aparece com linha e posição', () => {
  const L = ICMS.slice(); L[3] = '|C190|000|18,00|5102|1000,00|1000,00|180,00|0|0|0|0||'; const r = V.validar(fecha(L), 'efd-icms');
  assert.ok(r.problemas.some(p => p.linha === 4 && p.campo === 3 && /CFOP/.test(p.esperado))); });
t('arquivo sem 9999 ou com contagem errada é bloqueante', () => {
  assert.match(V.validar(ICMS.join('\n'), 'efd-icms').resumo, /sem o registro final 9999/);
  const r = V.validar(ICMS.concat(['|9999|99|']).join('\n'), 'efd-icms'); assert.equal(r.gravidade, 'bloqueante'); assert.match(r.resumo, /declara 99 linhas e tem 6/); });
t('linha cortada e data impossível', () => {
  const L = ICMS.slice(); L[0] = '|0000|017|0|31022026|31102026|EMPRESA EXEMPLO LTDA|11222333000181||CE|0612345678|2312345|||A|1|'; L[4] = '|E110|0|0|0|0|0|0|0|0|0|0|0|18';
  const r = V.validar(fecha(L), 'efd-icms'); assert.equal(r.gravidade, 'bloqueante'); assert.match(r.resumo, /1 linha\(s\) cortada\(s\)/); assert.ok(r.problemas.some(p => p.reg === '0000' && p.campo === 4)); });
t('problema pequeno e isolado é "atenção", não bloqueante', () => {
  const L = ICMS.slice(); for (let i = 0; i < 150; i++) L.push('|0200|P' + i + '|ITEM|||UN|00|30049099||||||'); L[1] = '|0200|P1|PRODUTO|||UN|00|3004||||||';
  const r = V.validar(fecha(L), 'efd-icms'); assert.equal(r.gravidade, 'atencao'); assert.equal(r.totalProblemas, 1); });
console.log(`\n${ok} ok, ${f} falha(s)`); process.exit(f ? 1 : 0);
