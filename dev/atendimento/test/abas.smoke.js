const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => erros.push(e.message)); await pg.route(/fonts\.g|cdnjs/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(500);
  for (const t of ['ind', 'regras', 'prazos', 'materias', 'tarefas', 'auto', 'fin', 'docs', 'fila', 'mesa']) { const el = await pg.$('#tab-' + t); if (el) { await el.click(); await pg.waitForTimeout(150); } else console.log('sem aba', t); }
  await pg.evaluate(() => window.__rotinas && window.__rotinas.definir([{ id: 'publicacoes', em: new Date().toISOString(), status: 'ok' }]));
  console.log('erros:', JSON.stringify(erros)); await b.close(); })();
