// Motor de regras — testes com dados FICTÍCIOS
const assert = require('node:assert/strict'); const A = require('../../../equipe/js/automacoes.js');
let ok = 0, f = 0; const t = (n, fn) => { try { fn(); ok++; console.log('ok  ', n); } catch (e) { f++; console.log('FALHA', n, '\n     ', e.message); } };
const hoje = '2026-11-02';
const caso = (id, f, c) => ({ c: Object.assign({ id, nome: 'Fulana ' + id, canal: 'WhatsApp' }, c || {}), f: Object.assign({ proto: 'RD-2026-' + id, em: '2026-11-02T10:00:00Z', status: 'Nova', rota: 'nova' }, f) });
const ativa = (m, extra) => Object.assign(JSON.parse(JSON.stringify(m)), { ativa: true }, extra || {});
const M = id => A.MODELOS.find(m => m.id === id);
t('modelo previdenciário: só casos da matéria e não concluídos; título preenchido; tarefa com id fixo', () => {
  const casos = [caso('0001', { area: 'Previdenciário' }), caso('0002', { area: 'Tributário' }), caso('0003', { area: 'Previdenciário', status: 'Concluída' })];
  const P = A.planejar([ativa(M('prev-docs'))], { casos }, hoje);
  assert.equal(P.length, 1); assert.equal(P[0].alvoId, '0001'); assert.equal(P[0].acoes[0].titulo, 'Pedir CNIS, carta de decisão do INSS e documentos — Fulana 0001 (RD-2026-0001)');
  assert.equal(P[0].acoes[0].id, A.planejar([ativa(M('prev-docs'))], { casos }, hoje)[0].acoes[0].id); });
t('não dispara de novo para o mesmo caso; regra desligada não dispara', () => {
  const casos = [caso('0001', { area: 'Previdenciário' })], r = ativa(M('prev-docs'));
  const ja = new Set(A.planejar([r], { casos }, hoje).map(p => p.chave)); assert.equal(A.planejar([r], { casos }, hoje, ja).length, 0);
  assert.equal(A.planejar([Object.assign({}, r, { ativa: false })], { casos }, hoje).length, 0); });
t('"desde": casos antigos ficam fora, salvo "aplicar também aos existentes"', () => {
  const casos = [caso('0001', { area: 'Previdenciário', em: '2026-10-01T10:00:00Z' }), caso('0002', { area: 'Previdenciário' })];
  assert.deepEqual(A.planejar([ativa(M('prev-docs'), { desde: '2026-11-01T00:00:00Z' })], { casos }, hoje).map(p => p.alvoId), ['0002']);
  assert.equal(A.planejar([ativa(M('prev-docs'), { desde: '2026-11-01T00:00:00Z', existentes: true })], { casos }, hoje).length, 2); });
t('publicações: urgente e prazo perto sem conferência (dias para vencer)', () => {
  const pubs = [{ id: 'p1', cnj: '0001234-85.2025.8.06.0167', tipoNome: 'Citação', urgente: true, venc: '2026-11-09' }, { id: 'p2', cnj: '0009012-98.2026.4.05.8100', tipoNome: 'Intimação', venc: '2026-11-03', status: 'lancada' },
    { id: 'p3', cnj: '0000001-00.2026.8.06.0167', tipoNome: 'Intimação', venc: '2026-11-04', conferidaPor: 'David' }, { id: 'p4', tipoNome: 'Despacho' }];
  const P = A.planejar([ativa(M('pub-urgente')), ativa(M('prazo-sem-conf'))], { publicacoes: pubs }, hoje);
  assert.deepEqual(P.map(p => p.regra.id + ':' + p.alvoId), ['pub-urgente:p1', 'prazo-sem-conf:p2']);
  assert.equal(P[0].acoes[0].titulo, 'Publicação urgente: Citação · 0001234-85.2025.8.06.0167 · vence 09/11/2026'); });
t('dias desde a abertura e histórico + tarefa (duas ações)', () => {
  const casos = [caso('0001', { status: 'Aguardando cliente', em: '2026-10-20T10:00:00Z' }), caso('0002', { status: 'Aguardando cliente', em: '2026-10-30T10:00:00Z' }), caso('0003', { rota: 'urgencia' })];
  assert.deepEqual(A.planejar([ativa(M('cliente-parado'))], { casos }, hoje).map(p => p.alvoId), ['0001']);
  const P = A.planejar([ativa(M('urgencia-processo'))], { casos }, hoje); assert.equal(P.length, 1); assert.deepEqual(P[0].acoes.map(a => a.tipo), ['historico', 'tarefa']);
  assert.equal(A.planejar([ativa(M('urgencia-processo'))], { casos: [caso('0004', { rota: 'urgencia', processo: '0001234-85.2025.8.06.0167' })] }, hoje).length, 0); });
t('descrição em português e validação', () => {
  assert.equal(A.descrever(M('cliente-parado')), 'Quando um caso tiver situação é “Aguardando cliente” e dias desde a abertura é maior ou igual a 7 dia(s), criar a tarefa “Cobrar retorno do cliente — {cliente} ({protocolo})” para o responsável do setor (prazo: 1 dia(s) útil(eis)).');
  assert.match(A.descrever(M('pub-urgente')), /prazo: hoje/);
  assert.deepEqual(A.validar(M('prev-docs')), []);
  assert.ok(A.validar({ nome: '', alvo: 'publicacao', condicoes: [{ campo: 'dias_vencer', op: 'lte', valor: '' }], acoes: [{ tipo: 'status', valor: 'Concluída' }] }).length >= 3); });
console.log(`\n${ok} ok, ${f} falha(s)`); process.exit(f ? 1 : 0);
