/* Prazos processuais em dias úteis (CPC, arts. 219, 220 e 224) (v1.1, 11/11/2026; v1.0, 30/10/2026).
 * Separado do prazo de atendimento (horas úteis, 8h–17h), que não deve ser usado para prazo processual.
 * Feriados: nacionais, Carnaval (seg/ter), Sexta-feira Santa, Corpus Christi e Data Magna do CE (25/3), todos os anos;
 * o municipal (5/7, Sobral) só quando a comarca é Sobral; os dias sem expediente do tribunal: os da lei (JF, Lei 5.010/1966)
 * todos os anos e os do TJCE só nos anos com portaria cadastrada em TRIBUNAIS.tjce.anos (ano sem portaria = aviso);
 * + feriadosExtras informados para o caso. */
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dia = s => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d, 12); };
  const soma = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  function pascoa(a) { const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3),
      i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4, m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451),
      mes = Math.floor((i + m - 7 * n + 114) / 31), dd = ((i + m - 7 * n + 114) % 31) + 1; return new Date(a, mes - 1, dd, 12); }
  // dias sem expediente próprios de cada justiça. fixos/pascoa = todos os anos (previstos em lei);
  // anos = calendário de cada ano (portaria): para um ano novo, acrescente { AAAA: { fonte, fixos, pascoa } }
  const TRIBUNAIS = {
    tjce: { nome: 'Justiça Estadual do Ceará (TJCE)', fixos: [], pascoa: [],
      anos: { 2026: { fonte: 'Portaria TJCE nº 2.924/2025 (calendário de 2026)', fixos: [[3, 19], [10, 28], [12, 8]], pascoa: [-3] } } },
    jf: { nome: 'Justiça Federal (JFCE/TRF5)', fonte: 'Lei nº 5.010/1966, art. 62', fixos: [[8, 11], [11, 1], [12, 8]], pascoa: [-4, -3], natal: true, anos: {} }
  };
  // feriados municipais da comarca (só entram quando a comarca é informada)
  const COMARCAS = { sobral: { nome: 'Sobral', fonte: 'feriado municipal de Sobral (5/7)', fixos: [[7, 5]] } };
  const calendarioDoAno = (tribunal, ano) => { const t = TRIBUNAIS[tribunal]; return t && t.anos ? t.anos[ano] || null : null; };
  function feriados(ano, extras, tribunal, comarca) {
    const t = TRIBUNAIS[tribunal] || { fixos: [], pascoa: [] }, a = calendarioDoAno(tribunal, ano) || { fixos: [], pascoa: [] }, c = COMARCAS[comarca] || { fixos: [] };
    const f = [[1, 1], [3, 25], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25], ...t.fixos, ...a.fixos, ...c.fixos].map(([m, d]) => iso(new Date(ano, m - 1, d, 12)));
    const p = pascoa(ano); [-48, -47, -2, 60, ...t.pascoa, ...a.pascoa].forEach(n => f.push(iso(soma(p, n))));
    if (t.natal) { for (let d = 20; d <= 31; d++) f.push(iso(new Date(ano, 11, d, 12))); for (let d = 1; d <= 6; d++) f.push(iso(new Date(ano, 0, d, 12))); }   // Lei 5.010/1966, art. 62, I
    return new Set(f.concat((extras || []).filter(x => String(x).startsWith(String(ano)))));
  }
  // art. 220: suspensão de 20/12 a 20/1, inclusive
  const recesso = d => (d.getMonth() === 11 && d.getDate() >= 20) || (d.getMonth() === 0 && d.getDate() <= 20);
  const expediente = (d, extras, tribunal, comarca) => d.getDay() !== 0 && d.getDay() !== 6 && !feriados(d.getFullYear(), extras, tribunal, comarca).has(iso(d));
  function util(d, extras, tribunal, comarca) { return expediente(d, extras, tribunal, comarca) && !recesso(d); }
  let TRIB = '', COM = '';
  const proximoUtil = (d, extras) => { let x = d; while (!util(x, extras, TRIB, COM)) x = soma(x, 1); return x; };
  /* entrada: { disponibilizacao | intimacao (AAAA-MM-DD), dias, dobro (art. 183/186), tribunal: 'tjce'|'jf'|'', comarca: 'sobral'|'', feriadosExtras: ['AAAA-MM-DD'] }
   * - disponibilizacao no DJe/DJEN: publicação = 1º dia útil seguinte (art. 224, § 2º); início = 1º dia útil após a publicação (§ 3º)
   * - intimacao (data da ciência): início = 1º dia útil seguinte (art. 224, caput: exclui o dia do começo) */
  function calcular(o) {
    const ex = o.feriadosExtras || [], n = (+o.dias || 0) * (o.dobro ? 2 : 1); TRIB = o.tribunal || ''; COM = COMARCAS[o.comarca] ? o.comarca : '';
    if (!(n > 0)) throw new Error('Informe o número de dias do prazo.');
    let publicacao = null, inicio;
    // a publicação ocorre no 1º dia com expediente (a suspensão do art. 220 atinge a contagem, não a publicação):
    // leitura conservadora, que antecipa o início da contagem
    if (o.disponibilizacao) { let pb = soma(dia(o.disponibilizacao), 1); while (!expediente(pb, ex, TRIB, COM)) pb = soma(pb, 1); publicacao = pb; inicio = proximoUtil(soma(publicacao, 1), ex); }
    else if (o.intimacao) inicio = proximoUtil(soma(dia(o.intimacao), 1), ex);
    else throw new Error('Informe a data de disponibilização ou de intimação.');
    let d = inicio, c = 1; while (c < n) { d = proximoUtil(soma(d, 1), ex); c++; }
    // memória de cálculo: cada dia não contado entre o marco e o vencimento, com o motivo
    const br = x => iso(x).split('-').reverse().join('/'), saltos = [];
    for (let x = soma(dia(o.disponibilizacao || o.intimacao), 1); x <= d; x = soma(x, 1)) {
      if (util(x, ex, TRIB, COM)) continue;
      const municipal = COM && COMARCAS[COM].fixos.some(([m, dd]) => x.getMonth() === m - 1 && x.getDate() === dd);
      const m = x.getDay() === 6 ? 'sábado' : x.getDay() === 0 ? 'domingo' : !expediente(x, ex, TRIB, COM) ? (ex.includes(iso(x)) ? 'feriado informado' : (TRIBUNAIS[TRIB] && TRIBUNAIS[TRIB].natal && ((x.getMonth() === 11 && x.getDate() >= 20) || (x.getMonth() === 0 && x.getDate() <= 6))) ? 'recesso da Justiça Federal, Lei 5.010/1966, art. 62, I' : municipal ? COMARCAS[COM].fonte : 'feriado') : 'suspensão do art. 220 do CPC';
      saltos.push({ data: iso(x), motivo: m }); }
    // agrupa dias seguidos (ignorando fins de semana no meio) com o mesmo motivo
    const faixas = l => { const out = []; let ini = null, fim = null, mot = '';
      const fecha = () => { if (ini) out.push((ini === fim ? br(dia(ini)) : 'de ' + br(dia(ini)) + ' a ' + br(dia(fim))) + ' (' + mot + ')'); };
      l.forEach(s => { const contiguo = fim && s.motivo === mot && saltos.filter(z => z.data > fim && z.data < s.data).every(z => /sábado|domingo/.test(z.motivo)) && (dia(s.data) - dia(fim)) / 864e5 <= 3;
        if (contiguo) fim = s.data; else { fecha(); ini = fim = s.data; mot = s.motivo; } }); fecha(); return out; };
    const fora = saltos.filter(s => !/sábado|domingo/.test(s.motivo));
    const memoria = (o.disponibilizacao ? 'Disponibilizado em ' + br(dia(o.disponibilizacao)) + '; publicação em ' + br(publicacao) + ' (art. 224, § 2º); ' : 'Intimação em ' + br(dia(o.intimacao)) + '; ') +
      'início em ' + br(inicio) + ' (art. 224, § 3º); ' + n + ' dias úteis' + (o.dobro ? ' (em dobro, arts. 183/186)' : '') + '; ' +
      (fora.length ? 'não contados além dos fins de semana: ' + faixas(fora).join(', ') : 'só fins de semana excluídos') + '; vencimento em ' + br(d) + '.';
    // anos da contagem sem portaria cadastrada (só para tribunal que usa calendário anual)
    const anos = []; for (let a = dia(o.disponibilizacao || o.intimacao).getFullYear(); a <= d.getFullYear(); a++) anos.push(a);
    const semPortaria = TRIBUNAIS[TRIB] && TRIB === 'tjce' ? anos.filter(a => !calendarioDoAno(TRIB, a)) : [];
    const fontes = TRIBUNAIS[TRIB] ? [TRIBUNAIS[TRIB].fonte].concat(anos.map(a => (calendarioDoAno(TRIB, a) || {}).fonte)).filter(Boolean) : [];
    return { memoria, saltos, publicacao: publicacao && iso(publicacao), inicio: iso(inicio), vencimento: iso(d), diasUteis: n,
      tribunal: TRIBUNAIS[TRIB] ? TRIBUNAIS[TRIB].nome + (fontes.length ? ' (' + fontes.join('; ') + ')' : '') + (semPortaria.length ? ' — calendário de ' + semPortaria.join(' e ') + ' não cadastrado: considerados só os feriados nacionais' + (COM ? ', estaduais e municipais' : ' e estaduais') + '; confira a portaria' : '') : 'sem calendário de tribunal',
      comarca: COM ? COMARCAS[COM].nome : 'não informada (sem feriado municipal)', semPortaria,
      aviso: 'Confira o calendário do tribunal (feriados forenses e indisponibilidade do sistema, art. 224, § 1º) antes de lançar no Astrea.' };
  }
  // comarca pelo número CNJ: TJCE (8.06) origem 0167 e JF da 5ª Região (4.05) subseção 8103 = Sobral
  function comarcaDoCNJ(cnj) { const d = String(cnj || '').replace(/\D/g, ''); if (d.length !== 20) return ''; const j = d[13], tr = d.slice(14, 16), o = d.slice(16);
    return (j === '8' && tr === '06' && o === '0167') || (j === '4' && tr === '05' && o === '8103') ? 'sobral' : ''; }
  const API = { TRIBUNAIS, COMARCAS, calcular, comarcaDoCNJ, util: (s, ex, t, c) => util(dia(s), ex, t, c), feriados, versao: '1.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PrazoProcessual = API;
})(typeof window !== 'undefined' ? window : globalThis);
