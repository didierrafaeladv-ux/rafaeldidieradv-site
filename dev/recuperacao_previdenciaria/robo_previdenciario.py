#!/usr/bin/env python3
"""Robô de levantamento de contribuições previdenciárias patronais a recuperar — Rafael Didier Advocacia (v1.1, 11/11/2026: leitura de valores pela regra do numBR; v1.0, 03/11/2026).

Recebe:
  - caso.json            parâmetros do título judicial (teses deferidas, período, alíquotas, data da compensação)
  - folha.csv            resumo da folha por competência e rubrica: competencia;codigo;descricao;valor[;vinculo]
                         (vinculo opcional: RGPS ou RPPS; só RGPS entra no cálculo)
  - gps.csv              extrato do e-CAC "Consultar Extrato de Contribuições Previdenciárias":
                         competencia;qtd_documentos;valor_recolhido;imputacao
  - selic.csv            SELIC mensal do Banco Central (série SGS 4390): mes;selic_pct
Gera a planilha .xlsx com memória de cálculo por competência, resumo por tese e ano, rubricas classificadas
(para conferência), alertas e fontes.

Regras (ver caso.json): indébito = base da rubrica × (alíquota patronal + RAT × FAP), limitado ao recolhido em GPS
na competência; atualização pela SELIC acumulada do mês seguinte ao pagamento até o mês anterior à compensação,
mais 1% no mês da compensação (Lei 9.250/1995, art. 39, § 4º; Lei 8.212/1991, art. 89, § 4º).

Uso:  python3 robo_previdenciario.py caso.json  [--saida planilha.xlsx]
      python3 robo_previdenciario.py --modelo-folha folha_modelo.csv     (gera o modelo para o município preencher)
Depende só de openpyxl para gravar o .xlsx (o cálculo não depende de nada).
"""
import argparse, csv, json, math, os, re, sys, unicodedata
from collections import defaultdict
from datetime import date

# ---------------------------------------------------------------- leitura


def norm(t):
    t = unicodedata.normalize('NFD', str(t or ''))
    t = re.sub(r'[-_.,;:()\[\]]', ' ', ''.join(c for c in t if unicodedata.category(c) != 'Mn'))   # "SALÁRIO-MATERNIDADE", "AUX.DOENÇA"
    return re.sub(r'\s+', ' ', t).strip().lower()


def num(v):
    """Leitura de valores pela mesma regra do numBR (dev/planejatrib/numero_br.js), conferida pelos mesmos casos nos testes.
    Com vírgula e ponto, o último separador é o decimal; só vírgula → decimal; um único ponto seguido de exatamente 3 dígitos
    (parte inteira de 1 a 3 dígitos, sem zero à esquerda) é milhar ("1.000"); qualquer outro ponto único é decimal ("1000.50",
    "0.125"); vários pontos → milhar. Aceita "R$", espaços, sinal e parênteses contábeis. Inválido → 0."""
    if isinstance(v, bool): return 0.0
    if isinstance(v, (int, float)): return float(v) if math.isfinite(v) else 0.0
    s = re.sub(r'R\$|\s', '', str(v or ''))
    if not s: return 0.0
    neg = False
    if re.fullmatch(r'\(.*\)', s): neg, s = True, s[1:-1]
    if s.startswith('-'): neg, s = not neg, s[1:]
    if not re.fullmatch(r'[\d.,]+', s): return 0.0
    iv, ip = s.rfind(','), s.rfind('.')
    if iv >= 0 and ip >= 0: s = s.replace('.', '').replace(',', '.') if iv > ip else s.replace(',', '')
    elif iv >= 0: s = s.replace(',', '') if s.count(',') > 1 else s.replace(',', '.')
    elif ip >= 0:
        if s.count('.') > 1: s = s.replace('.', '')
        elif re.fullmatch(r'[1-9]\d{0,2}\.\d{3}', s): s = s.replace('.', '')
    m = re.match(r'\d*\.?\d+|\d+\.?', s)   # como o parseFloat do JS: lê o início numérico
    if not m: return 0.0
    x = float(m.group(0))
    return -x if neg else x


