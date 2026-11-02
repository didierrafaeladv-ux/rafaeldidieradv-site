// Aba Financeiro: contrato, parcelas, pagamento, cobrança e êxito (dados FICTÍCIOS). Uso: node financeiro.e2e.js equipe/atendimento.html
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => erros.push(e.message)); await pg.route(/fonts\.g|cdnjs/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(500); let ok = 0; const p = n => { ok++; console.log('ok  ', n); };
  const hoje = await pg.evaluate(() => window.__auto.hoje()); const mais = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  await pg.$eval('#pub-por', e => { e.value = 'Victor'; });
  await pg.evaluate(() => { const st = window.__atend.estado(); st.convs.push({ id: 'cf001', canal: 'Telefone', nome: 'Empresa Exemplo Ltda', tel: '', doc: '', msgs: [{ de: 'sys', tx: 'x', em: new Date().toISOString() }], ficha: { proto: 'RD-2026-9101', em: new Date().toISOString(), status: 'Em andamento', rota: 'nova', resumo: 'Teste', log: [] } }); window.__auto.salvar(); });
  await pg.click('#tab-fin'); assert.match(await pg.textContent('#fin-contr'), /Nenhum contrato/);
  await pg.click('#fin-salva'); assert.match(await pg.textContent('#fin-err'), /Informe o cliente/); p('validação do contrato');
  // contrato misto: 3 parcelas, a 1ª vencida há 8 dias
  await pg.fill('#fin-cli', 'Empresa Exemplo Ltda · RD-2026-9101'); await pg.selectOption('#fin-tipo', 'misto'); await pg.fill('#fin-valor', '3.000,00'); await pg.fill('#fin-n', '3'); await pg.fill('#fin-venc', mais(hoje, -8));
  assert.match(await pg.textContent('#fin-prev'), /3 parcela\(s\): R\$ 1\.000,00/); await pg.click('#fin-salva'); await pg.waitForTimeout(200);
  let r = await pg.evaluate(() => ({ k: window.__fin.contratos(), p: window.__fin.parcelas(), log: window.__atend.estado().convs.find(c => c.id === 'cf001').ficha.log }));
  assert.equal(r.k.length, 1); assert.equal(r.k[0].cliente, 'Empresa Exemplo Ltda'); assert.equal(r.k[0].caso, 'RD-2026-9101'); assert.equal(r.p.length, 3); assert.match(r.log.join(' '), /Contrato de honorários registrado/); p('contrato misto ligado ao caso gera 3 parcelas');
  assert.match(await pg.textContent('#fin-kpis'), /Vencido\s*R\$ 1\.000,00/); assert.match(await pg.textContent('#fin-inad'), /Empresa Exemplo Ltda/); p('vencido e inadimplência aparecem');
  // cobrança: tarefa de 7 dias para o Victor, sem duplicar
  await pg.evaluate(() => window.__fin.cobrar()); await pg.evaluate(() => window.__fin.cobrar());
  let tf = await pg.evaluate(() => window.__tarefas.todas().filter(t => t.origem === 'financeiro')); assert.equal(tf.length, 1); assert.equal(tf[0].resp, 'Victor'); assert.match(tf[0].titulo, /vencida há 7 dias.*parcela 1\/3/); assert.equal(tf[0].leadId, 'cf001'); p('parcela vencida vira uma única tarefa de cobrança');
  // pagamento fecha a tarefa
  await pg.click('[data-fin-pg]'); await pg.click('[data-fin-ok]'); await pg.waitForTimeout(150);
  tf = await pg.evaluate(() => window.__tarefas.todas().filter(t => t.origem === 'financeiro')); assert.equal(tf[0].status, 'feita'); assert.match(await pg.textContent('#fin-msg'), /Pagamento de R\$ 1\.000,00 registrado/);
  assert.match(await pg.textContent('#fin-kpis'), /Vencido\s*R\$ 0,00/); p('pagamento registrado zera o vencido e conclui a tarefa de cobrança');
  // êxito com gross-up
  await pg.click('[data-fin-ex]'); await pg.fill('[data-fin-prov]', '100.000,00'); assert.match(await pg.textContent('[data-fin-exprev]'), /R\$ 30\.000,00 líquido → R\$ 35\.018,09 bruto/);
  await pg.click('[data-fin-exok]'); await pg.waitForTimeout(150); assert.match(await pg.textContent('#fin-msg'), /R\$ 35\.018,09 a faturar/);
  assert.equal(await pg.evaluate(() => window.__fin.parcelas().filter(p => p.exito).length), 1); p('êxito: 30% líquido com gross-up vira valor a receber');
  // pago não pode ser excluído; desfazer pagamento
  assert.equal(await pg.$('[data-fin-del]'), null); await pg.selectOption('#fin-filtro', 'pagas'); await pg.click('[data-fin-desf]'); await pg.click('[data-fin-desf]'); await pg.waitForTimeout(100);
  assert.equal(await pg.evaluate(() => window.__fin.parcelas().filter(p => p.pago).length), 0); p('contrato com pagamento não pode ser excluído; pagamento pode ser desfeito com confirmação');
  assert.deepEqual(erros, []); console.log(ok + ' ok'); await b.close(); })().catch(e => { console.error('FALHA', e.message); process.exit(1); });
