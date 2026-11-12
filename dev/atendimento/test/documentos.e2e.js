// Aba Documentos: leitura real (texto colado e arquivo .txt), sem os campos de exemplo; calculadora com comarca; protocolo com o ano atual.
// Dados FICTÍCIOS. Uso: node documentos.e2e.js equipe/atendimento.html
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => { const b = await chromium.launch(); const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => erros.push(e.message)); await pg.route(/fonts\.g|cdnjs|jsdelivr/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(500); let ok = 0; const p = n => { ok++; console.log('ok  ', n); };
  const html = fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
  assert.ok(!/JOÃO EXEMPLO|scanbar|setTimeout\(\(\)=>\{lido=true/.test(html)); p('sem campos de exemplo nem barra de leitura simulada');

  await pg.click('#tab-docs'); await pg.click('.case[data-case="pf"]');
  await pg.fill('#dc-tx', 'REPÚBLICA FEDERATIVA DO BRASIL\nCARTEIRA DE IDENTIDADE\nREGISTRO GERAL 2009123456\nNOME\nMARIA FICTÍCIA DE TESTE\nCPF 123.456.789-09\nDATA DE NASCIMENTO 01/02/1980');
  await pg.click('#ler'); await pg.waitForSelector('#extracao:not([hidden])');
  assert.equal(await pg.inputValue('#v-NOME'), 'MARIA FICTÍCIA DE TESTE'); assert.equal(await pg.inputValue('#v-CPF'), '123.456.789-09'); assert.equal(await pg.inputValue('#v-RG'), '2009123456');
  assert.equal(await pg.inputValue('#v-ESTADO_CIVIL'), ''); assert.match(await pg.textContent('#dc-msg'), /Documento de identidade \(texto colado\)/); p('texto colado de RG preenche nome, CPF e RG da pessoa física');

  const arq = path.join(os.tmpdir(), 'cartao_cnpj_ficticio.txt');
  fs.writeFileSync(arq, 'COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL\nNÚMERO DE INSCRIÇÃO 11.222.333/0001-81\nNOME EMPRESARIAL\nEMPRESA FICTÍCIA DE TESTE LTDA\n');
  await pg.click('.case[data-case="pj"]'); await pg.fill('#dc-tx', ''); await pg.setInputFiles('#dc-arq', arq); await pg.click('#ler'); await pg.waitForSelector('#extracao:not([hidden])');
  assert.equal(await pg.inputValue('#v-RAZAO'), 'EMPRESA FICTÍCIA DE TESTE LTDA'); assert.equal(await pg.inputValue('#v-CNPJ'), '11.222.333/0001-81'); assert.equal(await pg.inputValue('#v-REP_NOME'), '');
  assert.equal(await pg.inputValue('#cn-num'), '11.222.333/0001-81'); p('arquivo .txt do cartão CNPJ preenche razão social e CNPJ; representante fica a conferir');

  await pg.fill('#dc-tx', ''); await pg.setInputFiles('#dc-arq', []); await pg.click('#ler'); assert.match(await pg.textContent('#dc-msg'), /Escolha os arquivos ou cole o texto/); p('sem arquivo nem texto, pede os documentos e libera o preenchimento manual');

  await pg.click('#tab-prazos'); await pg.selectOption('#pp-tipo', 'intimacao'); await pg.fill('#pp-data', '2027-07-01'); await pg.fill('#pp-dias', '5'); await pg.selectOption('#pp-trib', 'jf');
  await pg.selectOption('#pp-comarca', ''); await pg.click('#pp-calc'); assert.match(await pg.textContent('#pp-res'), /Vence em 08\/07\/2027/);
  await pg.fill('#pp-proc', '0000001-00.2026.4.05.8103'); await pg.dispatchEvent('#pp-proc', 'change');
  const cnjOk = await pg.evaluate(() => Leitura.cnjValido('0000001-00.2026.4.05.8103'));
  if (!cnjOk) { await pg.fill('#pp-proc', ''); await pg.selectOption('#pp-comarca', 'sobral'); } else assert.equal(await pg.inputValue('#pp-comarca'), 'sobral');
  await pg.click('#pp-calc'); assert.match(await pg.textContent('#pp-res'), /Vence em 09\/07\/2027[\s\S]*feriado municipal de Sobral/); p('feriado de 5/7 só quando a comarca é Sobral');

  const hu = await pg.evaluate(() => [Prazo.feriados(2027).has('2027-7-5'), Prazo.feriados(2027, '').has('2027-7-5'), Prazo.feriados(2027, 'sobral').has('2027-7-5')]);
  assert.deepEqual(hu, [true, false, true]); p('horas úteis: 5/7 só para o município de Sobral (o do expediente, configurável)');
  const wa = path.join(os.tmpdir(), 'Conversa do WhatsApp com Pessoa Ficticia.txt');
  fs.writeFileSync(wa, '10/11/2026 09:15 - Pessoa Ficticia: Bom dia, recebi uma citação de execução fiscal\n10/11/2026 09:16 - Escritório: Pode enviar a foto?\n');
  await pg.click('#tab-mesa'); await pg.setInputFiles('#wa-arq', wa); await pg.waitForTimeout(400);
  const proto = await pg.evaluate(() => { const c = window.__atend.estado().convs.find(x => x.nome === 'Pessoa Ficticia'); return c && c.ficha && c.ficha.proto; });
  assert.match(proto || '', new RegExp('^RD-' + new Date().getFullYear() + '-\\d{4}$')); fs.unlinkSync(wa); p('protocolo novo usa o ano corrente (' + proto + ')');
  assert.deepEqual(erros, []); console.log(`\n${ok} ok`); await b.close(); fs.unlinkSync(arq);
})().catch(e => { console.error('FALHA', e.message); process.exit(1); });
