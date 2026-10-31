/* Classificador de sentenças previdenciárias publicadas no DJEN — base para prever contestação e sentença (v1.0, 31/10/2026).
 * A partir do texto da sentença: benefício discutido, resultado (procedente, parcial, improcedente, extinto), motivos e o trecho do dispositivo.
 * Não guarda nome de parte (LGPD): só processo, órgão, data, benefício, resultado e motivos. Navegador (window.SentencaPrev) e node. */
(function (root) {
  'use strict';
  const sem = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
  const BENEFICIOS = [
    ['bpc', 'BPC/LOAS', /beneficio (assistencial|de prestacao continuada)|\bloas\b|\bbpc\b|amparo assistencial|lei n?.? ?8\.742/],
    ['salario_maternidade', 'Salário-maternidade', /salario[- ]maternidade/],
    ['pensao_morte', 'Pensão por morte', /pensao por morte/],
    ['auxilio_acidente', 'Auxílio-acidente', /auxilio[- ]acidente/],
    ['incapacidade', 'Benefício por incapacidade', /auxilio[- ]doenca|beneficio por incapacidade|incapacidade (temporaria|permanente)|aposentadoria por invalidez|restabelecimento/],
    ['especial', 'Aposentadoria especial / tempo especial', /aposentadoria especial|tempo (de servico |de contribuicao )?especial|atividade especial|agente(s)? nocivo/],
    ['rural', 'Aposentadoria rural / segurado especial', /segurad[oa] especial|trabalhador(a)? rural|aposentadoria (por idade )?rural|atividade rural|aposentadoria hibrida/],
    ['idade', 'Aposentadoria por idade', /aposentadoria (programada|por idade)/],
    ['tempo_contribuicao', 'Aposentadoria por tempo de contribuição', /aposentadoria por tempo de contribuicao/],
    ['revisao', 'Revisão de benefício', /revisao (do|de) beneficio|revisao da (rmi|renda mensal)|recalculo da renda/]];
  const MOTIVOS = [
    ['pericia', 'Perícia sem incapacidade', /(laudo|perito|pericia)[^.]{0,200}(nao (ha|houve|constatou|foi constatada|se constatou)|ausencia de|inexist\w+)[^.]{0,60}incapacidade|capacidade laborativa (preservada|mantida)|apt[oa] para (o trabalho|suas atividades)/],
    ['prova_material', 'Falta de início de prova material', /(ausencia|inexistencia|falta) de (inicio de )?prova material|prova exclusivamente testemunhal|sumula 149/],
    ['rural', 'Atividade rural / segurado especial não comprovado', /nao (restou |ficou )?(comprovad|demonstrad)\w*[^.]{0,80}(atividade rural|labor rural|lides rurais|segurad[oa] especial|regime de economia familiar)/],
    ['qualidade_segurado', 'Sem qualidade de segurado', /(perda|perdeu|nao (detinha|possuia|ostentava|mantinha)) (d?a )?qualidade de segurad/],
    ['carencia', 'Carência não cumprida', /(nao (cumpriu|preencheu|atingiu|implementou)|ausencia de|insuficien\w+)[^.]{0,40}carencia|carencia (minima )?(exigida )?nao (foi )?(cumprida|preenchida)/],
    ['renda', 'Renda / vulnerabilidade não comprovada', /(nao (restou )?(comprovad|demonstrad)\w*|ausencia de)[^.]{0,40}(miserabilidade|vulnerabilidade|hipossuficiencia)|renda per capita[^.]{0,80}superior/],
    ['epi_ruido', 'Tempo especial afastado (EPI/ruído/laudo)', /epi eficaz|equipamento de protecao individual eficaz|ruido (inferior|abaixo)|nivel de ruido inferior|ppp[^.]{0,80}(irregular|sem responsavel tecnico|extemporaneo)/],
    ['rpps_ctc', 'Tempo de regime próprio sem CTC', /regime proprio[^.]{0,120}(certidao de tempo de contribuicao|ctc)|ctc[^.]{0,60}(nao|ausencia)/],
    ['interesse', 'Sem requerimento administrativo / interesse de agir', /(ausencia|falta) de (previo )?requerimento administrativo|falta de interesse de agir|tema 350/],
    ['dependencia', 'Dependência / união estável não comprovada', /(nao (restou )?(comprovad|demonstrad)\w*|ausencia de prova)[^.]{0,60}(uniao estavel|dependencia economica)/],
    ['tempo_insuficiente', 'Tempo de contribuição insuficiente', /tempo (de contribuicao )?insuficiente|nao (atingiu|alcancou|perfaz)[^.]{0,40}tempo/]];
  function dispositivo(texto) { const t = String(texto || ''), u = sem(t);
    const marcas = ['dispositivo', 'ante o exposto', 'diante do exposto', 'isso posto', 'isto posto', 'pelo exposto', 'em face do exposto', 'posto isso', 'ante todo o exposto'];
    let i = -1; marcas.forEach(m => { const k = u.lastIndexOf(m); if (k > i) i = k; }); if (i < 0) i = Math.max(0, u.length - 1500); return { u: u.slice(i), t: t.slice(i, i + 900).replace(/\s+/g, ' ').trim() }; }
  function resultado(u) {
    if (/julgo (o |os )?pedidos? (\w+ )?parcialmente procedente|julgo parcialmente procedente|parcialmente procedente(s)? o(s)? pedido|procedencia parcial/.test(u)) return 'parcial';
    if (/julgo (o |os )?pedidos? (\w+ )?improcedentes?|julgo improcedente|improcedente(s)? o(s)? pedido|julgo improcedentes/.test(u)) return 'improcedente';
    if (/julgo (o |os )?pedidos? (\w+ )?procedentes?|julgo procedente|procedente(s)? o(s)? pedido|julgo procedentes/.test(u)) return 'procedente';
    if (/(extingo|extinto|extincao) (o processo|o feito)?[^.]{0,40}sem (resolucao|julgamento) do merito|art\.? ?485/.test(u)) return 'extinto';
    if (/homologo (o )?acordo/.test(u)) return 'acordo';
    return '';
  }
  /* classificar(item) — item do DJEN: { numeroprocessocommascara | numero_processo, nomeOrgao, data_disponibilizacao, tipoDocumento, texto, link, id } */
  function classificar(item) {
    const texto = String(item.texto || ''), u = sem(texto), cnj = item.numeroprocessocommascara || item.numero_processo || '';
    const ehSentenca = /sentenca/.test(sem(item.tipoDocumento)) || /\bsentenca\b/.test(u.slice(0, 1500));
    const contraINSS = /instituto nacional do seguro social|\binss\b/.test(u.slice(0, 2500));
    const disp = dispositivo(texto), res = resultado(disp.u);
    // LGPD: tira do trecho guardado o nome das partes e dos advogados informados na publicação
    let dt = disp.t; [].concat(item.destinatarios || [], (item.destinatarioadvogados || []).map(x => x.advogado || {})).map(x => x && x.nome).filter(n => n && n.length > 3).forEach(n => { dt = dt.split(n).join('[parte]'); }); disp.t = dt;
    const b = BENEFICIOS.find(([, , re]) => re.test(disp.u)) || BENEFICIOS.find(([, , re]) => re.test(u.slice(0, 6000))) || BENEFICIOS.find(([, , re]) => re.test(u));
    const motivos = res === 'procedente' || res === 'acordo' ? [] : MOTIVOS.filter(([, , re]) => re.test(u)).map(([k, n]) => ({ k, nome: n }));
    return { id: 'djen-' + (item.id || cnj.replace(/\D/g, '')), cnj, orgao: item.nomeOrgao || '', subsecao: /\.4\.05\.8103$/.test(cnj) ? 'Sobral' : /\.4\.05\.8100$/.test(cnj) ? 'Fortaleza' : '',
      data: item.data_disponibilizacao || '', tipo: 'sentenca', sentenca: ehSentenca, contraINSS, beneficio: b ? b[0] : 'outro', beneficioNome: b ? b[1] : 'Outro', resultado: res,
      motivos, dispositivo: disp.t.slice(0, 700), link: item.link || '', materia: 'Previdenciário', fonte: 'DJEN' };
  }
  /* estatisticas(sentencas, { beneficio, subsecao }) → total, procedência, motivos mais frequentes de improcedência */
  function estatisticas(lista, o) { o = o || {}; const L = (lista || []).filter(s => s.sentenca && s.contraINSS && s.resultado && (!o.beneficio || s.beneficio === o.beneficio) && (!o.subsecao || s.subsecao === o.subsecao));
    const c = r => L.filter(s => s.resultado === r).length, n = L.length, mot = {};
    L.filter(s => s.resultado === 'improcedente' || s.resultado === 'parcial').forEach(s => s.motivos.forEach(m => { mot[m.nome] = (mot[m.nome] || 0) + 1; }));
    return { total: n, procedente: c('procedente'), parcial: c('parcial'), improcedente: c('improcedente'), extinto: c('extinto'), acordo: c('acordo'),
      exito: n ? Math.round(100 * (c('procedente') + c('parcial') + c('acordo')) / n) : null, motivos: Object.entries(mot).sort((a, b) => b[1] - a[1]).map(([nome, qt]) => ({ nome, qt })),
      suficiente: n >= 30 }; }
  const API = { BENEFICIOS: BENEFICIOS.map(([k, n]) => ({ k, nome: n })), MOTIVOS: MOTIVOS.map(([k, n]) => ({ k, nome: n })), classificar, estatisticas, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SentencaPrev = API;
})(typeof window !== 'undefined' ? window : globalThis);
