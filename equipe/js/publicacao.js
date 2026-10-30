/* Classificador de publicações (DJEN/DJe) com prazo sugerido e tarefa (v1.0, 30/10/2026).
 * Regras objetivas, sem IA: identifica tipo, processo (CNJ), tribunal, prazo expresso no texto, dobro e audiência;
 * calcula o vencimento com PrazoProcessual (dias úteis, CPC arts. 219/224) e monta o bloco "Para lançar no Astrea".
 * Aponta; não decide: a Controladoria confere antes de lançar. Prazos sem número expresso recebem o prazo legal
 * mais comum para o tipo, marcado como "prazo legal presumido", e precisam de confirmação. */
(function (root) {
  'use strict';
  const pp = () => root.PrazoProcessual || (typeof require !== 'undefined' ? (() => { try { return require('./prazo_processual.js'); } catch (e) { return null; } })() : null);   // resolvido na hora do uso (a calculadora pode carregar depois)
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const CNJ = /\b(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})\b/g;
  const fmtCNJ = m => `${m[1]}-${m[2]}.${m[3]}.${m[4]}.${m[5]}.${m[6]}`;
  const EXT = { um: 1, uma: 1, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, quarenta_e_cinco: 45, sessenta: 60, noventa: 90 };
  // tipos em ordem de prioridade (o primeiro que casar vence); prazo = dias úteis presumidos quando o texto não traz número
  const TIPOS = [
    { k: 'penhora', nome: 'Penhora, bloqueio ou constrição', re: /\bpenhora\b|\bbloqueio\b|sisbajud|bacenjud|\barresto\b|indisponibilidade|constri[cç][aã]o|renajud/, prazo: 15, base: 'CPC, art. 525, § 11, ou art. 917, § 1º (15 dias úteis para impugnar a penhora)', urgente: true, rota: 'urgencia' },
    { k: 'citacao', nome: 'Citação', re: /\bcita[cç][aã]o\b|\bcitad[oa]s?\b/, prazo: 15, base: 'CPC, art. 335 (contestação em 15 dias úteis)', urgente: true, rota: 'urgencia',
      ef: { prazo: 5, base: 'Lei 6.830/1980, art. 8º (pagar ou garantir em 5 dias); embargos em 30 dias da garantia (art. 16). Conferir a contagem', contagem: 'conferir (LEF)' } },
    { k: 'sentenca', nome: 'Sentença', re: /\bsentenca\b|julgo (procedente|improcedente|parcialmente|extint)|resolvo o merito|extingo (o processo|a execucao)/, prazo: 15, base: 'CPC, art. 1.003, § 5º (apelação em 15 dias úteis); embargos de declaração em 5 (art. 1.023)', urgente: true, rota: 'urgencia' },
    { k: 'acordao', nome: 'Acórdão', re: /\bacordao\b|\bementa\b|turma recursal|camara (civel|de direito)|por unanimidade|negaram provimento|deram provimento/, prazo: 15, base: 'CPC, art. 1.003, § 5º (recurso em 15 dias úteis); embargos de declaração em 5 (art. 1.023)', urgente: false, rota: 'processo' },
    { k: 'audiencia', nome: 'Audiência', re: /\baudiencia\b/, prazo: null, base: 'comparecer na data designada; preparar o cliente e as testemunhas', urgente: false, rota: 'processo' },
    { k: 'pagamento', nome: 'Intimação para pagamento (cumprimento de sentença)', re: /cumprimento de sentenca|art\.? ?523|pag(ar|amento)[^.]{0,40}(15|quinze) dias/, prazo: 15, base: 'CPC, art. 523 (pagamento em 15 dias úteis, sob pena de multa de 10% e honorários de 10%); impugnação nos 15 dias seguintes (art. 525)', urgente: true, rota: 'urgencia' },
    { k: 'tutela', nome: 'Decisão interlocutória (tutela, liminar)', re: /\btutela\b|\bliminar\b|decisao interlocutoria|\bdefiro\b|\bindefiro\b|concedo|nego seguimento/, prazo: 15, base: 'CPC, arts. 1.015 e 1.003, § 5º (agravo de instrumento em 15 dias úteis)', urgente: false, rota: 'processo' },
    { k: 'contrarrazoes', nome: 'Intimação para contrarrazões', re: /contrarraz/, prazo: 15, base: 'CPC, art. 1.010, § 1º (15 dias úteis)', urgente: false, rota: 'processo' },
    { k: 'replica', nome: 'Intimação para réplica', re: /\breplica\b|impugna[cç][aã]o a contestacao|manifest[^.]{0,30}contestacao/, prazo: 15, base: 'CPC, art. 351 (15 dias úteis)', urgente: false, rota: 'processo' },
    { k: 'alegacoes', nome: 'Alegações finais', re: /alegacoes finais|memoriais/, prazo: 15, base: 'CPC, art. 364, § 2º (15 dias úteis)', urgente: false, rota: 'processo' },
    { k: 'provas', nome: 'Especificação de provas', re: /especifi(que|car|cacao de) provas|provas que pretende/, prazo: 5, base: 'prazo fixado pelo juízo; quando omisso, 5 dias úteis (CPC, art. 218, § 3º)', urgente: false, rota: 'processo' },
    { k: 'manifestacao', nome: 'Intimação para manifestação', re: /\bmanifest/, prazo: 5, base: 'prazo fixado pelo juízo; quando omisso, 5 dias úteis (CPC, art. 218, § 3º)', urgente: false, rota: 'processo' },
    { k: 'despacho', nome: 'Despacho de expediente (ciência)', re: /\bdespacho\b|intime-se|\bvista\b|\bciencia\b|conclusos|aguarde-se|cumpra-se/, prazo: null, base: 'sem prazo para a parte; apenas ciência', urgente: false, rota: 'processo' }
  ];
  function tribunalDe(cnj) { if (!cnj) return { k: '', nome: '' }; const [, , , j, tr] = cnj.split(/[-.]/);
    if (j === '4') return { k: 'jf', nome: 'Justiça Federal' + (tr === '05' ? ' (TRF5)' : ' (TRF' + +tr + ')') };
    if (j === '8') return { k: tr === '06' ? 'tjce' : '', nome: tr === '06' ? 'TJCE' : 'Justiça Estadual (TJ' + tr + ')' };
    if (j === '5') return { k: '', nome: 'Justiça do Trabalho (prazos pela CLT, art. 775: conferir)' };
    if (j === '3') return { k: '', nome: 'STJ' }; if (j === '1') return { k: '', nome: 'STF' };
    return { k: '', nome: 'outro' }; }
  function prazoExpresso(t) {
    const n = norm(t).replace(/\s+/g, ' ');
    let m = /prazo (?:comum |sucessivo |improrrogavel |legal )?de (\d{1,3}) ?(?:\([a-z\s]+\) ?)?(dias?|horas?)( uteis| corridos)?/.exec(n)
      || /(?:em|no prazo de) (\d{1,3}) ?(?:\([a-z\s]+\) ?)?(dias?|horas?)( uteis| corridos)?/.exec(n)
      || /(\d{1,3}) ?\((?:[a-z\s]+)\) (dias?)( uteis| corridos)?/.exec(n);
    if (!m) { const x = /prazo (?:comum |sucessivo )?de ([a-z_]+) (dias?)( uteis| corridos)?/.exec(n.replace(/quarenta e cinco/g, 'quarenta_e_cinco')); if (x && EXT[x[1]]) m = [x[0], String(EXT[x[1]]), x[2], x[3]]; }
    if (!m) return null;
    return { dias: +m[1], unidade: /hora/.test(m[2]) ? 'horas' : 'dias', contagem: /corrid/.test(m[3] || '') ? 'corridos' : 'úteis', dobro: /\bem dobro\b|prazo em dobro/.test(n) };
  }
  function dataBR(s) { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; }
  function audienciaDe(t) { const n = norm(t); const m = /audiencia[^.]{0,120}?(\d{1,2}\/\d{1,2}\/\d{4})(?:[^.]{0,25}?(\d{1,2})[:h](\d{2}))?/.exec(n); return m ? { data: dataBR(m[1]), hora: m[2] ? `${m[2].padStart(2, '0')}:${m[3]}` : '' } : null; }
  function somaCorridos(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  const br = iso => iso ? iso.split('-').reverse().join('/') : '';
  /* classificar(texto, { disponibilizacao: 'AAAA-MM-DD', hoje: 'AAAA-MM-DD' }) */
  function classificar(texto, o) {
    o = o || {}; const t = String(texto || '').trim(), n = norm(t);
    const cnjs = [...new Set([...t.matchAll(CNJ)].map(fmtCNJ))], cnj = cnjs[0] || '';
    const trib = tribunalDe(cnj), disp = o.disponibilizacao || dataBR((/disponibiliza[cç][aã]o:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(t) || [])[1]) || '';
    let tipo = TIPOS.find(x => x.re.test(n)) || { k: 'outro', nome: 'Comunicação', prazo: null, base: 'prazo a definir pela Controladoria', urgente: false, rota: 'processo' };
    const ef = /execucao fiscal|divida ativa|certidao de divida ativa/.test(n);
    if (tipo.k === 'citacao' && ef && tipo.ef) tipo = Object.assign({}, tipo, tipo.ef);
    const exp = prazoExpresso(t), aud = tipo.k === 'audiencia' ? audienciaDe(t) : null;
    let prazoDias = exp && exp.unidade === 'dias' ? exp.dias : tipo.prazo, contagem = exp ? exp.contagem : (tipo.contagem || 'úteis'), dobro = !!(exp && exp.dobro);
    const origemPrazo = exp && exp.unidade === 'dias' ? 'expresso no texto' : prazoDias ? 'prazo legal presumido: confirmar' : 'sem prazo';
    let venc = '', memoria = '', erro = '';
    if (prazoDias && disp) {
      if (contagem === 'corridos') { venc = somaCorridos(disp, prazoDias * (dobro ? 2 : 1)); memoria = `${prazoDias} dias corridos${dobro ? ' em dobro' : ''} a partir da disponibilização em ${br(disp)} (confira se a contagem é mesmo em dias corridos).`; }
      else if (pp()) { try { const r = pp().calcular({ disponibilizacao: disp, dias: prazoDias, dobro, tribunal: trib.k }); venc = r.vencimento; memoria = r.memoria; } catch (e) { erro = e.message; } }
      else erro = 'calculadora de prazos indisponível';
    }
    const hoje = o.hoje || new Date().toLocaleDateString('sv-SE');
    const diasAte = iso => iso ? Math.round((Date.parse(iso + 'T12:00:00') - Date.parse(hoje + 'T12:00:00')) / 864e5) : null;
    const urgente = !!tipo.urgente || (venc && diasAte(venc) <= 7) || (aud && aud.data && diasAte(aud.data) <= 7);
    const resumo = t.replace(/\s+/g, ' ').slice(0, 240) + (t.length > 240 ? '…' : '');
    const titulo = `${tipo.nome} – ${cnj || '[processo não identificado]'}`;
    const astrea = [`Título: ${titulo}`, aud && aud.data ? `Audiência: ${br(aud.data)}${aud.hora ? ' às ' + aud.hora : ''}` : '',
      venc ? `Data fatal (estimativa a conferir): ${br(venc)}` : prazoDias ? 'Data fatal: a calcular (informe a data de disponibilização)' : 'Data fatal: a definir pela Controladoria',
      `Observação: ${memoria || tipo.base}${exp ? '' : prazoDias ? ' · prazo presumido pelo tipo da publicação, confirmar no texto' : ''}`,
      `Fonte: publicação${disp ? ' disponibilizada em ' + br(disp) : ''}${trib.nome ? ' · ' + trib.nome : ''}`].filter(Boolean).join('\n');
    return { cnj, cnjs, tribunal: trib.k, tribunalNome: trib.nome, tipo: tipo.k, tipoNome: tipo.nome, urgente, rota: urgente ? 'urgencia' : tipo.rota,
      prazoDias, contagem, dobro, origemPrazo, base: tipo.base, disponibilizacao: disp, vencimento: venc, diasAteVencimento: diasAte(venc), memoria, erro,
      audiencia: aud, execucaoFiscal: ef, resumo, titulo, astrea, texto: t };
  }
  /* lote(texto, o): várias publicações coladas de uma vez; separa pelo início de cada número de processo */
  function lote(texto, o) {
    const t = String(texto || ''); const pos = [...t.matchAll(CNJ)].map(m => m.index);
    if (pos.length <= 1) return t.trim() ? [classificar(t, o)] : [];
    const cortes = [0]; for (let i = 1; i < pos.length; i++) { const ini = t.lastIndexOf('\n', pos[i]) + 1; if (ini > cortes[cortes.length - 1] + 20) cortes.push(ini); }
    const blocos = cortes.map((c, i) => t.slice(c, cortes[i + 1] === undefined ? t.length : cortes[i + 1]).trim()).filter(Boolean);
    return blocos.map(b => classificar(b, o));
  }
  /* acompanhados(publicacoes, fichas, hoje, limiteDias): processos com a última publicação, próximo vencimento e sinal de "parado" */
  function acompanhados(pubs, fichas, hoje, limite) {
    limite = limite || 60; const M = new Map();
    const get = cnj => { if (!M.has(cnj)) M.set(cnj, { cnj, cliente: '', ultima: '', proximo: '', pendentes: 0, publicacoes: 0, tipoUltimo: '' }); return M.get(cnj); };
    for (const f of fichas || []) { const cnj = f && f.cnj; if (!cnj) continue; const x = get(cnj); x.cliente = x.cliente || f.cliente || ''; if (f.desde && (!x.ultima || f.desde > x.ultima)) { x.ultima = f.desde; x.tipoUltimo = x.tipoUltimo || 'protocolo'; } }
    for (const p of pubs || []) { if (!p.cnj) continue; const x = get(p.cnj); x.publicacoes++; x.cliente = x.cliente || p.cliente || '';
      if (p.disp && p.disp > x.ultima) { x.ultima = p.disp; x.tipoUltimo = p.tipoNome || p.tipo || ''; }
      if (p.venc && p.venc >= hoje && (!x.proximo || p.venc < x.proximo)) x.proximo = p.venc;
      if (p.status !== 'lancada') x.pendentes++; }
    const dias = iso => iso ? Math.round((Date.parse(hoje + 'T12:00:00') - Date.parse(iso + 'T12:00:00')) / 864e5) : null;
    return [...M.values()].map(x => Object.assign(x, { diasSem: dias(x.ultima), parado: x.ultima ? dias(x.ultima) > limite : true }))
      .sort((a, b) => (b.parado - a.parado) || ((a.proximo || '9') < (b.proximo || '9') ? -1 : 1));
  }
  const API = { TIPOS: TIPOS.map(t => ({ k: t.k, nome: t.nome })), classificar, lote, acompanhados, prazoExpresso, tribunalDe, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Publicacao = API;
})(typeof window !== 'undefined' ? window : globalThis);
