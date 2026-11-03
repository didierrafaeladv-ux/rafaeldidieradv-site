/* Monitor das rotinas automáticas (v1.0, 02/11/2026).
 * Cada tarefa agendada grava, ao terminar, um "sinal de vida" na coleção "rotinas" do Atendimento: {id, nome, em, status: 'ok'|'falha'|'aviso', resumo}.
 * Este módulo diz, para cada rotina, quando a última execução deveria ter acontecido e se o sinal está em dia, atrasado ou com falha.
 * Usado pelo painel do Atendimento e pela verificação diária. Navegador (window.Rotinas) e node. */
(function (root) {
  'use strict';
  // dias: dias da semana em que roda (0=domingo); hora/min no fuso de Fortaleza (UTC-3, sem horário de verão); folgaMin: tolerância após o horário
  const ROTINAS = [
    { id: 'publicacoes', nome: 'Publicações do dia', dias: [1, 2, 3, 4, 5], hora: 6, min: 53, folgaMin: 90 },
    { id: 'ponte', nome: 'Ponte RD (Atendimento → CRM → Drive)', dias: [1, 2, 3, 4, 5], horas: [8, 9, 10, 11, 12, 13, 14, 15, 16], min: 7, folgaMin: 90 },
    { id: 'datajud', nome: 'Movimentações Datajud', dias: [0, 1, 2, 3, 4, 5, 6], hora: 19, min: 17, folgaMin: 120 },
    { id: 'backup', nome: 'Backup semanal', dias: [5], hora: 15, min: 56, folgaMin: 180 },
    { id: 'resumo', nome: 'Resumo semanal', dias: [5], hora: 16, min: 44, folgaMin: 180 },
    { id: 'sentencas', nome: 'Sentenças previdenciárias (JEF Sobral)', dias: [6], hora: 7, min: 41, folgaMin: 180 },
    { id: 'radar', nome: 'Radar de teses tributárias', diaDoMes: 1, hora: 15, min: 23, folgaMin: 240 },
    { id: 'email', nome: 'Entrada de e-mails', dias: [1, 2, 3, 4, 5], horas: [8, 13], min: 13, folgaMin: 90 },
    { id: 'monitor', nome: 'Verificação das rotinas', dias: [0, 1, 2, 3, 4, 5, 6], hora: 20, min: 41, folgaMin: 120 }];
  const FUSO = -3 * 60;   // minutos em relação a UTC
  const local = d => new Date(d.getTime() + FUSO * 60000);   // "relógio" de Fortaleza em campos UTC
  /* ultimaEsperada(r, agora) → Date (UTC) da execução mais recente que já deveria ter terminado (horário + folga ≤ agora) */
  function ultimaEsperada(r, agora) { const a = agora || new Date();
    const horas = (r.horas || [r.hora]).slice().sort((x, y) => y - x);   // rotinas de hora em hora: tenta da última hora do dia para a primeira
    for (let k = 0; k < 40; k++) for (const h of horas) { const l = local(a); l.setUTCDate(l.getUTCDate() - k); l.setUTCHours(h, r.min, 0, 0);
      const ok = r.diaDoMes ? l.getUTCDate() === r.diaDoMes : r.dias.includes(l.getUTCDay()); if (!ok) continue;
      const utc = new Date(l.getTime() - FUSO * 60000); if (utc.getTime() + r.folgaMin * 60000 <= a.getTime()) return utc; }
    return null; }
  /* avaliar(sinais, agora) → [{id, nome, situacao: 'ok'|'atrasada'|'falha'|'aviso'|'sem sinal', ultima, esperada, resumo}] */
  function avaliar(sinais, agora) { const a = agora || new Date(), por = {}; (sinais || []).forEach(s => { if (s && s.id) por[s.id] = s; });
    return ROTINAS.map(r => { const s = por[r.id], esp = ultimaEsperada(r, a); let situacao;
      if (!s) situacao = 'sem sinal';
      else if (s.status === 'falha') situacao = 'falha';
      else if (esp && new Date(s.em).getTime() < esp.getTime() - 5 * 60000) situacao = 'atrasada';
      else situacao = s.status === 'aviso' ? 'aviso' : 'ok';
      return { id: r.id, nome: r.nome, situacao, ultima: s ? s.em : '', esperada: esp ? esp.toISOString() : '', resumo: s ? (s.resumo || '') : '' }; }); }
  const problemas = L => L.filter(x => x.situacao === 'falha' || x.situacao === 'atrasada');
  const API = { ROTINAS, ultimaEsperada, avaliar, problemas, versao: '1.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Rotinas = API;
})(typeof window !== 'undefined' ? window : globalThis);
