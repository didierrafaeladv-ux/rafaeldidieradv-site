// Aba Automações: modelos, editor, disparo único, registro (dados FICTÍCIOS). Uso: node automacoes.e2e.js equipe/atendimento.html
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => { erros.push(e.message); console.log('STACK', (e.stack||'').split('\n').slice(0,4).join(' | ')); }); await pg.route(/fonts\.g|cdnjs/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(500); let ok = 0; const p = n => { ok++; console.log('ok  ', n); };
  const hoje = await pg.evaluate(() => window.__auto.hoje());
  const addConv = (id, ficha) => pg.evaluate(([id, ficha, hoje]) => { const st = window.__atend.estado(); st.convs.push({ id, canal: 'Telefone', nome: 'Cliente ' + id, tel: '', doc: '', msgs: [{ de: 'sys', tx: 'teste', em: new Date().toISOString() }], ficha: Object.assign({ proto: 'RD-2026-9' + id.slice(-3), em: new Date().toISOString(), status: 'Nova', rota: 'nova', resumo: 'Teste fictício', log: [] }, ficha) }); window.__auto.salvar(); }, [id, ficha, hoje]);
  await pg.$eval('#pub-por', e => { e.value = 'Rafael'; });
  await pg.click('#tab-auto'); assert.match(await pg.textContent('#au-lista'), /Nenhuma regra ainda/); assert.match(await pg.textContent('#au-modelos'), /Previdenciário: pedir CNIS/); p('aba Automações abre com modelos prontos');
  // modelo entra desligado; caso antes de ligar não dispara
  await pg.click('[data-au-mod="prev-docs"]'); assert.match(await pg.textContent('#au-msg'), /desligado/); assert.equal(await pg.$eval('[data-au-on="m-prev-docs"]', e => e.checked), false);
  await addConv('cx001', { area: 'Previdenciário' }); await pg.waitForTimeout(900); assert.equal(await pg.evaluate(() => window.__auto.log().length), 0); p('modelo entra desligado e não age');
  // ligar sem "existentes": caso já existente fica fora; caso novo dispara uma única vez
  await pg.click('[data-au-on="m-prev-docs"]'); await pg.waitForTimeout(200); assert.equal(await pg.evaluate(() => window.__auto.log().length), 0);
  await addConv('cx002', { area: 'Previdenciário' }); await pg.waitForTimeout(900);
  let r = await pg.evaluate(() => ({ log: window.__auto.log(), t: window.__tarefas.todas().filter(t => t.origem === 'automacao') }));
  assert.equal(r.log.length, 1); assert.equal(r.t.length, 1); assert.equal(r.t[0].resp, 'Ana Maria'); assert.equal(r.t[0].leadId, 'cx002'); assert.match(r.t[0].titulo, /Pedir CNIS.*Cliente cx002 \(RD-2026-9002\)/);
  await pg.evaluate(() => { window.__auto.salvar(); window.__auto.rodar(); }); await pg.waitForTimeout(900); assert.equal(await pg.evaluate(() => window.__tarefas.todas().filter(t => t.origem === 'automacao').length), 1); p('ligada: só casos novos, tarefa para o responsável do setor, sem repetir');
  // tarefa concluída não é recriada
  await pg.evaluate(() => { const t = window.__tarefas.todas().find(t => t.origem === 'automacao'); t.status = 'feita'; });
  await pg.evaluate(() => { window.__atend.estado().autoLog = {}; window.__auto.rodar(); });
  assert.equal(await pg.evaluate(() => window.__tarefas.todas().filter(t => t.origem === 'automacao' && t.status === 'pendente').length), 0); p('tarefa já existente (mesmo id) não é recriada nem reaberta');
  // editor: validação e regra nova com histórico + situação, aplicada aos existentes
  await pg.click('#tab-auto'); await pg.click('#au-nova'); await pg.click('#au-salva'); assert.match(await pg.textContent('#au-err'), /Dê um nome/);
  await pg.fill('#au-nome', 'Urgência vai para andamento'); await pg.selectOption('[data-auc-campo="0"]', 'setor'); await pg.selectOption('[data-auc-val="0"]', 'urgencia');
  await pg.selectOption('[data-aua-tipo="0"]', 'historico'); await pg.fill('[data-aua-texto="0"]', 'Direção avisada da urgência'); await pg.click('#au-a-add'); await pg.selectOption('[data-aua-tipo="1"]', 'status'); await pg.selectOption('[data-aua-valor="1"]', 'Em andamento');
  await addConv('cx003', { rota: 'urgencia' }); await pg.click('#tab-auto'); await pg.click('#au-nova');
  await pg.fill('#au-nome', 'Urgência vai para andamento'); await pg.selectOption('[data-auc-campo="0"]', 'setor'); await pg.selectOption('[data-auc-val="0"]', 'urgencia');
  await pg.selectOption('[data-aua-tipo="0"]', 'historico'); await pg.fill('[data-aua-texto="0"]', 'Direção avisada da urgência'); await pg.click('#au-a-add'); await pg.selectOption('[data-aua-tipo="1"]', 'status'); await pg.selectOption('[data-aua-valor="1"]', 'Em andamento');
  await pg.check('#au-exist'); await pg.waitForTimeout(100); assert.match(await pg.textContent('#au-sim'), /atinge 1 caso/); await pg.click('#au-salva');
  const rid = await pg.evaluate(() => window.__auto.regras().find(r => r.nome === 'Urgência vai para andamento').id); await pg.click('[data-au-on="' + rid + '"]'); await pg.waitForTimeout(300);
  const f = await pg.evaluate(() => window.__atend.estado().convs.find(c => c.id === 'cx003').ficha);
  assert.equal(f.status, 'Em andamento'); assert.match(f.log.join(' '), /\[Automação “Urgência vai para andamento”\] Direção avisada da urgência/); assert.match(await pg.textContent('#au-msg'), /agiu em 1/); p('regra criada no editor: simulação, histórico e mudança de situação nos existentes');
  // publicação urgente
  await pg.click('[data-au-mod="pub-urgente"]'); await pg.click('[data-au-ed="m-pub-urgente"]'); await pg.check('#au-exist'); await pg.click('#au-salva');
  await pg.click('#tab-prazos'); await pg.fill('#pub-data', hoje); await pg.fill('#pub-tx', 'Processo 0001234-85.2025.8.06.0167 - Execução Fiscal. Fica a parte executada CITADA para pagar a dívida no prazo de 5 (cinco) dias.'); await pg.click('#pub-class'); await pg.waitForTimeout(150);
  await pg.$eval('[data-pubreg="0"]', e => e.click()); await pg.click('#tab-auto'); await pg.click('[data-au-on="m-pub-urgente"]'); await pg.waitForTimeout(300);
  const tu = await pg.evaluate(() => window.__tarefas.todas().find(t => t.origem === 'automacao' && /Publicação urgente/.test(t.titulo)));
  assert.equal(tu.resp, 'Rafael'); assert.match(tu.titulo, /0001234-85\.2025\.8\.06\.0167/); assert.equal(tu.prazo, hoje); p('publicação urgente vira tarefa da Direção para hoje');
  assert.match(await pg.textContent('#au-log'), /Publicação urgente avisa a Direção/); await pg.click('[data-au-del="' + rid + '"]'); await pg.click('[data-au-del="' + rid + '"]');
  assert.ok(!(await pg.evaluate(id => window.__auto.regras().some(r => r.id === id), rid))); p('registro mostra os disparos; excluir pede confirmação');
  assert.deepEqual(erros, []); console.log(ok + ' ok'); await b.close(); })().catch(e => { console.error('FALHA', e.message); process.exit(1); });
