/* CRM de leads — RD Advocacia (v1.0, 30/10/2026). Regras puras: indicadores, filtros, prazos e CSV.
 * Navegador (window.CRM) e node. */
(function (root) {
  'use strict';
  const ETAPAS = [
    { k: 'novo', n: 'Novo contato' }, { k: 'reuniao', n: 'Primeira reunião' }, { k: 'proposta', n: 'Proposta enviada' },
    { k: 'contratado', n: 'Contratado' }, { k: 'perdido', n: 'Não avançou' }];
  const ABERTAS = new Set(['novo', 'reuniao', 'proposta']);
  const AREAS = ['Tributário', 'Execução fiscal', 'Cível', 'Administrativo e licitações', 'Empresarial e societário', 'Imobiliário', 'Consumidor', 'Previdenciário', 'Trabalhista', 'Outra'];
  const ORIGENS = ['Indicação', 'Site', 'Redes sociais', 'Evento', 'WhatsApp', 'Cliente da carteira', 'Outra'];
  const MOTIVOS = ['Preço', 'Prazo', 'Desistiu ou adiou', 'Escolheu outro escritório', 'Resolveu com o contador', 'Fora do perfil do escritório', 'Conflito de interesses', 'Sem retorno do contato', 'Outro'];
  const DIA = 86400000;

  const hojeISO = (d) => { const x = d || new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dias = (de, ate) => Math.floor((Date.parse(ate + 'T12:00:00') - Date.parse(de + 'T12:00:00')) / DIA);

  function semContato(l, hoje) { return ABERTAS.has(l.etapa) && (!l.ultimo || dias(l.ultimo, hoje) > 7); }
  function vencida(l, hoje) { return ABERTAS.has(l.etapa) && !!l.proxData && l.proxData < hoje; }

  function indicadores(leads, hoje) {
    const porEtapa = Object.fromEntries(ETAPAS.map(e => [e.k, 0])); leads.forEach(l => { if (porEtapa[l.etapa] != null) porEtapa[l.etapa]++; });
    const fechados = porEtapa.contratado + porEtapa.perdido;
    return {
      porEtapa, total: leads.length,
      conversao: fechados ? porEtapa.contratado / fechados : null,          // contratados ÷ leads encerrados
      valorProposta: leads.filter(l => l.etapa === 'proposta').reduce((s, l) => s + (+l.valor || 0), 0),
      valorContratado: leads.filter(l => l.etapa === 'contratado').reduce((s, l) => s + (+l.valor || 0), 0),
      semContato: leads.filter(l => semContato(l, hoje)).length,
      motivos: Object.entries(leads.filter(l => l.etapa === 'perdido').reduce((m, l) => { const k = l.motivoPerda || 'Sem motivo registrado'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]),
      vencidas: leads.filter(l => vencida(l, hoje)).length
    };
  }

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function filtrar(leads, f) {
    const q = norm(f.busca);
    return leads.filter(l => (!f.area || l.area === f.area) && (!f.origem || l.origem === f.origem) && (!f.resp || l.resp === f.resp) &&
      (!q || norm([l.nome, l.empresa, l.proxAcao].join(' ')).includes(q)));
  }

  // registra um contato no histórico e atualiza "último contato"
  function registrarContato(l, { data, canal, nota, por }) {
    if (!String(nota || '').trim()) throw new Error('Descreva o contato.');
    const d = data || hojeISO();
    l.hist = (l.hist || []).concat([{ data: d, canal: canal || 'Outro', nota: nota.trim(), por: por || '' }]).sort((a, b) => a.data.localeCompare(b.data));
    if (!l.ultimo || d > l.ultimo) l.ultimo = d; return l;
  }
  // ---------- travas da Controladoria (30/10/2026) ----------
  // G1 conflito (Comercial marca), G3 contrato + procuração + pasta, G4 liberação (Controladoria), CNJ só quando ajuizada
  function cnjValido(n) { const d = String(n || '').replace(/\D/g, ''); if (d.length !== 20) return false;
    const r = (BigInt(d.slice(0, 7) + d.slice(9, 20)) * 100n) % 97n; return String(98n - r).padStart(2, '0') === d.slice(7, 9); }
  const POS_REUNIAO = new Set(['reuniao', 'proposta', 'contratado']);
  function travas(l) { const t = l.travas || {};
    const g1 = (t.conflito || {}).status === 'ok', g3 = !!(t.contrato && t.procuracao && String(t.docsLink || '').trim()), g4 = !!(String((t.liberado || {}).por || '').trim() && (t.liberado || {}).data);
    const cnj = cnjValido(t.cnj);
    return { g1, g3, g4, cnj, impedido: (t.conflito || {}).status === 'impedido',
      prontoDrive: l.etapa === 'contratado' && g1 && g3 && g4 && !t.pastaDrive,
      prontoAstrea: l.etapa === 'contratado' && g1 && g3 && g4 && cnj && !t.astreaId };
  }
  function bloqueio(l, etapa) { const t = travas(l);
    if (POS_REUNIAO.has(etapa) && !t.g1) return t.impedido ? 'Conflito de interesses impedido (G1): o lead não pode avançar.' : 'Registre a consulta de conflito de interesses (G1) antes de avançar para “' + ETAPAS.find(e => e.k === etapa).n + '”.';
    return ''; }
  function mover(l, etapa, hoje) {
    if (!ETAPAS.some(e => e.k === etapa) || l.etapa === etapa || bloqueio(l, etapa)) return false;
    const de = (ETAPAS.find(e => e.k === l.etapa) || {}).n || l.etapa;
    l.etapa = etapa; l.hist = (l.hist || []).concat([{ data: hoje || hojeISO(), canal: 'Funil', nota: 'Movido de “' + de + '” para “' + ETAPAS.find(e => e.k === etapa).n + '”', por: '' }]);
    return true;
  }
  function validar(l) {
    const e = [];
    if (!String(l.nome || '').trim()) e.push('nome');
    if (!ETAPAS.some(x => x.k === l.etapa)) e.push('etapa');
    if (l.valor !== '' && l.valor != null && !(+l.valor >= 0)) e.push('valor estimado');
    if (!l.lgpd || !['sim', 'nao', 'pendente'].includes(l.lgpd.status)) e.push('consentimento LGPD');
    if (l.lgpd && l.lgpd.status === 'sim' && !l.lgpd.data) e.push('data do consentimento');
    if (l.etapa === 'perdido' && !String(l.motivoPerda || '').trim()) e.push('motivo de perda');
    return e;
  }

  // valor em reais digitado: "1.500" e "1.500,00" = 1500; "1500.5" = 1500,5; vazio = ''
  function lerValor(tx) { const t = String(tx == null ? '' : tx).replace(/[^\d,.-]/g, ''); if (t === '') return '';
    if (/,/.test(t)) return +t.replace(/\./g, '').replace(',', '.');
    if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return +t.replace(/\./g, '');
    return +t; }
  // ---------- CSV (separador ";", compatível com o Excel em português) ----------
  const COLS = [['id', 'id'], ['nome', 'Nome'], ['empresa', 'Empresa'], ['contato', 'Contato'], ['area', 'Área do Direito'], ['origem', 'Origem'],
    ['valor', 'Valor estimado (R$)'], ['resp', 'Responsável'], ['etapa', 'Etapa'], ['ultimo', 'Último contato'], ['proxAcao', 'Próxima ação'],
    ['proxData', 'Data da próxima ação'], ['motivoPerda', 'Motivo de perda'], ['lgpdStatus', 'Consentimento LGPD'], ['lgpdData', 'Data do consentimento'], ['lgpdForma', 'Forma do consentimento'],
    ['criado', 'Criado em'], ['hist', 'Histórico (JSON)'], ['travas', 'Travas (JSON)']];
  const cel = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;   /* evita fórmula ao abrir no Excel */ return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function paraCSV(leads) {
    const linhas = [COLS.map(c => c[1]).join(';')];
    leads.forEach(l => {
      const r = { ...l, valor: l.valor === '' || l.valor == null ? '' : String(+l.valor).replace('.', ','), etapa: (ETAPAS.find(e => e.k === l.etapa) || {}).n || l.etapa,
        lgpdStatus: ({ sim: 'Sim', nao: 'Não', pendente: 'Pendente' })[(l.lgpd || {}).status] || '', lgpdData: (l.lgpd || {}).data || '', lgpdForma: (l.lgpd || {}).forma || '',
        hist: JSON.stringify(l.hist || []), travas: l.travas ? JSON.stringify(l.travas) : '' };
      linhas.push(COLS.map(c => cel(r[c[0]])).join(';'));
    });
    return '﻿' + linhas.join('\r\n');
  }
  function lerCSV(txt) {
    if (!String(txt || '').replace(/^\uFEFF/, '').trim()) throw new Error('O arquivo está vazio.');
    const s = String(txt).replace(/^﻿/, ''), sep = (s.split(/\r?\n/)[0].match(/;/g) || []).length >= (s.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], c = '', q = false;
    for (let i = 0; i < s.length; i++) { const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(c); c = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(c); rows.push(row); row = []; c = ''; }
      else c += ch; }
    if (c !== '' || row.length) { row.push(c); rows.push(row); }
    const cab = (rows.shift() || []).map(h => norm(h).trim()), idx = {};
    COLS.forEach(([k, n]) => { const i = cab.indexOf(norm(n)); idx[k] = i >= 0 ? i : cab.indexOf(norm(k)); });
    if (idx.nome < 0) throw new Error('O arquivo não tem a coluna “Nome”. Use um CSV exportado por este CRM.');
    const etapaDe = v => { const n = norm(v); const e = ETAPAS.find(x => norm(x.n) === n || x.k === n); return e ? e.k : 'novo'; };
    const data = v => { const m = String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || '').trim(); };
    const erros = [], leads = [];
    rows.filter(r => r.some(x => String(x).trim())).forEach((r, n) => {
      const g = k => idx[k] >= 0 ? (r[idx[k]] || '').trim() : '';
      let travas; try { travas = g('travas') ? JSON.parse(g('travas')) : undefined; } catch (e) { erros.push('linha ' + (n + 2) + ': travas ilegíveis, importado sem elas'); }
      let hist = []; try { hist = g('hist') ? JSON.parse(g('hist')) : []; } catch (e) { erros.push('linha ' + (n + 2) + ': histórico ilegível, importado sem ele'); }
      const ls = norm(g('lgpdStatus'));
      const valor = lerValor(g('valor'));
      const l = { id: g('id') || 'l' + Date.now().toString(36) + n, nome: g('nome'), empresa: g('empresa'), contato: g('contato'), area: g('area'), origem: g('origem'),
        valor: Number.isFinite(valor) ? valor : '', resp: g('resp'), etapa: etapaDe(g('etapa')), motivoPerda: g('motivoPerda'), ultimo: data(g('ultimo')), proxAcao: g('proxAcao'), proxData: data(g('proxData')),
        lgpd: { status: ls === 'sim' ? 'sim' : ls === 'nao' ? 'nao' : 'pendente', data: data(g('lgpdData')), forma: g('lgpdForma') }, criado: data(g('criado')) || hojeISO(), hist: Array.isArray(hist) ? hist : [] };
      if (travas && typeof travas === 'object') l.travas = travas;
      if (!l.nome) { erros.push('linha ' + (n + 2) + ': sem nome, ignorada'); return; }
      if (l.etapa === 'perdido' && !l.motivoPerda) erros.push('“' + l.nome + '” está em Não avançou sem motivo de perda: informe ao editar');
      leads.push(l);
    });
    return { leads, erros };
  }
  // junta importação com a base: mesmo id substitui, id novo entra
  function mesclar(base, novos) { const m = new Map(base.map(l => [l.id, l])); novos.forEach(l => m.set(l.id, l)); return [...m.values()]; }

  // metas trimestrais do Comercial (nenhuma ligada a honorários). Datas vêm do histórico.
  function diasUteisEntre(a, b) { let n = 0; const d = new Date(a + 'T12:00:00'), f = new Date(b + 'T12:00:00'); while (d < f) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w && w < 6) n++; } return n; }
  function inicioTrimestre(hoje) { const [y, m] = hoje.split('-').map(Number); return y + '-' + String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0') + '-01'; }
  function metas(leads, hoje, desde) {
    desde = desde || inicioTrimestre(hoje);
    const doPeriodo = leads.filter(l => (l.criado || '') >= desde);
    const pct = (a, b) => b ? a / b : null;
    const contatos = doPeriodo.map(l => (l.hist || []).find(h => h.canal !== 'Funil')).filter(Boolean);
    const comRetorno = doPeriodo.filter(l => { const h = (l.hist || []).find(x => x.canal !== 'Funil'); return h && diasUteisEntre(l.criado, h.data) <= 1; }).length;
    const reun = doPeriodo.map(l => [l, (l.hist || []).find(h => h.canal === 'Funil' && /para “Primeira reunião”/.test(h.nota))]).filter(x => x[1]);
    const perd = doPeriodo.filter(l => l.etapa === 'perdido');
    return {
      desde, total: doPeriodo.length,
      retorno: { v: pct(comRetorno, doPeriodo.length), meta: 0.9, n: comRetorno, de: doPeriodo.length, semRegistro: doPeriodo.length - contatos.length },
      frios: { v: leads.filter(l => semContato(l, hoje)).length, meta: 0 },
      reuniao: { v: pct(reun.filter(([l, h]) => diasUteisEntre(l.criado, h.data) <= 3).length, reun.length), meta: 0.8, de: reun.length },
      motivo: { v: pct(perd.filter(l => String(l.motivoPerda || '').trim()).length, perd.length), meta: 1, de: perd.length }
    };
  }


  // Prazos por etapa (fluxograma de 30/10/2026): combinados pelo Dr. Rafael; vazio = a definir. Dias úteis.
  const PRAZOS_ETAPA = { novo: null, reuniao: null, proposta: null, negociacao: null, contratacao: null };
  function entradas(l) { const ent = { novo: l.criado };
    for (const h of l.hist || []) { if (h.canal !== 'Funil') continue; const m = /para “([^”]+)”/.exec(h.nota || ''); const e = m && ETAPAS.find(x => x.n === m[1]); if (e && !ent[e.k]) ent[e.k] = h.data; }
    return ent; }
  // visão por matéria (escritório virtual por matéria: RD Trib, RD Prev, RD Consul…)
  const SIGLAS = { 'Tributário': 'RD Trib', 'Execução fiscal': 'RD EF', 'Previdenciário': 'RD Prev', 'Consumidor': 'RD Consul', 'Trabalhista': 'RD Trab', 'Cível': 'RD Cível',
    'Administrativo e licitações': 'RD Adm', 'Empresarial e societário': 'RD Emp', 'Imobiliário': 'RD Imob', 'Outra': 'RD' };
  function porArea(leads) { const m = {}; (leads || []).forEach(l => { const a = l.area || 'Outra', r = m[a] = m[a] || { area: a, sigla: SIGLAS[a] || 'RD', abertos: 0, contratados: 0, perdidos: 0, valorAberto: 0, valorContratado: 0 };
      if (ABERTAS.has(l.etapa)) { r.abertos++; r.valorAberto += +l.valor || 0; } else if (l.etapa === 'contratado') { r.contratados++; r.valorContratado += +l.valor || 0; } else if (l.etapa === 'perdido') r.perdidos++; });
    return AREAS.filter(a => m[a]).map(a => Object.assign(m[a], { conversao: m[a].contratados + m[a].perdidos ? Math.round(100 * m[a].contratados / (m[a].contratados + m[a].perdidos)) : null })); }
  function tempos(leads, hoje, prazos) {
    hoje = hoje || hojeISO(); prazos = Object.assign({}, PRAZOS_ETAPA, prazos || {});
    const ORD = ['novo', 'reuniao', 'proposta', 'contratado', 'perdido'], acc = {}, add = (k, d, curso) => { const a = acc[k] = acc[k] || { soma: 0, n: 0, curso: 0, maior: 0 }; a.soma += d; a.n++; if (curso) a.curso++; a.maior = Math.max(a.maior, d); };
    for (const l of leads) { if (!l.criado) continue; const ent = entradas(l);
      ['novo', 'reuniao', 'proposta'].forEach((k, i) => { if (!ent[k]) return; const prox = ORD.slice(i + 1).map(x => ent[x]).filter(Boolean).sort()[0];
        if (prox) add(k, diasUteisEntre(ent[k], prox), false); else if (l.etapa === k) add(k, diasUteisEntre(ent[k], hoje), true); });
      if (ent.contratado) add('negociacao', diasUteisEntre(l.criado, ent.contratado), false); else if (ABERTAS.has(l.etapa)) add('negociacao', diasUteisEntre(l.criado, hoje), true);
      if (l.etapa === 'contratado' && ent.contratado) { const lib = ((l.travas || {}).liberado || {}).data; add('contratacao', diasUteisEntre(ent.contratado, lib || hoje), !lib); } }
    const NOMES = { novo: 'Novo contato', reuniao: 'Primeira reunião', proposta: 'Proposta enviada', negociacao: 'Negociação (entrada até contrato)', contratacao: 'Contratação (contrato até liberação G4)' };
    return Object.keys(NOMES).map(k => { const a = acc[k] || { soma: 0, n: 0, curso: 0, maior: 0 }, media = a.n ? Math.round(a.soma / a.n * 10) / 10 : null, prazo = prazos[k];
      return { k, nome: NOMES[k], media, n: a.n, emCurso: a.curso, maior: a.maior, prazo, ok: prazo == null || media == null ? null : media <= prazo }; });
  }
  const API = { porArea, SIGLAS, tempos, entradas, PRAZOS_ETAPA, cnjValido, travas, bloqueio, metas, diasUteisEntre, lerValor, ETAPAS, AREAS, ORIGENS, MOTIVOS, hojeISO, dias, semContato, vencida, indicadores, filtrar, registrarContato, mover, validar, paraCSV, lerCSV, mesclar, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CRM = API;
})(typeof window !== 'undefined' ? window : globalThis);
