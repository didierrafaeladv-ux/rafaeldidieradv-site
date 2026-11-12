/* Ponte com o n8n (RDWebhookBridge) — Rafael Didier Advocacia (v1.0, 11/11/2026).
 * Único caminho das páginas da equipe (GitHub Pages, estáticas) para fora: os webhooks do n8n. Nenhuma chave da Anthropic
 * ou do Google fica no site. Cada pessoa da equipe tem um TOKEN próprio, guardado só no navegador dela (localStorage) e
 * enviado no cabeçalho "x-rd-token"; o n8n confere o token antes de qualquer ação e recusa o que não conhece.
 * Endpoints (o endereço do n8n é configurado na tela, nunca no código):
 *   /webhook/rd-sync-base    { acao: 'ler'|'salvar'|'ping', modulo: 'atendimento'|'crm'|'orquestrador', dados }  → { ok, timestamp, dados }
 *   /webhook/rd-pronto-drive { leadId, nome, cnpj, tipo: 'PlanejaTrib'|'Recupera'|..., arquivoDocxBase64?, nomeArquivo?, tarefa? } → { ok, folderUrl, fileId }
 *   /webhook/rd-orquestrador { modo: 'auditoria'|'lote', contextoEnxuto, parametros } → { ok, agentes, consolidado, tokensUsados }
 * Sem conexão: "salvar" e "pronto-drive" vão para uma fila no navegador e são reenviados depois; "ler" devolve a última cópia guardada.
 * O orquestrador (que gasta API) nunca entra na fila: só roda quando a pessoa clica. Navegador (window.RDWebhookBridge) e node. */
