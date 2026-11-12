// Ponte com o n8n (equipe/js/webhook_bridge.js): token no cabeçalho, recusa, fila, cache e validações. Sem rede: fetch simulado.
const assert = require('node:assert/strict'); const path = require('path');
const P = require(path.join(__dirname, '../../../equipe/js/webhook_bridge.js'));
let ok = 0, f = 0; const fila = [];
const t = (n, fn) => fila.push([n, fn]);
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; };
const TOKEN = 'tk_' + 'a'.repeat(40);
// n8n simulado: confere o token e responde como o fluxo real
function n8n(tokens, estado) {
  estado = estado || { base: {}, chamadas: [] };
  const fn = async (url, o) => {
    estado.chamadas.push({ url, headers: o.headers, body: JSON.parse(o.body) });
    if (estado.fora) throw new TypeError('Failed to fetch');
    const resp = (status, j) => ({ ok: status < 300, status, json: async () => j });
    if (!tokens[o.headers['x-rd-token']]) return resp(401, { ok: false, erro: 'token inválido' });
    const b = JSON.parse(o.body);
    if (url.endsWith('/webhook/rd-sync-base')) {
      if (b.acao === 'ping') return resp(200, { ok: true, pessoa: tokens[o.headers['x-rd-token']], timestamp: 'T' });
      if (b.acao === 'salvar') { estado.base[b.modulo] = b.dados; return resp(200, { ok: true, timestamp: 'T1', dados: b.dados }); }
      return resp(200, { ok: true, timestamp: 'T2', dados: estado.base[b.modulo] || null });
    }
    if (url.endsWith('/webhook/rd-pronto-drive')) return resp(200, { ok: true, folderUrl: 'https://drive.google.com/drive/folders/PASTA', fileId: b.arquivoDocxBase64 ? 'ARQ' : '' });
    if (url.endsWith('/webhook/rd-orquestrador')) return resp(200, { ok: true, agentes: [], consolidado: {}, tokensUsados: 0 });
    return resp(404, { ok: false });
  };
  fn.estado = estado; return fn;
}

t('configuração: limpa o endereço, exige https e token longo', () => {
  const B = P.criar({ storage: mem(), fetch: n8n({}) });
  const c = B.configurar({ base: 'https://n8n.exemplo.com.br/webhook/rd-sync-base/', token: TOKEN, pessoa: 'Pessoa Teste' });
  assert.equal(c.base, 'https://n8n.exemplo.com.br'); assert.ok(B.configurado());
  assert.throws(() => B.configurar({ base: 'http://n8n.exemplo.com.br' }), /https/);
  assert.throws(() => B.configurar({ token: 'curto' }), /Token curto/);
});
t('envia o token no cabeçalho x-rd-token (nunca no endereço) e o nome da pessoa no corpo', async () => {
  const F = n8n({ [TOKEN]: 'Pessoa Teste' }); const B = P.criar({ storage: mem(), fetch: F });
  B.configurar({ base: 'https://n8n.exemplo.com.br', token: TOKEN, pessoa: 'Pessoa Teste' });
  const r = await B.testar(); assert.equal(r.ok, true); assert.equal(r.pessoa, 'Pessoa Teste');
  const ch = F.estado.chamadas[0]; assert.equal(ch.headers['x-rd-token'], TOKEN); assert.ok(!ch.url.includes(TOKEN)); assert.equal(ch.body.pessoa, 'Pessoa Teste');
});
t('token recusado: avisa e não guarda na fila', async () => {
  const S = mem(); const B = P.criar({ storage: S, fetch: n8n({}) }); B.configurar({ base: 'https://n8n.exemplo.com.br', token: TOKEN });
  const r = await B.syncBase('salvar', 'crm', [{ id: 'l1' }]); assert.equal(r.ok, false); assert.equal(r.recusado, true); assert.equal(B.fila().length, 0);
});
t('sem conexão: "salvar" vai para a fila (só o mais recente por módulo) e é reenviado depois', async () => {
  const F = n8n({ [TOKEN]: 'P' }); F.estado.fora = true; const B = P.criar({ storage: mem(), fetch: F }); B.configurar({ base: 'https://n8n.exemplo.com.br', token: TOKEN });
  let r = await B.syncBase('salvar', 'crm', [{ id: 'l1' }]); assert.equal(r.naFila, true);
  r = await B.syncBase('salvar', 'crm', [{ id: 'l1' }, { id: 'l2' }]); assert.equal(B.fila().length, 1);
  await B.prontoDrive({ leadId: 'l2', nome: 'Empresa Fictícia', cnpj: '11222333000181', tipo: 'Recupera' }); assert.equal(B.fila().length, 2);
  F.estado.fora = false; const rr = await B.reenviar(); assert.deepEqual([rr.enviados, rr.pendentes], [2, 0]);
  assert.equal(F.estado.base.crm.length, 2);
  assert.equal(F.estado.chamadas.filter(c => c.url.endsWith('rd-pronto-drive')).pop().body.cnpj, '11.222.333/0001-81');
});
t('"ler" sem conexão devolve a última cópia guardada', async () => {
  const F = n8n({ [TOKEN]: 'P' }); const B = P.criar({ storage: mem(), fetch: F }); B.configurar({ base: 'https://n8n.exemplo.com.br', token: TOKEN });
  await B.syncBase('salvar', 'atendimento', { convs: [1] }); let r = await B.syncBase('ler', 'atendimento'); assert.deepEqual(r.dados, { convs: [1] });
  F.estado.fora = true; r = await B.syncBase('ler', 'atendimento'); assert.equal(r.ok, false); assert.deepEqual(r.cache.dados, { convs: [1] });
});
t('orquestrador nunca entra na fila; pronto-drive valida os campos; módulo e ação validados', async () => {
  const F = n8n({ [TOKEN]: 'P' }); F.estado.fora = true; const B = P.criar({ storage: mem(), fetch: F }); B.configurar({ base: 'https://n8n.exemplo.com.br', token: TOKEN });
  const r = await B.orquestrador('lote', '{}', {}); assert.equal(r.ok, false); assert.equal(B.fila().length, 0);
  assert.match((await B.prontoDrive({ nome: 'X' })).erro, /leadId, tipo/);
  await assert.rejects(B.syncBase('apagar', 'crm'), /Ação inválida/); await assert.rejects(B.syncBase('ler', 'financeiro'), /Módulo inválido/);
});
t('sem configuração: avisa e guarda "salvar" na fila', async () => {
  const B = P.criar({ storage: mem(), fetch: n8n({}) }); const r = await B.syncBase('salvar', 'crm', []); assert.equal(r.semConfig, true); assert.equal(r.naFila, true);
});

(async () => { for (const [n, fn] of fila) { try { await fn(); ok++; console.log('ok  ', n); } catch (e) { f++; console.log('FALHA', n, '\n     ', e.message); } }
  console.log(`\n${ok} ok, ${f} falha(s)`); process.exit(f ? 1 : 0); })();
