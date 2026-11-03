// E-mails a triar na Fila única (dados FICTÍCIOS). Uso: node email.e2e.js equipe/atendimento.html
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => erros.push(e.message)); await pg.route(/fonts\.g|cdnjs/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(500); let ok = 0; const p = n => { ok++; console.log('ok  ', n); };
  await pg.$eval('#pub-por', e => { e.value = 'Lillian'; });
  await pg.evaluate(() => window.__email.definir([
    { id: 'gm-1', status: 'nova', tipo: 'cliente', deNome: 'Fulana Exemplo', deEmail: 'fulana@exemplo.com', assunto: 'Fui citada numa execução fiscal', trecho: 'Bom dia, recebi hoje um mandado de citação. Meu CPF é 123.456.789-09.', doc: '123.456.789-09', recebidoEm: '2026-11-03T11:00:00Z' },
    { id: 'gm-2', status: 'nova', tipo: 'tribunal', deNome: 'TJCE', deEmail: 'naoresponda@tjce.jus.br', assunto: 'Intimação', trecho: 'Fica a parte intimada para se manifestar no prazo de 15 (quinze) dias.', cnj: '3011867-07.2025.8.06.0167', recebidoEm: '2026-11-03T12:00:00Z' },
    { id: 'gm-3', status: 'nova', tipo: 'outro', deNome: 'Loja', deEmail: 'ofertas@loja.com', assunto: 'Promoção', trecho: 'Compre já', recebidoEm: '2026-11-02T12:00:00Z' }]));
  await pg.click('#tab-fila'); assert.equal(await pg.$eval('#em-panel', e => e.hidden), false); assert.equal(await pg.textContent('#em-cnt'), '3'); p('painel mostra os e-mails pendentes na Fila');
  // abrir demanda: formulário preenchido, rota sugerida urgência, registra e marca o e-mail
  await pg.evaluate(() => { const L = window.__email.todos(); L.find(x => x.id === 'gm-1').site = { formato: 'rd-site', versao: 1, tipo: 'contato', contato: { nome: 'Fulana Exemplo', fone: '(88) 9 0000-0000' } }; window.__email.definir(L); });
  await pg.click('[data-em-abre="gm-1"]'); assert.equal(await pg.inputValue('#nm-canal'), 'Site'); assert.equal(await pg.inputValue('#nm-contato'), '(88) 9 0000-0000'); await pg.selectOption('#nm-canal', 'E-mail'); await pg.fill('#nm-contato', 'fulana@exemplo.com'); assert.equal(await pg.inputValue('#nm-canal'), 'E-mail'); assert.equal(await pg.inputValue('#nm-contato'), 'fulana@exemplo.com'); assert.equal(await pg.inputValue('#nm-rota'), 'urgencia'); assert.equal(await pg.inputValue('#nm-doc'), '123.456.789-09');
  await pg.check('#nm-lgpd'); await pg.click('#nm-salva'); await pg.waitForTimeout(200);
  let e = await pg.evaluate(() => window.__email.todos().find(x => x.id === 'gm-1')); assert.equal(e.status, 'registrado'); assert.match(e.proto, /^RD-\d{4}-\d{4}$/); assert.equal(e.tratadoPor, 'Lillian');
  assert.ok(await pg.evaluate(p => window.__atend.estado().convs.some(c => c.ficha && c.ficha.proto === p && c.canal === 'E-mail'), e.proto)); p('abrir demanda: formulário vem preenchido, demanda criada e e-mail marcado com o protocolo');
  // cancelar não marca
  await pg.click('#tab-fila'); await pg.click('[data-em-abre="gm-3"]'); await pg.click('#nm-cancela'); assert.equal(await pg.evaluate(() => window.__email.todos().find(x => x.id === 'gm-3').status), 'nova'); p('cancelar o formulário mantém o e-mail pendente');
  // tribunal vai para Prazos
  await pg.click('#tab-fila'); await pg.click('[data-em-pub="gm-2"]'); assert.equal(await pg.$eval('#v-prazos', e => e.hidden), false); assert.match(await pg.inputValue('#pub-tx'), /^Processo 3011867-07\.2025\.8\.06\.0167 - Intimação/); assert.equal(await pg.inputValue('#pub-data'), '2026-11-03');
  assert.equal(await pg.evaluate(() => window.__email.todos().find(x => x.id === 'gm-2').status), 'em Prazos'); p('intimação por e-mail vai para Prazos com o texto e a data');
  // descartar pede confirmação
  await pg.click('#tab-fila'); await pg.click('[data-em-desc="gm-3"]'); assert.equal(await pg.evaluate(() => window.__email.todos().find(x => x.id === 'gm-3').status), 'nova'); await pg.click('[data-em-desc="gm-3"]');
  assert.equal(await pg.evaluate(() => window.__email.todos().find(x => x.id === 'gm-3').status), 'descartado'); assert.equal(await pg.textContent('#em-cnt'), ''); p('descartar pede confirmação; contador zera');
  assert.deepEqual(erros, []); console.log(ok + ' ok'); await b.close(); })().catch(e => { console.error('FALHA', e.message); process.exit(1); });
