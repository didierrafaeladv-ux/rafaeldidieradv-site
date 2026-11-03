// Roteador por complexidade v2.0 (Rafael Didier Advocacia, 03/11/2026). Mesma regra de roteador.py; fonte única: regras.json.
const R = {"versao": "2.0", "limites": {"caracteresPadrao": 1500, "caracteresCritico": 12000}, "simples": ["resuma", "resumir", "resumo", "traduza", "traduzir", "agendar", "agende", "reuniao", "horario", "liste", "listar", "corrija a ortografia", "revise a gramatica", "bom dia", "boa tarde", "boa noite", "obrigado", "qual o prazo de recolhimento", "qual o vencimento"], "padrao": ["analise", "analisar", "calcule", "calcular", "compare", "comparar", "simule", "simulacao", "script", "python", "sql", "codigo", "code", "planilha", "sped", "efd", "auditoria", "split payment", "ibs", "cbs", "reforma tributaria", "irrf", "inss", "icms", "iss", "pis", "cofins", "simples nacional", "lucro presumido", "lucro real", "retencao", "credito"], "critico": ["parecer", "minuta", "peticao inicial", "elabore a peticao", "redija a peticao", "contestacao", "recurso", "apelacao", "agravo", "embargos", "mandado de seguranca", "excecao de pre-executividade", "tese", "estrategia", "contrato", "reestruturacao", "holding", "sucessao", "citacao", "penhora", "bloqueio", "sisbajud", "prazo fatal", "auto de infracao"], "verbosProducao": ["elabore", "redija", "escreva", "prepare", "crie", "monte", "fundamente", "defenda", "impugne"], "modelos": {"SIMPLES": {"modelo": "claude-haiku-5-5", "maxTokens": 800}, "PADRAO": {"modelo": "claude-sonnet-5-5", "maxTokens": 2500}, "CRITICO": {"modelo": "claude-opus-5-5", "maxTokens": 6000}}};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const achar = (termos, t) => termos.find(x => new RegExp('(?<![a-z0-9])' + esc(x) + '(?![a-z0-9])').test(t)) || null;
function avaliar(prompt) {
  const t = norm(prompt), n = String(prompt || '').length, L = R.limites;
  const simples = achar(R.simples, t), producao = achar(R.verbosProducao, t), critico = achar(R.critico, t), padrao = achar(R.padrao, t);
  let faixa, motivo;
  if (critico && (producao || !simples)) { faixa = 'CRITICO'; motivo = 'termo crítico "' + critico + '"' + (producao ? ' com pedido de produção "' + producao + '"' : ''); }
  else if (n > L.caracteresCritico && producao) { faixa = 'CRITICO'; motivo = 'texto longo (' + n + ' caracteres) com pedido de produção "' + producao + '"'; }
  else if (padrao && !simples) { faixa = 'PADRAO'; motivo = 'termo técnico "' + padrao + '"'; }
  else if (n > L.caracteresPadrao && !simples) { faixa = 'PADRAO'; motivo = 'texto longo (' + n + ' caracteres)'; }
  else { faixa = 'SIMPLES'; motivo = simples ? 'tarefa simples ("' + simples + '")' : 'pedido curto, sem termo técnico ou crítico'; }
  const m = R.modelos[faixa];
  return { faixa, modelo: m.modelo, maxTokens: m.maxTokens, motivo, caracteres: n };
}
// LGPD: mascara CPF, CNPJ, e-mail e telefone antes de enviar ao modelo (número de processo é público e fica)
function mascarar(s) {
  const guard = []; let t = String(s || '').replace(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g, m => { guard.push(m); return '\u0000' + (guard.length - 1) + '\u0000'; });
  t = t.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ]').replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]').replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[E-MAIL]').replace(/(?<!\d)(?:\(?\d{2}\)?\s?)?9?\s?\d{4}-?\d{4}(?!\d)/g, '[TELEFONE]');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => guard[+i]);
}
if (typeof module !== 'undefined' && typeof $input === 'undefined') { module.exports = { avaliar, mascarar }; }
else {
  return $input.all().map(item => { const original = item.json.chatInput || ''; const r = avaliar(original);
    return { json: Object.assign({}, item.json, { chatInput: mascarar(original), complexidade: r.faixa, modelo: r.modelo, maxTokens: r.maxTokens, motivo: r.motivo, caracteres: r.caracteres, sessionId: item.json.sessionId }) }; });
}
