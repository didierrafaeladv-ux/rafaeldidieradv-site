// Ponte com o n8n nas páginas: token no cabeçalho, envio/retorno do Atendimento e do CRM, pasta no Drive pelo prontoDrive, aplicaCNPJ.
// n8n simulado pelo Playwright (nenhuma rede real). Dados FICTÍCIOS. Uso: node ponte.e2e.js equipe/atendimento.html equipe/crm.html
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const path = require('path');
const TOKEN = 'tk_' + 'b'.repeat(40), BASE = 'https://n8n.exemplo.test';
(async () => { const b = await chromium.launch(); let ok = 0; const p = n => { ok++; console.log('ok  ', n); };
  const drive = { atendimento: null, crm: null }, chamadas = [];
  async function pagina(arq) {
    const pg = await b.newPage(); const erros = []; pg.on('pageerror', e => erros.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.route(/fonts\.g|cdnjs|jsdelivr/, r => r.abort());
    await pg.route(BASE + '/webhook/**', async r => { const req = r.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-rd-token' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      const h = req.headers(), body = JSON.parse(req.postData() || '{}'); chamadas.push({ url: req.url(), token: h['x-rd-token'], body });
      const j = (s, o) => r.fulfill({ status: s, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify(o) });
      if (h['x-rd-token'] !== TOKEN) return j(401, { ok: false, erro: 'token inválido' });
      if (req.url().endsWith('rd-sync-base')) { if (body.acao === 'ping') return j(200, { ok: true, pessoa: 'Pessoa Teste', timestamp: 'T' });
        if (body.acao === 'salvar') { drive[body.modulo] = body.dados; return j(200, { ok: true, timestamp: 'T1' }); } return j(200, { ok: true, timestamp: 'T2', dados: drive[body.modulo] }); }
      if (req.url().endsWith('rd-pronto-drive')) return j(200, { ok: true, folderUrl: 'https://drive.google.com/drive/folders/PASTA_FICTICIA', fileId: '' });
      return j(404, { ok: false }); });
    await pg.goto('file://' + path.resolve(arq)); await pg.waitForTimeout(400); return { pg, erros };
  }
  const configura = async (pg, abrir) => { await pg.click(abrir); await pg.fill('#rb-painel [data-rb="base"]', BASE + '/webhook/rd-sync-base');
    await pg.fill('#rb-painel [data-rb="pessoa"]', 'Pessoa Teste'); await pg.fill('#rb-painel [data-rb="token"]', TOKEN); await pg.click('#rb-painel [data-rb="salvar"]');
    await pg.click('#rb-painel [data-rb="testar"]'); await pg.waitForFunction(() => /Conexão ok/.test(document.querySelector('#rb-painel [data-rb="st"]').textContent)); };

  // ---------- Atendimento ----------
  const A = await pagina(process.argv[2]); const pa = A.pg;
  await configura(pa, '#rb-box summary'); p('atendimento: painel salva endereço, nome e token e o teste de conexão passa');
  assert.ok(chamadas.every(c => c.token === TOKEN && !c.url.includes(TOKEN))); p('token só no cabeçalho x-rd-token');
  const fic = { id: 'c-fic-1', canal: 'WhatsApp', nome: 'Pessoa Fictícia do Drive', tel: '(88) 9 0000-0000', cliente: false, etapa: 'fim', msgs: [{ de: 'cli', tx: 'Olá', em: new Date().toISOString() }], ficha: { proto: 'RD-2026-0999', rota: 'nova', resumo: 'Teste', status: 'Novo', log: [] } };
  drive.atendimento = { convs: [fic], seq: 999 };
  await pa.click('#rb-trazer'); await pa.waitForFunction(() => /nova\(s\) neste navegador/.test(document.getElementById('rb-st').textContent));
  assert.equal(await pa.evaluate(() => window.__atend.estado().convs.some(c => c.id === 'c-fic-1')), true); p('trazer do Drive junta a conversa nova');
  await pa.click('#rb-enviar'); await pa.waitForFunction(() => /Enviado ao Drive/.test(document.getElementById('rb-st').textContent));
  assert.ok(drive.atendimento.convs.some(c => c.id === 'c-fic-1') && !drive.atendimento.convs.some(c => c.id === 'c1')); p('enviar ao Drive manda só conversas reais (sem as de exemplo)');
  // aplicaCNPJ: resultado colado vai à ficha da aba Documentos
  await pa.click('#tab-docs'); await pa.click('details.cnpjbox summary'); await pa.fill('#cn-num', '11.222.333/0001-81');
  await pa.fill('#cn-cola', JSON.stringify({ cnpj: '11222333000181', razao_social: 'EMPRESA FICTÍCIA DE TESTE LTDA', cnae_fiscal: 6911701, cnae_fiscal_descricao: 'Serviços advocatícios', descricao_situacao_cadastral: 'ATIVA', logradouro: 'Rua Exemplo', numero: '1', municipio: 'SOBRAL', uf: 'CE', cep: '62000000', qsa: [{ nome_socio: 'SÓCIA FICTÍCIA', qualificacao_socio: 'Sócio-Administrador' }] }));
  await pa.click('#cn-aplica'); await pa.waitForSelector('#extracao:not([hidden])');
  assert.equal(await pa.inputValue('#v-RAZAO'), 'EMPRESA FICTÍCIA DE TESTE LTDA'); assert.equal(await pa.inputValue('#v-CNPJ'), '11.222.333/0001-81');
  const fonte = require('fs').readFileSync(path.resolve(process.argv[2]), 'utf8'); assert.ok(/function aplicaCNPJ\(n\)\{[^]*?CASOS\.pj\.campos=/.test(fonte) && /aplicaCNPJ\(CNPJ\.normalizar\(await r\.text\(\)\)\)/.test(fonte)); p('aplicaCNPJ leva a consulta colada à ficha (razão social e CNPJ)');
  assert.deepEqual(A.erros, []);

  // ---------- CRM ----------
  const C = await pagina(process.argv[3]); const pc = C.pg;
  await pc.evaluate(() => { const l = { id: 'doc-11222333000181', nome: 'Pessoa Fictícia', empresa: 'Empresa Fictícia de Teste Ltda', contato: '', area: 'Tributário', origem: 'Site', valor: '', resp: 'Pessoa Teste', etapa: 'contratado', ultimo: '2026-11-10', proxAcao: '', proxData: '', lgpd: { status: 'sim', data: '2026-11-01', forma: 'teste' }, criado: '2026-11-01', hist: [],
    travas: { conflito: { status: 'ok', por: 'Pessoa Teste', data: '2026-11-02' }, contrato: true, procuracao: true, docsLink: 'https://drive.google.com/x', liberado: { por: 'Pessoa Teste', data: '2026-11-05' } } };
    localStorage.setItem('crm-leads-rd-v1', JSON.stringify([l])); }); await pc.reload(); await pc.waitForTimeout(300);
  assert.match(await pc.textContent('#b-pastas'), /Criar pastas no Drive \(1\)/); assert.match(await pc.textContent('.card[data-id="doc-11222333000181"]'), /pronto para a pasta/); p('crm: prontoDrive acende o selo e o botão de pastas pendentes');
  await configura(pc, '#rb-box summary');
  await pc.click('.card[data-id="doc-11222333000181"]'); assert.equal(await pc.isDisabled('#t-drive'), false);
  await pc.click('#t-drive'); await pc.waitForFunction(() => /Pasta criada/.test(document.getElementById('t-drive-st').textContent));
  const pd = chamadas.filter(c => c.url.endsWith('rd-pronto-drive')).pop().body; assert.deepEqual([pd.leadId, pd.nome, pd.cnpj, pd.tipo], ['doc-11222333000181', 'Empresa Fictícia de Teste Ltda', '11.222.333/0001-81', 'Tributário']);
  const salvo = await pc.evaluate(() => JSON.parse(localStorage.getItem('crm-leads-rd-v1'))[0].travas.pastaDrive); assert.equal(salvo, 'https://drive.google.com/drive/folders/PASTA_FICTICIA');
  assert.equal(await pc.isDisabled('#t-drive'), true); p('ficha: "Criar pasta no Drive" chama o n8n, grava o link e se desliga');
  await pc.keyboard.press('Escape'); await pc.click('#rb-enviar'); await pc.waitForFunction(() => /Enviado ao Drive: 1 lead/.test(document.getElementById('rb-st').textContent)); p('crm: enviar leads ao Drive (sem os de demonstração)');
  assert.deepEqual(C.erros, []); console.log(`\n${ok} ok`); await b.close();
})().catch(e => { console.error('FALHA', e.message); process.exit(1); });
