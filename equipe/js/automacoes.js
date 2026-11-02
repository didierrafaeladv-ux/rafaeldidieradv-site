/* Motor de regras de automação do Atendimento RD (v1.0, 02/11/2026).
 * Regra = "quando <alvo> atender a <condições>, faça <ações>". Alvos: caso (ficha do atendimento) ou publicação.
 * As ações só agem dentro do sistema (tarefa, histórico, status): nada é enviado a cliente.
 * Cada regra dispara no máximo uma vez por caso/publicação (chave regra|alvo); as tarefas têm id fixo, então
 * duas telas abertas ao mesmo tempo não duplicam a tarefa. Navegador (window.Automacoes) e node. */
(function (root) {
  'use strict';
  const sem = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const diasEntre = (a, b) => Math.round((new Date(String(b).slice(0, 10) + 'T12:00:00Z') - new Date(String(a).slice(0, 10) + 'T12:00:00Z')) / 864e5);
  const SETORES = { urgencia: 'Urgência (Direção)', processo: 'Processo / intimação (Controladoria)', nova: 'Nova demanda (Comercial)', docs: 'Documentos (Coordenação Jurídica)', fin: 'Financeiro', agenda: 'Agendamento (Administrativo)' };
  const STATUS = ['Nova', 'Em andamento', 'Aguardando cliente', 'Aguardando checagem de conflito', 'Concluída'];
  const MATERIAS = ['Tributário', 'Execução fiscal', 'Previdenciário', 'Consumidor', 'Trabalhista', 'Cível', 'Administrativo e licitações', 'Empresarial e societário', 'Imobiliário', 'Outra'];
  const SN = ['sim', 'não'], sn = v => v ? 'sim' : 'não';
  // campos de condição por alvo: tipo 'lista' (=, ≠), 'texto' (contém), 'dias' (≥, ≤), 'sn' (=)
  const CAMPOS = {
    caso: [
      { id: 'materia', nome: 'Matéria', tipo: 'lista', opcoes: MATERIAS, ler: x => x.f.area || '' },
      { id: 'setor', nome: 'Setor', tipo: 'lista', opcoes: Object.keys(SETORES), rotulos: SETORES, ler: x => x.f.rota || '' },
      { id: 'status', nome: 'Situação', tipo: 'lista', opcoes: STATUS, ler: x => x.f.status || '' },
      { id: 'canal', nome: 'Canal de entrada', tipo: 'texto', ler: x => x.c.canal || '' },
      { id: 'processo', nome: 'Tem número de processo', tipo: 'sn', ler: x => sn((x.f.astrea && x.f.astrea.cnj) || x.f.processo) },
      { id: 'escopo', nome: 'Escopo definido', tipo: 'sn', ler: x => sn(x.f.escopo && x.f.escopo.dentro) },
      { id: 'licoes', nome: 'Lições registradas', tipo: 'sn', ler: x => sn(x.f.licoes) },
      { id: 'dias_aberto', nome: 'Dias desde a abertura', tipo: 'dias', ler: (x, hoje) => x.f.em ? diasEntre(x.f.em, hoje) : null }],
    publicacao: [
      { id: 'tipo', nome: 'Tipo do ato', tipo: 'texto', ler: p => p.tipoNome || '' },
      { id: 'urgente', nome: 'Urgente', tipo: 'sn', ler: p => sn(p.urgente) },
      { id: 'dias_vencer', nome: 'Dias para vencer', tipo: 'dias', ler: (p, hoje) => p.venc ? diasEntre(hoje, p.venc) : null },
      { id: 'lancada', nome: 'Lançada no Astrea', tipo: 'sn', ler: p => sn(p.status === 'lancada') },
      { id: 'conferida', nome: 'Conferida por outra pessoa', tipo: 'sn', ler: p => sn(p.conferidaPor) },
      { id: 'tem_caso', nome: 'Ligada a um caso', tipo: 'sn', ler: p => sn(p.fichaId) }] };
  const OPS = { lista: [['eq', 'é'], ['ne', 'não é']], texto: [['contem', 'contém'], ['nao_contem', 'não contém']], dias: [['gte', 'é maior ou igual a'], ['lte', 'é menor ou igual a']], sn: [['eq', 'é']] };
  const ACOES = [['tarefa', 'Criar tarefa'], ['historico', 'Anotar no histórico do caso'], ['status', 'Mudar a situação do caso']];
  const campo = (alvo, id) => (CAMPOS[alvo] || []).find(c => c.id === id);
  function testa(cond, alvo, obj, hoje) { const c = campo(alvo, cond.campo); if (!c) return false; const v = c.ler(obj, hoje), w = cond.valor;
    switch (cond.op) {
      case 'eq': return sem(v) === sem(w);
      case 'ne': return sem(v) !== sem(w);
      case 'contem': return sem(v).includes(sem(w));
      case 'nao_contem': return !sem(v).includes(sem(w));
      case 'gte': return v != null && v >= +w;
      case 'lte': return v != null && v <= +w;
      default: return false; } }
  const atende = (r, obj, hoje) => (r.condicoes || []).length > 0 && r.condicoes.every(c => testa(c, r.alvo, obj, hoje));
  const idDe = (r, obj) => r.alvo === 'caso' ? obj.c.id : obj.id;
  const chave = (r, obj) => r.id + '|' + idDe(r, obj);
  const idTarefa = (r, obj) => ('au-' + r.id + '-' + idDe(r, obj)).replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 120);
  // texto com {cliente} {protocolo} {processo} {materia} {tipo} {vencimento}
  function preencher(t, r, obj) { const br = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
    const v = r.alvo === 'caso' ? { cliente: obj.c.nome || '', protocolo: obj.f.proto || '', processo: (obj.f.astrea && obj.f.astrea.cnj) || obj.f.processo || '', materia: obj.f.area || '', tipo: '', vencimento: '' }
      : { cliente: obj.cliente || '', protocolo: '', processo: obj.cnj || '', materia: '', tipo: obj.tipoNome || '', vencimento: br(obj.venc) };
    return String(t || '').replace(/\{(\w+)\}/g, (m, k) => v[k] != null ? v[k] : m).replace(/\s+·\s*(?=·|$)/g, '').replace(/\(\s*\)/g, '').trim(); }
  /* planejar(regras, {casos:[{c,f}], publicacoes:[p]}, hoje, ja:Set de chaves já disparadas) → [{regra, chave, alvoId, alvo, acoes:[{tipo,...}]}]
   * Só regras ativas; respeita "desde" (regra.desde: só alvos criados a partir dessa data, salvo regra.existentes). */
  function planejar(regras, dados, hoje, ja) { const out = [], vis = ja || new Set();
    (regras || []).filter(r => r && r.ativa && (r.acoes || []).length).forEach(r => {
      const L = r.alvo === 'caso' ? (dados.casos || []) : (dados.publicacoes || []);
      L.forEach(obj => { const k = chave(r, obj); if (vis.has(k)) return;
        const criado = r.alvo === 'caso' ? obj.f.em : (obj.registradaEm || obj.disp);
        if (!r.existentes && r.desde && criado && String(criado) < String(r.desde)) return;
        if (!atende(r, obj, hoje)) return;
        out.push({ regra: r, chave: k, alvoId: idDe(r, obj), alvo: obj, acoes: r.acoes.map(a => Object.assign({}, a, a.tipo === 'tarefa' ? { id: idTarefa(r, obj), titulo: preencher(a.titulo, r, obj) } : a.tipo === 'historico' ? { texto: preencher(a.texto, r, obj) } : {})) }); }); });
    return out; }
  function descrever(r) { const alvo = r.alvo === 'caso' ? 'um caso' : 'uma publicação';
    const conds = (r.condicoes || []).map(c => { const k = campo(r.alvo, c.campo); if (!k) return '?'; const op = (OPS[k.tipo].find(o => o[0] === c.op) || [, c.op])[1];
      const val = k.rotulos && k.rotulos[c.valor] ? k.rotulos[c.valor] : c.valor; return k.nome.toLowerCase() + ' ' + op + ' ' + (k.tipo === 'dias' ? val + ' dia(s)' : '“' + val + '”'); });
    const acs = (r.acoes || []).map(a => a.tipo === 'tarefa' ? 'criar a tarefa “' + a.titulo + '” para ' + (a.resp === 'setor' ? 'o responsável do setor' : a.resp) + (a.prazoUteis != null ? ' (prazo: ' + (+a.prazoUteis ? a.prazoUteis + ' dia(s) útil(eis)' : 'hoje') + ')' : '')
      : a.tipo === 'historico' ? 'anotar no histórico “' + a.texto + '”' : 'mudar a situação para “' + a.valor + '”');
    return 'Quando ' + alvo + ' tiver ' + conds.join(' e ') + ', ' + acs.join(' e ') + '.'; }
  // modelos prontos (entram desligados; a Direção revisa e liga)
  const MODELOS = [
    { id: 'prev-docs', nome: 'Previdenciário: pedir CNIS e documentos do INSS', alvo: 'caso', condicoes: [{ campo: 'materia', op: 'eq', valor: 'Previdenciário' }, { campo: 'status', op: 'ne', valor: 'Concluída' }],
      acoes: [{ tipo: 'tarefa', titulo: 'Pedir CNIS, carta de decisão do INSS e documentos — {cliente} ({protocolo})', resp: 'setor', prazoUteis: 2 }] },
    { id: 'pub-urgente', nome: 'Publicação urgente avisa a Direção', alvo: 'publicacao', condicoes: [{ campo: 'urgente', op: 'eq', valor: 'sim' }],
      acoes: [{ tipo: 'tarefa', titulo: 'Publicação urgente: {tipo} · {processo} · vence {vencimento}', resp: 'Rafael', prazoUteis: 0 }] },
    { id: 'prazo-sem-conf', nome: 'Prazo perto sem conferência', alvo: 'publicacao', condicoes: [{ campo: 'dias_vencer', op: 'lte', valor: '2' }, { campo: 'conferida', op: 'eq', valor: 'não' }],
      acoes: [{ tipo: 'tarefa', titulo: 'Conferir prazo de {processo} ({tipo}), vence {vencimento}', resp: 'David', prazoUteis: 0 }] },
    { id: 'cliente-parado', nome: 'Caso parado aguardando o cliente', alvo: 'caso', condicoes: [{ campo: 'status', op: 'eq', valor: 'Aguardando cliente' }, { campo: 'dias_aberto', op: 'gte', valor: '7' }],
      acoes: [{ tipo: 'tarefa', titulo: 'Cobrar retorno do cliente — {cliente} ({protocolo})', resp: 'setor', prazoUteis: 1 }] },
    { id: 'urgencia-processo', nome: 'Urgência sem número de processo', alvo: 'caso', condicoes: [{ campo: 'setor', op: 'eq', valor: 'urgencia' }, { campo: 'processo', op: 'eq', valor: 'não' }],
      acoes: [{ tipo: 'historico', texto: 'Automação: urgência sem número de processo; pedir ao cliente a cópia da citação ou do mandado' }, { tipo: 'tarefa', titulo: 'Obter número do processo da urgência — {cliente} ({protocolo})', resp: 'Mariana', prazoUteis: 0 }] }];
  function validar(r) { const e = [];
    if (!r || !String(r.nome || '').trim()) e.push('Dê um nome à regra.');
    if (!r || !CAMPOS[r.alvo]) e.push('Escolha se a regra vale para casos ou para publicações.');
    if (!r || !(r.condicoes || []).length) e.push('Inclua pelo menos uma condição.');
    (r && r.condicoes || []).forEach((c, i) => { const k = campo(r.alvo, c.campo); if (!k) e.push('Condição ' + (i + 1) + ': campo inválido.'); else if (k.tipo === 'dias' && !(String(c.valor).trim() !== '' && isFinite(+c.valor))) e.push('Condição ' + (i + 1) + ': informe o número de dias.'); else if (String(c.valor).trim() === '') e.push('Condição ' + (i + 1) + ': informe o valor.'); });
    if (!r || !(r.acoes || []).length) e.push('Inclua pelo menos uma ação.');
    (r && r.acoes || []).forEach((a, i) => { if (a.tipo === 'tarefa' && !String(a.titulo || '').trim()) e.push('Ação ' + (i + 1) + ': escreva o título da tarefa.');
      if (a.tipo === 'tarefa' && !a.resp) e.push('Ação ' + (i + 1) + ': escolha o responsável.');
      if (a.tipo === 'historico' && !String(a.texto || '').trim()) e.push('Ação ' + (i + 1) + ': escreva o texto do histórico.');
      if (a.tipo === 'status' && r.alvo !== 'caso') e.push('Ação ' + (i + 1) + ': mudar situação só vale para casos.');
      if (a.tipo === 'status' && !STATUS.includes(a.valor)) e.push('Ação ' + (i + 1) + ': escolha a nova situação.'); });
    return e; }
  const API = { CAMPOS, OPS, ACOES, SETORES, STATUS, MATERIAS, MODELOS, testa, atende, planejar, descrever, preencher, validar, chave, idTarefa, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Automacoes = API;
})(typeof window !== 'undefined' ? window : globalThis);