def comp(v):
    """Competência em 'AAAA-MM' (13 = 13º salário). Aceita MM/AAAA, AAAA-MM, AAAAMM."""
    s = str(v).strip()
    m = re.fullmatch(r'(\d{1,2})/(\d{4})', s) or None
    if m: return f'{m.group(2)}-{int(m.group(1)):02d}'
    m = re.fullmatch(r'(\d{4})-?(\d{2})', s)
    if m: return f'{m.group(1)}-{m.group(2)}'
    raise ValueError(f'competência inválida: {v!r}')


def ler_csv(caminho):
    with open(caminho, encoding='utf-8-sig', newline='') as f:
        amostra = f.read(2048); f.seek(0)
        sep = ';' if amostra.count(';') >= amostra.count(',') else ','
        return [{k.strip().lower(): (v or '').strip() for k, v in r.items() if k} for r in csv.DictReader(f, delimiter=sep)]


# ---------------------------------------------------------------- datas


def mes_pagamento(c):
    """Mês do recolhimento: competência mensal vence no mês seguinte; 13º vence em dezembro do mesmo ano."""
    a, m = map(int, c.split('-'))
    if m == 13: return (a, 12)
    return (a + (m == 12), 1 if m == 12 else m + 1)


def soma_meses(am, n):
    a, m = am; t = a * 12 + (m - 1) + n
    return (t // 12, t % 12 + 1)


def selic_acumulada(c, mes_compensacao, selic):
    """Soma da SELIC do mês seguinte ao pagamento até o mês anterior à compensação, + 1% no mês da compensação."""
    ini = soma_meses(mes_pagamento(c), 1); fim = soma_meses(mes_compensacao, -1); total, faltam = 0.0, []
    am = ini
    while (am[0], am[1]) <= fim:
        k = f'{am[0]}-{am[1]:02d}'
        if k in selic: total += selic[k]
        else: faltam.append(k)
        am = soma_meses(am, 1)
    return round(total + 1.0, 2), faltam


# ---------------------------------------------------------------- classificação das rubricas


def classificar(descricao, codigo, caso):
    """Devolve (tese, motivo). Códigos explícitos em caso['rubricas_codigos'] têm prioridade sobre as palavras-chave."""
    cod = str(codigo).strip()
    for tese, cods in caso.get('rubricas_codigos', {}).items():
        if cod and cod in [str(x) for x in cods]: return tese, f'código {cod}'
    d = norm(descricao)
    for t in caso['teses']:
        if any(re.search(p, d) for p in t.get('excluir_se', [])): continue
        for p in t['palavras']:
            if re.search(p, d): return t['id'], f'palavra-chave "{p}"'
    return None, ''


# ---------------------------------------------------------------- cálculo


def calcular(caso, folha, gps, selic):
    teses = {t['id']: t for t in caso['teses']}
    ini, fim = comp(caso['competencia_inicial']), comp(caso['competencia_final'])
    aliq = caso['aliquota_patronal_pct'] / 100
    rat_cfg, fap = caso['rat_pct'], caso.get('fap', {})
    rat_ano = lambda a: rat_cfg if isinstance(rat_cfg, (int, float)) else rat_cfg.get(str(a), rat_cfg.get('padrao'))
    mc = tuple(map(int, caso['mes_compensacao'].split('-')))
    gps_c = {comp(g['competencia']): num(g['valor_recolhido']) for g in gps}
    selic_m = {r['mes']: num(r['selic_pct']) for r in selic}

    bases = defaultdict(lambda: defaultdict(float)); classificadas, alertas = [], []
    for r in folha:
        c = comp(r['competencia']); v = num(r['valor'])
        vinc = (r.get('vinculo') or 'RGPS').upper()
        tese, motivo = classificar(r.get('descricao', ''), r.get('codigo', ''), caso)
        fora = not (ini <= c <= fim)
        situacao = ('fora do período' if fora else 'RPPS (não entra)' if vinc == 'RPPS' else
                    'sem tese' if not tese else teses[tese]['status'])
        classificadas.append({'competencia': c, 'codigo': r.get('codigo', ''), 'descricao': r.get('descricao', ''), 'valor': v,
                              'vinculo': vinc, 'tese': tese or '', 'motivo': motivo, 'situacao': situacao})
        if tese and not fora and vinc != 'RPPS': bases[c][tese] += v

    linhas = []
    for c in sorted(set(bases) | {k for k in gps_c if ini <= k <= fim}):
        a = int(c[:4]); f = fap.get(str(a), fap.get('padrao', 1.0)); aliq_total = aliq + rat_ano(a) / 100 * f
        b = bases.get(c, {})
        por_tese = {t: round(b.get(t, 0.0), 2) for t in teses}
        aproveitavel = sum(v for t, v in por_tese.items() if teses[t]['status'] in caso['status_que_entram'])
        nominal = round(aproveitavel * aliq_total, 2)
        recolhido = gps_c.get(c, 0.0)
        limitado = min(nominal, recolhido)
        if nominal > recolhido + 0.005:
            alertas.append({'competencia': c, 'tipo': 'teto', 'texto': f'indébito calculado ({nominal:,.2f}) maior que o recolhido em GPS ({recolhido:,.2f}); limitado ao recolhido'})
        if b and c not in gps_c:
            alertas.append({'competencia': c, 'tipo': 'sem GPS', 'texto': 'há rubricas na folha mas nenhum recolhimento no extrato do e-CAC'})
        fator, faltam = selic_acumulada(c, mc, selic_m)
        if faltam:
            alertas.append({'competencia': c, 'tipo': 'SELIC', 'texto': f'SELIC ausente para {", ".join(faltam[:4])}{"..." if len(faltam) > 4 else ""}'})
        pa, pm = mes_pagamento(c)
        linhas.append({'competencia': c, 'por_tese': por_tese, 'base_aproveitavel': round(aproveitavel, 2),
                       'aliquota_total_pct': round(aliq_total * 100, 4), 'fap': f, 'indebito_nominal': nominal,
                       'gps_recolhido': recolhido, 'indebito_limitado': round(limitado, 2),
                       'mes_pagamento': f'{pa}-{pm:02d}', 'selic_acumulada_pct': fator,
                       'indebito_atualizado': round(limitado * (1 + fator / 100), 2)})
    for c in sorted(k for k in gps_c if ini <= k <= fim and k not in bases):
        alertas.append({'competencia': c, 'tipo': 'sem folha', 'texto': 'há GPS no extrato mas a folha não foi informada para a competência'})
    return {'linhas': linhas, 'classificadas': classificadas, 'alertas': alertas}


def resumo(res, caso):
    por_tese = defaultdict(float); por_ano = defaultdict(lambda: [0.0, 0.0])
    st = {t['id']: t['status'] for t in caso['teses']}
    for l in res['linhas']:
        for t, v in l['por_tese'].items(): por_tese[t] += v
        a = l['competencia'][:4]; por_ano[a][0] += l['indebito_limitado']; por_ano[a][1] += l['indebito_atualizado']
    tot_nom = sum(l['indebito_limitado'] for l in res['linhas']); tot_at = sum(l['indebito_atualizado'] for l in res['linhas'])
    return {'bases_por_tese': {t: round(v, 2) for t, v in por_tese.items()}, 'status': st,
            'por_ano': {a: (round(v[0], 2), round(v[1], 2)) for a, v in sorted(por_ano.items())},
            'total_nominal': round(tot_nom, 2), 'total_atualizado': round(tot_at, 2),
            'competencias': len(res['linhas']), 'alertas': len(res['alertas'])}


# ---------------------------------------------------------------- planilha


def gravar_xlsx(caso, res, rs, saida):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    wb = Workbook(); azul = PatternFill('solid', fgColor='1F3A5F'); cinza = PatternFill('solid', fgColor='F2F2F2')
    amarelo = PatternFill('solid', fgColor='FFF2CC'); fino = Side(style='thin', color='BFBFBF')
    br = '#,##0.00'; pct = '0.00"%"'
    teses = caso['teses']

    def cab(ws, linha, titulos, larguras=None):
        for i, t in enumerate(titulos, 1):
            c = ws.cell(linha, i, t); c.font = Font(bold=True, color='FFFFFF'); c.fill = azul
            c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
            c.border = Border(top=fino, bottom=fino, left=fino, right=fino)
        if larguras:
            for i, w in enumerate(larguras, 1): ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = ws.cell(linha + 1, 1)

    def fmt_comp(c): a, m = c.split('-'); return f'{m}/{a}'

    # Resumo
    ws = wb.active; ws.title = 'Resumo'
    ws['A1'] = caso['titulo']; ws['A1'].font = Font(bold=True, size=14)
    info = [('Interessado', caso['interessado']), ('CNPJ', caso['cnpj']), ('Processo de habilitação (RFB)', caso['processo_rfb']),
            ('Processo judicial', caso['processo_judicial']), ('Período apurado', f"{fmt_comp(comp(caso['competencia_inicial']))} a {fmt_comp(comp(caso['competencia_final']))}"),
            ('Alíquota patronal + RAT', f"{caso['aliquota_patronal_pct']}% + RAT × FAP (por ano: ver Fontes e premissas)"),
            ('Atualização', f"SELIC acumulada até {caso['mes_compensacao']} (mês da compensação = 1%)"),
            ('Situação', caso.get('situacao', 'PRELIMINAR — conferir antes de transmitir'))]
    for i, (k, v) in enumerate(info, 3):
        ws.cell(i, 1, k).font = Font(bold=True); ws.cell(i, 2, v)
    r = len(info) + 4
    ws.cell(r, 1, 'Base de cálculo por tese').font = Font(bold=True, size=12); r += 1
    cab(ws, r, ['Tese', 'Situação no título', 'Base no período (R$)', 'Entra no total?'], [48, 34, 20, 16]); ws.freeze_panes = None
    for t in teses:
        r += 1; ws.cell(r, 1, t['nome']); ws.cell(r, 2, t['status_texto'])
        ws.cell(r, 3, rs['bases_por_tese'].get(t['id'], 0)).number_format = br
        ws.cell(r, 4, 'sim' if t['status'] in caso['status_que_entram'] else 'não')
    r += 2; ws.cell(r, 1, 'Indébito por ano').font = Font(bold=True, size=12); r += 1
    cab(ws, r, ['Ano', 'Indébito nominal (R$)', 'Indébito atualizado (R$)']); ws.freeze_panes = None
    for a, (n, at) in rs['por_ano'].items():
        r += 1; ws.cell(r, 1, int(a)); ws.cell(r, 2, n).number_format = br; ws.cell(r, 3, at).number_format = br
    r += 1
    for col, v in ((1, 'TOTAL'), (2, rs['total_nominal']), (3, rs['total_atualizado'])):
        c = ws.cell(r, col, v); c.font = Font(bold=True); c.fill = cinza
        if col > 1: c.number_format = br
    r += 2; ws.cell(r, 1, f"Alertas: {rs['alertas']} (ver aba Alertas)").font = Font(italic=True)

    # Memória
    ws = wb.create_sheet('Memória de cálculo')
    tit = ['Competência'] + [f"Base — {t['curto']}" for t in teses] + ['Base aproveitável', 'Alíquota total (%)', 'Indébito nominal',
           'GPS recolhido (e-CAC)', 'Indébito limitado ao recolhido', 'Mês do pagamento', 'SELIC acumulada (%)', 'Indébito atualizado']
    cab(ws, 1, tit, [12] + [16] * len(teses) + [16, 12, 16, 16, 18, 12, 12, 18])
    nt = len(teses)
    for i, l in enumerate(res['linhas'], 2):
        ws.cell(i, 1, fmt_comp(l['competencia']))
        for j, t in enumerate(teses, 2): ws.cell(i, j, l['por_tese'][t['id']]).number_format = br
        cols_ok = [get_column_letter(j) for j, t in enumerate(teses, 2) if t['status'] in caso['status_que_entram']]
        cb, ca, cn, cg, cl, cp, cs, cu = [nt + 2 + k for k in range(8)]
        ws.cell(i, cb, '=' + ('+'.join(f'{c}{i}' for c in cols_ok) or '0')).number_format = br
        ws.cell(i, ca, l['aliquota_total_pct']).number_format = '0.0000'
        ws.cell(i, cn, f'=ROUND({get_column_letter(cb)}{i}*{get_column_letter(ca)}{i}/100,2)').number_format = br
        ws.cell(i, cg, l['gps_recolhido']).number_format = br
        ws.cell(i, cl, f'=MIN({get_column_letter(cn)}{i},{get_column_letter(cg)}{i})').number_format = br
        ws.cell(i, cp, fmt_comp(l['mes_pagamento']))
        ws.cell(i, cs, l['selic_acumulada_pct']).number_format = '0.00'
        ws.cell(i, cu, f'=ROUND({get_column_letter(cl)}{i}*(1+{get_column_letter(cs)}{i}/100),2)').number_format = br
        if l['indebito_nominal'] > l['gps_recolhido'] + 0.005: ws.cell(i, cl).fill = amarelo
    n = len(res['linhas']) + 1; t_ = n + 1
    ws.cell(t_, 1, 'TOTAL').font = Font(bold=True)
    for j in list(range(2, nt + 3)) + [nt + 4, nt + 5, nt + 6, nt + 9]:
        c = ws.cell(t_, j, f'=SUM({get_column_letter(j)}2:{get_column_letter(j)}{n})'); c.number_format = br; c.font = Font(bold=True); c.fill = cinza

    # Rubricas
    ws = wb.create_sheet('Rubricas classificadas')
    cab(ws, 1, ['Competência', 'Código', 'Descrição na folha', 'Valor', 'Vínculo', 'Tese', 'Critério', 'Situação'], [12, 10, 44, 16, 9, 16, 30, 22])
    for i, x in enumerate(res['classificadas'], 2):
        for j, k in enumerate(['competencia', 'codigo', 'descricao', 'valor', 'vinculo', 'tese', 'motivo', 'situacao'], 1):
            v = fmt_comp(x[k]) if k == 'competencia' else x[k]; c = ws.cell(i, j, v)
            if k == 'valor': c.number_format = br
        if x['situacao'] == 'sem tese': pass
    ws.auto_filter.ref = f'A1:H{len(res["classificadas"]) + 1}'

    # Alertas
    ws = wb.create_sheet('Alertas')
    cab(ws, 1, ['Competência', 'Tipo', 'Descrição'], [12, 12, 100])
    for i, a in enumerate(res['alertas'], 2):
        ws.cell(i, 1, fmt_comp(a['competencia'])); ws.cell(i, 2, a['tipo']); ws.cell(i, 3, a['texto'])

    # Fontes
    ws = wb.create_sheet('Fontes e premissas')
    cab(ws, 1, ['Item', 'Descrição'], [34, 120]); ws.freeze_panes = None
    for i, (k, v) in enumerate(caso['fontes_premissas'], 2):
        ws.cell(i, 1, k).font = Font(bold=True); c = ws.cell(i, 2, v); c.alignment = Alignment(wrap_text=True, vertical='top')
    wb.save(saida)


MODELO_FOLHA = ('competencia;codigo;descricao;valor;vinculo\n'
                '01/2015;101;SALARIO BASE;150000,00;RGPS\n'
                '01/2015;245;AUXILIO DOENCA 15 DIAS (EMPREGADOR);3200,00;RGPS\n'
                '01/2015;310;AVISO PREVIO INDENIZADO;1800,00;RGPS\n'
                '01/2015;520;RATEIO FUNDEB PROFESSORES;25000,00;RGPS\n'
                '01/2015;150;SALARIO MATERNIDADE;4100,00;RGPS\n'
                '01/2015;160;1/3 FERIAS;9000,00;RGPS\n')


def main(argv=None):
    ap = argparse.ArgumentParser(description='Levantamento de contribuições previdenciárias patronais a recuperar')
    ap.add_argument('caso', nargs='?'); ap.add_argument('--saida', default='')
    ap.add_argument('--modelo-folha', default='', help='grava o modelo de folha.csv e sai')
    a = ap.parse_args(argv)
    if a.modelo_folha:
        open(a.modelo_folha, 'w', encoding='utf-8').write(MODELO_FOLHA); print('[ok] modelo:', a.modelo_folha); return 0
    if not a.caso: ap.error('informe o caso.json')
    base = os.path.dirname(os.path.abspath(a.caso)); caso = json.load(open(a.caso, encoding='utf-8'))
    p = lambda k: os.path.join(base, caso['arquivos'][k])
    folha = ler_csv(p('folha')) if os.path.exists(p('folha')) else []
    res = calcular(caso, folha, ler_csv(p('gps')), ler_csv(p('selic'))); rs = resumo(res, caso)
    saida = a.saida or os.path.join(base, caso['arquivos'].get('saida', 'calculo.xlsx'))
    gravar_xlsx(caso, res, rs, saida)
    print(f"[ok] {saida}\n  competências: {rs['competencias']} · rubricas lidas: {len(folha)} · alertas: {rs['alertas']}")
    print(f"  indébito nominal: R$ {rs['total_nominal']:,.2f} · atualizado: R$ {rs['total_atualizado']:,.2f}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
