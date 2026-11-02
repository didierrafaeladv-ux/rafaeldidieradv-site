// Indicadores dos controles de qualidade (dados FICTÍCIOS)
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const path = require('path');
(async () => { const b = await chromium.launch(); const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => erros.push(e.message)); await pg.route(/fonts\.g|cdnjs/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(500); let ok = 0; const p = n => { ok++; console.log('ok  ', n); };
  const r = await pg.evaluate(() => { const hoje = '2026-11-02';
    const convs = [{ ficha: { proto: 'RD-2026-0001', rota: 'processo', status: 'Em andamento', astrea: { cnj: '3011867-07.2025.8.06.0167' }, revisoes: [{ peca: 'x', por: 'Rafael', em: hoje }], escopo: { dentro: 'defesa' } } },
      { ficha: { proto: 'RD-2026-0002', rota: 'urgencia', status: 'Em andamento', astrea: { cnj: '3006831-47.2026.8.06.0167' } } },
      { ficha: { proto: 'RD-2026-0003', rota: 'nova', status: 'Concluída', licoes: { em: hoje } } }, { ficha: { proto: 'RD-2026-0004', rota: 'docs', status: 'Concluída' } },
      { ficha: { proto: 'RD-2026-0005', rota: 'fin', status: 'Concluída' } }];
    const pubs = [{ cnj: 'A', venc: '2026-10-30', status: 'lancada', conferidaPor: 'David' }, { cnj: 'B', venc: '2026-11-02', status: 'lancada' }, { cnj: 'C', venc: '2026-11-05', status: 'nova' }, { cnj: 'D', venc: '2026-08-01', status: 'nova' }];
    return window.__qualidade.calcular(convs, pubs, hoje); });
  const by = n => r.find(x => x.nome.startsWith(n));
  assert.deepEqual([by('Prazos lançados').feitos, by('Prazos lançados').total], [2, 3]); assert.deepEqual([by('Prazos conferidos').pct, by('Prazos conferidos').dica], [33, '1 já vencido(s) sem conferência']); p('prazos: lançados e conferidos na janela de 30 dias + 5 úteis; vencidos sem conferência destacados');
  assert.deepEqual([by('Processos com revisão').pct, by('Processos com revisão').pend], [50, ['RD-2026-0002']]); assert.equal(by('Casos abertos com escopo').pct, 50); assert.deepEqual([by('Casos concluídos').pct, by('Casos concluídos').total], [50, 2]); p('revisão, escopo e lições (financeiro e agenda ficam fora)');
  await pg.click('#tab-ind'); await pg.waitForTimeout(200); const t = await pg.textContent('#cq-panel'); assert.match(t, /Controles de qualidade/); assert.match(t, /Prazos conferidos por outra pessoa/); p('painel aparece na aba Indicadores');
  assert.deepEqual(erros, []); console.log(ok + ' ok'); await b.close(); })().catch(e => { console.error('FALHA', e.message); process.exit(1); });
