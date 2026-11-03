// Site: pacote padronizado RD-SITE v1, consentimento LGPD e envio por WhatsApp ou e-mail (dados FICTÍCIOS). Uso: node site.e2e.js index.html
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => erros.push(e.message)); await pg.route(/fonts\.g|cdnjs|googletagmanager/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(400); let ok = 0; const p = n => { ok++; console.log('ok  ', n); };
  const extrai = href => { const body = decodeURIComponent(href.split('&body=')[1]); const j = body.split('--- RD-SITE v1 (não apague) ---\n')[1].split('\n--- fim RD-SITE ---')[0]; return { body, pacote: JSON.parse(j), assunto: decodeURIComponent(href.split('subject=')[1].split('&')[0]) }; };
  // contato: consentimento obrigatório
  await pg.fill('#cNome', 'Fulana Exemplo'); await pg.fill('#cFone', '(88) 9 0000-0000'); await pg.selectOption('#cAss', { index: 1 }); await pg.fill('#cMsg', 'Recebi uma citação ontem.');
  await pg.click('#contactForm button[type=submit]'); assert.equal(await pg.$eval('#contactDone', e => e.hidden), true); p('sem o consentimento LGPD, o contato não é enviado');
  await pg.check('#cLgpd'); await pg.click('#contactForm button[type=submit]'); await pg.waitForTimeout(100);
  const wa = await pg.$eval('#contactDone a[href^="https://wa.me/"]', a => a.href), em = await pg.$eval('#contactDone a[href^="mailto:"]', a => a.href);
  assert.match(decodeURIComponent(wa), /Contato pelo site\nNome: Fulana Exemplo/); const x = extrai(em);
  assert.equal(x.assunto, '[Site] Contato pelo site — Fulana Exemplo'); assert.equal(x.pacote.formato, 'rd-site'); assert.equal(x.pacote.versao, 1); assert.equal(x.pacote.tipo, 'contato');
  assert.equal(x.pacote.contato.nome, 'Fulana Exemplo'); assert.equal(x.pacote.entrada.mensagem, 'Recebi uma citação ontem.'); assert.equal(x.pacote.consentimento.lgpd, true); assert.match(em, /^mailto:didierrafaeladv@gmail\.com/); p('contato: WhatsApp e e-mail, com o pacote RD-SITE v1 e o consentimento');
  // simulação de INSS
  await pg.fill('#kNotas', '80000'); await pg.fill('#kDevido', '3000'); await pg.click('#calcForm button[type=submit]');
  const xi = extrai(await pg.$eval('#calcOut a[href^="mailto:"]', a => a.href)); assert.equal(xi.pacote.tipo, 'simulacao_inss'); assert.equal(xi.pacote.entrada.notasMes, 80000); assert.equal(xi.pacote.resultado.retidoMes, 8800); assert.equal(xi.pacote.resultado.totalPeriodo, (8800 - 3000) * 60);
  assert.ok(await pg.$('#calcOut a[href^="https://wa.me/"]')); p('simulação de INSS sai com entrada e resultado no pacote');
  // simulação de regime
  await pg.fill('#sRec', '50000'); await pg.fill('#sFol', '15000'); await pg.click('#simForm button[type=submit]');
  const xr = extrai(await pg.$eval('#simOut a[href^="mailto:"]', a => a.href)); assert.equal(xr.pacote.tipo, 'simulacao_regime'); assert.ok(['simples', 'presumido'].includes(xr.pacote.resultado.melhor)); assert.equal(xr.pacote.entrada.receitaMes, 50000); p('Simples × Presumido sai com o pacote');
  // material (quando o botão abre o formulário)
  const temModal = await pg.$('button[data-material]'); if (temModal) { await temModal.click(); await pg.fill('#mNome', 'Beltrano'); await pg.fill('#mMail', 'b@exemplo.com'); await pg.click('#matForm button[type=submit]'); assert.equal(await pg.$eval('#matDone', e => e.hidden), true); await pg.check('#mLgpd'); await pg.click('#matForm button[type=submit]');
    assert.equal(extrai(await pg.$eval('#matDone a[href^="mailto:"]', a => a.href)).pacote.tipo, 'material'); p('pedido de material exige consentimento e sai com o pacote'); } else p('materiais pedidos direto pelo WhatsApp (sem n8n)');
  assert.ok(await pg.$('#termos details')); assert.match(await pg.textContent('footer'), /Termos de uso/); p('termos de uso publicados e ligados no rodapé');
  assert.deepEqual(erros, []); console.log(ok + ' ok'); await b.close(); })().catch(e => { console.error('FALHA', e.message); process.exit(1); });
