/* Tarefas do escritório: checklists por matéria, "minhas tarefas" e prazos internos em dias úteis (v1.1, 30/10/2026).
 * Usado pela página do Atendimento RD e pela rotina Ponte RD (que cria o checklist quando o contrato é liberado).
 * Prazo interno = dias úteis a partir do início (fins de semana e feriados nacionais; não é prazo processual). */
(function (root) {
  'use strict';
  const EQUIPE = [
    { nome: 'Rafael', setor: 'Direção' }, { nome: 'Ana Maria', setor: 'Comercial' }, { nome: 'David', setor: 'Coordenação Jurídica' },
    { nome: 'Mariana', setor: 'Controladoria' }, { nome: 'Lillian', setor: 'Coordenação Administrativa' }, { nome: 'Victor', setor: 'Financeiro' }];
  // checklists: [título, responsável, dias úteis a partir do início]
  const CHECKLISTS = {
    'recuperacao': { nome: 'Recuperação tributária', areas: ['Tributário'], itens: [
      ['Receber os documentos fiscais do cliente (XML, SPED, folha) ou pedir à Fortes', 'David', 5],
      ['Importar no PlanejaTrib e rodar a auditoria', 'Rafael', 7],
      ['Parecer preliminar aprovado pela Direção', 'Rafael', 10],
      ['Conferência item a item com os XML (valor exato)', 'David', 20],
      ['Pedido protocolado (PER/DCOMP ou ação) com aprovação da Direção', 'Rafael', 30],
      ['Se judicial: lançar o processo e os prazos no Astrea', 'Mariana', 31],
      ['Cadastrar honorários fixos e de êxito do contrato', 'Victor', 5]] },
    'execucao': { nome: 'Execução fiscal', areas: ['Execução fiscal'], itens: [
      ['Obter cópia integral dos autos e da CDA', 'Mariana', 2],
      ['Analisar a CDA, a prescrição e os vícios (Núcleo CDA)', 'David', 5],
      ['Definir a estratégia (exceção, embargos, transação) com a Direção', 'Rafael', 7],
      ['Peça protocolada no prazo processual (conferir na calculadora)', 'Rafael', 10],
      ['Lançar o processo e os prazos no Astrea', 'Mariana', 11],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    // checklists por matéria (escritório virtual por matéria, 30/10/2026)
    'previdenciario': { nome: 'Previdenciário (RD Prev)', areas: ['Previdenciário'], itens: [
      ['Conferir procuração, contrato e LGPD; pedir CNIS, carta ou comunicado do INSS e documentos', 'Lillian', 2],
      ['Analisar CNIS, DER e decisão do INSS; levantar vínculos e períodos faltantes', 'David', 7],
      ['Definir a via (recurso ao CRPS, novo requerimento ou ação no JEF) com a Direção', 'Rafael', 9],
      ['Cálculo ou simulação do benefício e das parcelas atrasadas', 'David', 12],
      ['Peça protocolada (recurso, requerimento ou inicial) com aprovação da Direção', 'Rafael', 15],
      ['Lançar o processo e os prazos no Astrea', 'Mariana', 16],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    'consumidor': { nome: 'Consumidor (RD Consul)', areas: ['Consumidor'], itens: [
      ['Conferir procuração, contrato e LGPD; pedir contrato, comprovantes, protocolos e prints', 'Lillian', 2],
      ['Reclamação prévia (consumidor.gov.br ou Procon) ou notificação, quando couber', 'David', 5],
      ['Análise do caso: dano, prazos (CDC, arts. 26 e 27) e valor da causa', 'David', 7],
      ['Minuta da inicial (JEC ou vara) aprovada pela Direção', 'Rafael', 10],
      ['Protocolo, lançamento no Astrea e audiência de conciliação agendada', 'Mariana', 12],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    'trabalhista': { nome: 'Trabalhista (RD Trab)', areas: ['Trabalhista'], itens: [
      ['Conferir procuração e contrato; pedir notificação/inicial, contrato de trabalho, ponto, holerites e TRCT', 'Lillian', 2],
      ['Conferir a data da audiência e os prazos (CLT, art. 775) e lançar no Astrea', 'Mariana', 2],
      ['Análise dos pedidos e das provas; estratégia (defesa ou acordo) com a Direção', 'David', 6],
      ['Contestação e documentos prontos e aprovados pela Direção antes da audiência', 'Rafael', 9],
      ['Preparar preposto e testemunhas para a audiência', 'David', 10],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    'civel': { nome: 'Cível (RD Cível)', areas: ['Cível'], itens: [
      ['Conferir procuração, contrato e documentos recebidos (título, contrato, provas)', 'Lillian', 2],
      ['Análise de prazos (prescrição) e estratégia com a Direção', 'David', 5],
      ['Minuta da peça aprovada pela Direção', 'Rafael', 10],
      ['Protocolo e lançamento no Astrea', 'Mariana', 12],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    'administrativo': { nome: 'Administrativo e licitações (RD Adm)', areas: ['Administrativo e licitações'], itens: [
      ['Conferir procuração e contrato; pedir edital, contrato, empenhos, notas e protocolos', 'Lillian', 2],
      ['Conferir prazos administrativos correndo (recurso, defesa, MS em 120 dias) e lançar no Astrea', 'Mariana', 2],
      ['Análise do ato ou da omissão e da via (requerimento, recurso, MS, ação) com a Direção', 'David', 5],
      ['Peça aprovada e protocolada pela Direção', 'Rafael', 8],
      ['Lançar o processo e os prazos no Astrea', 'Mariana', 9],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    'empresarial': { nome: 'Empresarial e societário (RD Emp)', areas: ['Empresarial e societário'], itens: [
      ['Conferir procuração e contrato; pedir contrato social, acordo de sócios, balanços e certidões', 'Lillian', 3],
      ['Diagnóstico societário e tributário (PlanejaTrib, quando houver planejamento) com a Direção', 'Rafael', 10],
      ['Minutas (alteração contratual, acordo de sócios, holding) aprovadas pela Direção', 'David', 15],
      ['Assinaturas e registro na Junta Comercial em até 30 dias da assinatura (Lei 8.934, art. 36)', 'Lillian', 25],
      ['Atualizações cadastrais (Receita, Sefaz, prefeitura) conferidas', 'Mariana', 30],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    'imobiliario': { nome: 'Imobiliário (RD Imob)', areas: ['Imobiliário'], itens: [
      ['Conferir procuração e contrato; pedir matrícula atualizada, certidões e contratos', 'Lillian', 3],
      ['Análise da matrícula, dos ônus e da via (usucapião, adjudicação, locação, regularização) com a Direção', 'David', 7],
      ['Minuta (petição, escritura, contrato ou requerimento ao cartório/prefeitura) aprovada pela Direção', 'Rafael', 12],
      ['Protocolo (judicial, cartório ou prefeitura) e lançamento no Astrea', 'Mariana', 14],
      ['Cadastrar honorários do contrato', 'Victor', 5]] },
    'contencioso': { nome: 'Contencioso e consultivo', areas: ['Outra'], itens: [
      ['Conferir procuração, contrato e documentos recebidos', 'Lillian', 2],
      ['Preparar a minuta ou o parecer', 'David', 10],
      ['Revisão e aprovação da Direção', 'Rafael', 12],
      ['Protocolo e lançamento no Astrea (se houver processo)', 'Mariana', 15],
      ['Cadastrar honorários do contrato', 'Victor', 5]] }
  };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dia = s => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d, 12); };
  function feriadosNacionais(ano) {   // os mesmos da calculadora de prazos; sem os forenses, por ser prazo interno
    const f = [[1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25]].map(([m, d]) => iso(new Date(ano, m - 1, d, 12)));
    const PP = root.PrazoProcessual; if (PP && PP.feriados) return PP.feriados(ano, [], '');
    return new Set(f);
  }
  function somaUteis(inicio, n) { let d = dia(inicio), c = 0; while (c < n) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12); const w = d.getDay(); if (w === 0 || w === 6 || feriadosNacionais(d.getFullYear()).has(iso(d))) continue; c++; } return iso(d); }
  function tipoDaArea(area) { const a = String(area || ''); for (const [k, c] of Object.entries(CHECKLISTS)) if (c.areas.includes(a)) return k; return 'contencioso'; }
  const setorDe = nome => (EQUIPE.find(e => e.nome === nome) || {}).setor || '';
  /* gerar({ tipo | area, leadId, cliente, inicio: 'AAAA-MM-DD', agora: ISO }) → tarefas prontas para gravar */
  function gerar(o) {
    o = o || {}; const k = o.tipo && CHECKLISTS[o.tipo] ? o.tipo : tipoDaArea(o.area), c = CHECKLISTS[k], inicio = o.inicio || iso(new Date()), agora = o.agora || new Date().toISOString();
    return c.itens.map(([titulo, resp, dias], i) => ({ id: 't' + (o.leadId || 'x') + '-' + k + '-' + (i + 1), leadId: o.leadId || '', cliente: o.cliente || '', area: o.area || c.nome, checklist: k,
      ordem: i + 1, titulo, resp, setor: setorDe(resp), prazo: somaUteis(inicio, dias), status: 'pendente', feitaEm: '', feitaPor: '', origem: 'checklist', criadoEm: agora }));
  }
  /* minhas(tarefas, { resp, hoje, status }) → ordenadas: vencidas, hoje, depois; concluídas por último */
  function minhas(tarefas, o) {
    o = o || {}; const hoje = o.hoje || iso(new Date());
    const L = (tarefas || []).filter(t => (!o.resp || t.resp === o.resp) && (!o.status || t.status === o.status) && (!o.leadId || t.leadId === o.leadId));
    const sit = t => t.status === 'feita' ? 'feita' : !t.prazo ? 'sem prazo' : t.prazo < hoje ? 'vencida' : t.prazo === hoje ? 'hoje' : 'a vencer';
    const peso = { vencida: 0, hoje: 1, 'a vencer': 2, 'sem prazo': 3, feita: 4 };
    return L.map(t => Object.assign({}, t, { situacao: sit(t) })).sort((a, b) => peso[a.situacao] - peso[b.situacao] || ((a.prazo || '9') < (b.prazo || '9') ? -1 : 1) || (a.ordem || 0) - (b.ordem || 0));
  }
  function resumo(tarefas, hoje) { const m = minhas(tarefas, { hoje }); const por = {};
    for (const t of m) { const r = por[t.resp] = por[t.resp] || { resp: t.resp, pendentes: 0, vencidas: 0, hoje: 0 }; if (t.status === 'feita') continue; r.pendentes++; if (t.situacao === 'vencida') r.vencidas++; if (t.situacao === 'hoje') r.hoje++; }
    return Object.values(por).sort((a, b) => b.vencidas - a.vencidas || b.pendentes - a.pendentes); }
  const API = { EQUIPE, CHECKLISTS, tipoDaArea, gerar, minhas, resumo, somaUteis, versao: '1.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Tarefas = API;
})(typeof window !== 'undefined' ? window : globalThis);
