#!/usr/bin/env node
/* Coleta de sentenças previdenciárias do DJEN (API pública comunicaapi.pje.jus.br) — RD Prev (v1.0, 31/10/2026).
 * Uso: node coleta_sentencas.js --de 2026-10-24 --ate 2026-10-30 [--subsecao 8103] [--saida dir] [--arquivo itens.json (teste, sem rede)]
 * Busca as comunicações do TRF5 no período, fica só com SENTENÇAS contra o INSS da subseção (código do órgão no número CNJ, 8103 = Sobral),
 * classifica com sentenca_prev.js e grava:
 *   <saida>/fontes-lote-N.json  — escritas prontas para o banco do Atendimento (coleção "fontes"), até 50 por lote, SEM nome de parte;
 *   <saida>/resumo.txt          — resumo legível (processo, órgão, benefício, resultado, motivos, dispositivo) para a pasta do Drive;
 *   <saida>/estatisticas.json   — totais por benefício.
 * Lê o texto inteiro só aqui, no script: nada disso passa pela conversa do Claude. */
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const S = require(fs.existsSync(path.join(__dirname, 'sentenca_prev.js')) ? path.join(__dirname, 'sentenca_prev.js') : path.join(__dirname, '../src/sentenca_prev.js'));
const DE = arg('de'), ATE = arg('ate', DE), SUB = arg('subsecao', '8103'), SAIDA = arg('saida', '.'), ARQ = arg('arquivo');
const API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const dias = (a, b) => { const out = []; for (let d = new Date(a + 'T12:00:00Z'); d <= new Date(b + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };
const espera = ms => new Promise(r => setTimeout(r, ms));
async function buscarDia(dia) { const itens = []; let pagina = 1, total = Infinity;
  while ((pagina - 1) * 100 < total && pagina <= 60) {
    const u = API + '?siglaTribunal=TRF5&texto=SENTEN%C3%87A&dataDisponibilizacaoInicio=' + dia + '&dataDisponibilizacaoFim=' + dia + '&itensPorPagina=100&pagina=' + pagina;
    let r, tent = 0; for (;;) { try { r = await fetch(u, { headers: { accept: 'application/json' } }); if (r.status === 429 && tent++ < 4) { await espera(3000 * tent); continue; } break; } catch (e) { if (tent++ < 3) { await espera(2000); continue; } throw new Error('Sem acesso à API do DJEN (' + e.message + '). Libere o domínio comunicaapi.pje.jus.br.'); } }
    if (!r.ok) throw new Error('API do DJEN respondeu ' + r.status + ' em ' + dia);
    const j = await r.json(); total = +j.count || 0; (j.items || []).forEach(x => itens.push(x)); pagina++; await espera(400); }
  return itens; }
(async () => {
  if (!ARQ && !DE) { console.error('Informe --de AAAA-MM-DD (e --ate).'); process.exit(2); }
  const brutos = ARQ ? (JSON.parse(fs.readFileSync(ARQ, 'utf8')).items || JSON.parse(fs.readFileSync(ARQ, 'utf8'))) : (await Promise.all(dias(DE, ATE).map(async (d, i) => { await espera(i * 1500); return buscarDia(d); }))).flat();
  const sub = new RegExp('\\.4\\.05\\.' + SUB + '$'), vistos = new Set();
  const sentencas = brutos.map(it => Object.assign({}, it, { texto: String(it.texto || '').replace(/<[^>]+>/g, ' ') })).filter(it => sub.test(it.numeroprocessocommascara || ''))
    .map(S.classificar).filter(s => s.sentenca && s.contraINSS && s.resultado).filter(s => !vistos.has(s.id) && vistos.add(s.id));
  sentencas.forEach(s => { s.coletadoEm = new Date().toISOString(); s.subsecao = s.subsecao || ('código ' + SUB); });
  fs.mkdirSync(SAIDA, { recursive: true });
  for (let i = 0; i < sentencas.length; i += 50) fs.writeFileSync(path.join(SAIDA, 'fontes-lote-' + (i / 50 + 1) + '.json'), JSON.stringify(sentencas.slice(i, i + 50).map(s => ({ op: 'set', collection: 'fontes', doc_id: s.id, data: s })), null, 0));
  const est = {}; S.BENEFICIOS.concat([{ k: 'outro', nome: 'Outro' }]).forEach(b => { const e = S.estatisticas(sentencas, { beneficio: b.k }); if (e.total) est[b.nome] = e; });
  fs.writeFileSync(path.join(SAIDA, 'estatisticas.json'), JSON.stringify({ periodo: [DE || '', ATE || ''], subsecao: SUB, lidas: brutos.length, sentencas: sentencas.length, porBeneficio: est }, null, 1));
  fs.writeFileSync(path.join(SAIDA, 'resumo.txt'), 'Sentenças previdenciárias contra o INSS — subseção ' + SUB + ' — ' + (DE || '') + ' a ' + (ATE || '') + '\n' + sentencas.length + ' sentença(s) classificadas de ' + brutos.length + ' comunicação(ões) lidas.\n\n' +
    sentencas.map(s => s.cnj + ' · ' + s.orgao + ' · ' + s.data + '\n  ' + s.beneficioNome + ' — ' + s.resultado.toUpperCase() + (s.motivos.length ? ' — motivos: ' + s.motivos.map(m => m.nome).join('; ') : '') + '\n  Dispositivo: ' + s.dispositivo.slice(0, 400) + '\n  ' + s.link).join('\n\n') + '\n');
  console.log(JSON.stringify({ lidas: brutos.length, sentencas: sentencas.length, lotes: Math.ceil(sentencas.length / 50), porBeneficio: Object.fromEntries(Object.entries(est).map(([k, e]) => [k, e.total + ' (' + e.exito + '% de êxito)'])) }));
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