(function (root) {
  'use strict';
  const ROTAS = { syncBase: '/webhook/rd-sync-base', prontoDrive: '/webhook/rd-pronto-drive', orquestrador: '/webhook/rd-orquestrador' };
  const K_CONF = 'rd-ponte-n8n', K_FILA = 'rd-ponte-fila', K_CACHE = 'rd-ponte-cache-';
  const MAX_FILA_DOCX = 1500000;   // base64 acima disso não cabe com folga no localStorage: não entra na fila
  const MODULOS = ['atendimento', 'crm', 'orquestrador'];

  function criar(opt) {
    opt = opt || {};
    const S = opt.storage || (function () { try { return root.localStorage; } catch (e) { return null; } })();
    const F = opt.fetch || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    const agora = opt.agora || (() => new Date().toISOString());
    const ler = (k, p) => { try { const v = S && S.getItem(k); return v ? JSON.parse(v) : p; } catch (e) { return p; } };
    const grava = (k, v) => { try { if (!S) return false; S.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

    function config() { return Object.assign({ base: '', token: '', pessoa: '' }, ler(K_CONF, {})); }
    // aceita o endereço do n8n com ou sem "/webhook/..." no fim; só https (ou localhost para teste)
    function configurar(c) {
      const x = Object.assign(config(), c || {});
      x.base = String(x.base || '').trim().replace(/\/+$/, '').replace(/\/webhook(-test)?(\/.*)?$/, '');
      x.token = String(x.token || '').trim(); x.pessoa = String(x.pessoa || '').trim();
      if (x.base && !/^https:\/\/[^\s/]+/.test(x.base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(x.base)) throw new Error('Use o endereço https do n8n (ex.: https://n8n.seudominio.com.br).');
      if (x.token && x.token.length < 24) throw new Error('Token curto demais: use o token de 40+ caracteres gerado para você.');
      if (!grava(K_CONF, x)) throw new Error('Este navegador não deixou guardar a configuração.');
      return x;
    }
    function esquecer() { try { S && S.removeItem(K_CONF); } catch (e) {} }
    const configurado = () => { const c = config(); return !!(c.base && c.token); };

    async function post(rota, payload, ms) {
      const c = config();
      if (!c.base || !c.token) throw Object.assign(new Error('Conexão com o n8n não configurada (endereço e token).'), { semConfig: true });
      if (!F) throw new Error('Este navegador não faz chamadas de rede.');
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), ms || 60000) : null;
      try {
        let r;
        try {
          r = await F(c.base + ROTAS[rota], { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rd-token': c.token },
            body: JSON.stringify(Object.assign({}, payload, { pessoa: c.pessoa || '', enviadoEm: agora() })), signal: ctl ? ctl.signal : undefined });
        } catch (e) { throw new Error(e && e.name === 'AbortError' ? 'O n8n demorou demais para responder.' : 'Sem conexão com o n8n (' + ((e && e.message) || 'erro de rede') + ').'); }
        let j = null; try { j = await r.json(); } catch (e) {}
        if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Token recusado pelo n8n: confira o token desta pessoa.'), { recusado: true });
        if (!r.ok || !j || j.ok === false) throw new Error((j && j.erro) || ('O n8n respondeu ' + r.status + '.'));
        return j;
      } finally { if (t) clearTimeout(t); }
    }

    function fila() { return ler(K_FILA, []); }
    // guarda para reenviar; de "salvar" do mesmo módulo fica só o mais recente
    function enfileirar(rota, payload) {
      let f = fila();
      if (rota === 'syncBase') f = f.filter(x => !(x.rota === 'syncBase' && x.payload.modulo === payload.modulo));
      f.push({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), rota, payload, em: agora() });
      return grava(K_FILA, f);
    }
    async function enviar(rota, payload, o) {
      o = o || {};
      try { return await post(rota, payload, o.ms); }
      catch (e) {
        if (e.recusado || !o.fila) return { ok: false, erro: e.message, semConfig: !!e.semConfig, recusado: !!e.recusado };
        const g = enfileirar(rota, payload);
        return { ok: false, naFila: g, semConfig: !!e.semConfig, erro: e.message + (g ? ' Ficou na fila deste navegador e será reenviado.' : ' Sem espaço no navegador para guardar: tente de novo mais tarde.') };
      }
    }
    async function reenviar() {
      const f = fila(), resto = []; let enviados = 0, parou = '';
      for (const it of f) {
        if (parou) { resto.push(it); continue; }
        try { await post(it.rota, it.payload); enviados++; }
        catch (e) { resto.push(it); if (e.recusado || e.semConfig || /Sem conexão|demorou/.test(e.message)) parou = e.message; }
      }
      grava(K_FILA, resto);
      return { enviados, pendentes: resto.length, erro: parou };
    }

    async function syncBase(acao, modulo, dados) {
      if (!['ler', 'salvar'].includes(acao)) throw new Error('Ação inválida: use "ler" ou "salvar".');
      if (!MODULOS.includes(modulo)) throw new Error('Módulo inválido: ' + modulo + '.');
      if (acao === 'salvar') {
        grava(K_CACHE + modulo, { timestamp: agora(), dados });
        return enviar('syncBase', { acao, modulo, dados }, { fila: true });
      }
      try { const j = await post('syncBase', { acao, modulo }); grava(K_CACHE + modulo, { timestamp: j.timestamp || agora(), dados: j.dados }); return j; }
      catch (e) { const c = ler(K_CACHE + modulo, null); return { ok: false, erro: e.message, recusado: !!e.recusado, cache: c }; }
    }
    function prontoDrive(d) {
      d = d || {};
      const falta = ['leadId', 'nome', 'tipo'].filter(k => !String(d[k] || '').trim());
      if (falta.length) return Promise.resolve({ ok: false, erro: 'Faltam dados para a pasta: ' + falta.join(', ') + '.' });
      const cnpj = String(d.cnpj || '').replace(/\D/g, '');
      const p = Object.assign({}, d, { cnpj: cnpj ? (cnpj.length === 14 ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : cnpj) : '' });
      return enviar('prontoDrive', p, { fila: !p.arquivoDocxBase64 || p.arquivoDocxBase64.length <= MAX_FILA_DOCX, ms: 120000 });
    }
    function orquestrador(modo, contextoEnxuto, parametros) {
      if (!['auditoria', 'lote'].includes(modo)) return Promise.resolve({ ok: false, erro: 'Modo inválido.' });
      return enviar('orquestrador', { modo, contextoEnxuto: contextoEnxuto || '', parametros: parametros || {} }, { fila: false, ms: 300000 });
    }
    const testar = () => post('syncBase', { acao: 'ping', modulo: 'orquestrador' }).then(j => ({ ok: true, pessoa: j.pessoa || '', timestamp: j.timestamp }), e => ({ ok: false, erro: e.message }));

    // painel de configuração reaproveitado nas três páginas; cls = classes de botão da página
    function painel(el, o) {
      o = o || {}; const btn = o.btn || 'btn', d = root.document; if (!el || !d) return;
      const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      function render(msg) {
        const c = config(), n = fila().length;
        el.innerHTML = '<div style="display:grid;gap:6px">' +
          '<input data-rb="base" aria-label="Endereço do n8n" placeholder="Endereço do n8n (https://...)" autocomplete="off" value="' + esc(c.base) + '">' +
          '<input data-rb="pessoa" aria-label="Seu nome" placeholder="Seu nome (ex.: Victor)" autocomplete="off" value="' + esc(c.pessoa) + '">' +
          '<input data-rb="token" aria-label="Seu token" type="password" autocomplete="off" placeholder="' + (c.token ? 'Token guardado neste navegador (deixe em branco para manter)' : 'Seu token pessoal (fornecido pelo Rafael)') + '">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="' + btn + '" data-rb="salvar">Salvar</button><button type="button" class="' + btn + ' ghost" data-rb="testar">Testar conexão</button>' +
          (n ? '<button type="button" class="' + btn + ' ghost" data-rb="reenviar">Reenviar fila (' + n + ')</button>' : '') +
          (c.token ? '<button type="button" class="' + btn + ' ghost" data-rb="esquecer">Apagar deste navegador</button>' : '') + '</div>' +
          '<div role="status" data-rb="st" style="font-size:12.5px">' + esc(msg || (configurado() ? 'Conexão configurada' + (c.pessoa ? ' para ' + c.pessoa : '') + '.' : 'Sem conexão configurada: os dados ficam só neste navegador.') + (n ? ' ' + n + ' envio(s) na fila.' : '')) + '</div></div>';
      }
      el.addEventListener('click', async ev => {
        const a = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-rb'); if (!a) return;
        const v = k => el.querySelector('[data-rb="' + k + '"]').value;
        try {
          if (a === 'salvar') { const tk = v('token'); configurar(Object.assign({ base: v('base'), pessoa: v('pessoa') }, tk ? { token: tk } : {})); render('Configuração salva neste navegador.'); }
          else if (a === 'testar') { render('Testando…'); const r = await testar(); render(r.ok ? 'Conexão ok: o n8n reconheceu o token' + (r.pessoa ? ' de ' + r.pessoa : '') + '.' : r.erro); }
          else if (a === 'reenviar') { render('Reenviando…'); const r = await reenviar(); render(r.enviados + ' enviado(s); ' + r.pendentes + ' pendente(s).' + (r.erro ? ' ' + r.erro : '')); }
          else if (a === 'esquecer') { esquecer(); render('Endereço e token apagados deste navegador.'); }
          else return;
          if (o.aoMudar) o.aoMudar();
        } catch (e) { render(e.message); }
      });
      render();
    }
    return { ROTAS, MODULOS, config, configurar, esquecer, configurado, fila, reenviar, syncBase, prontoDrive, orquestrador, testar, painel, versao: '1.0' };
  }
  const API = criar(); API.criar = criar;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RDWebhookBridge = API;
})(typeof window !== 'undefined' ? window : globalThis);
