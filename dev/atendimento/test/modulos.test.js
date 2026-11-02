// Todos os módulos de equipe/js carregam em node e respondem ao básico (dados FICTÍCIOS)
const assert = require('node:assert/strict'); const path = require('path'); const fs = require('fs');
const dir = path.join(__dirname, '../../../equipe/js');
let ok = 0, f = 0; const t = (n, fn) => { try { fn(); ok++; console.log('ok  ', n); } catch (e) { f++; console.log('FALHA', n, '\n     ', e.message); } };
global.PrazoProcessual = require(path.join(dir, 'prazo_processual.js'));
const mods = {}; fs.readdirSync(dir).filter(x => x.endsWith('.js') && x !== 'coleta_sentencas.js').forEach(x => t('carrega ' + x, () => { mods[x] = require(path.join(dir, x)); assert.ok(mods[x] && typeof mods[x] === 'object'); }));
t('prazo processual: calcula vencimento em dias úteis', () => { const r = PrazoProcessual.calcular({ disponibilizacao: '2026-10-29', dias: 5 }); assert.match(JSON.stringify(r), /2026-11-/); });
t('tarefas: soma dias úteis e gera checklist', () => { const T = mods['tarefas.js']; assert.ok(T.somaUteis('2026-11-02', 1) > '2026-11-02'); assert.ok(T.gerar({ area: 'Tributário', leadId: 'x', cliente: 'Empresa Exemplo', inicio: '2026-11-02' }).length > 0); });
t('matéria: detecta previdenciário', () => { assert.equal(mods['materia.js'].detectar('quero me aposentar pelo INSS'), 'Previdenciário'); });
t('publicação: classifica citação com número do processo', () => { const r = mods['publicacao.js'].classificar('Processo 3011867-07.2025.8.06.0167 - Execução Fiscal. Fica a parte executada CITADA para pagar a dívida no prazo de 5 (cinco) dias.', { disponibilizacao: '2026-10-29' }); assert.equal(r.cnj, '3011867-07.2025.8.06.0167'); assert.ok(r.urgente); });
t('rotinas: avalia sinais', () => { const L = mods['rotinas.js'].avaliar([{ id: 'ponte', em: new Date().toISOString(), status: 'ok' }], new Date()); assert.ok(L.find(x => x.id === 'ponte')); });
t('sentenças: classifica procedente', () => { const r = mods['sentenca_prev.js'].classificar({ id: 1, numeroprocessocommascara: '0000001-00.2026.4.05.8103', tipoDocumento: 'Sentença', texto: 'REU: INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS SENTENÇA Ante o exposto, JULGO PROCEDENTE o pedido de salário-maternidade.' }); assert.equal(r.resultado, 'procedente'); });
t('automações: modelos válidos', () => { const A = mods['automacoes.js']; A.MODELOS.forEach(m => assert.deepEqual(A.validar(m), [], m.id)); });
console.log(`\n${ok} ok, ${f} falha(s)`); process.exit(f ? 1 : 0);
