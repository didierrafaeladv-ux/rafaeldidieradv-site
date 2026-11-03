"""Contrato de dados das retenções (INSS/IRRF) e dos itens do SPED — Rafael Didier Advocacia (v1.0, 03/11/2026).

Revisão da especificação V3.0 (Pandera). Mesma ideia, sem dependências (roda em qualquer Python 3.8+, sem pip)
e com as correções:
  1. Valida o TEXTO bruto antes de converter: "1.000,50", "1000.50" e "1000,50" são coisas diferentes; converter
     primeiro (coerce=True) esconde exatamente o erro que se quer pegar.
  2. Um esquema por registro: C170 (EFD-Contribuições) e C190 (EFD ICMS) têm campos diferentes; NCM fica no 0200,
     não no C170.
  3. Regras entre campos, que é onde mora o erro caro: VL_PIS = VL_BC_PIS × ALIQ/100; base ≤ valor bruto;
     INSS retido ≤ 11% da base; CNPJ com dígito verificador; nota repetida (contaria em dobro nos 60 meses);
     data dentro da janela de 5 anos.
  4. Devolve a lista de problemas (linha, campo, valor, regra) em vez de parar no primeiro erro.
Uso: from valida_retencoes import validar_retencoes, validar_c170 — ou rode este arquivo para os testes.
"""
import re, unittest
from datetime import date

NUM_SPED = re.compile(r'^-?\d+(,\d+)?$')          # SPED: vírgula decimal, sem separador de milhar
NUM_BR = re.compile(r'^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$')   # planilhas/portais: 1.234,56 ou 1234,56


def num_sped(v):
    v = (v or '').strip()
    if v == '': return 0.0, None
    if not NUM_SPED.match(v): return None, 'número do SPED com vírgula decimal e sem ponto (ex.: 1234,56)'
    return float(v.replace(',', '.')), None


def num_br(v):
    if isinstance(v, (int, float)): return float(v), None
    v = (v or '').strip().replace('R$', '').strip()
    if v == '': return None, 'valor obrigatório'
    if re.match(r'^-?\d+\.\d{1,2}$', v): return None, 'ponto decimal ambíguo (use 1.234,56 ou 1234,56)'
    if not NUM_BR.match(v): return None, 'valor em reais no formato 1.234,56'
    return float(v.replace('.', '').replace(',', '.')), None


def cnpj_valido(c):
    d = re.sub(r'\D', '', c or '')
    if len(d) != 14 or len(set(d)) == 1: return False
    def dv(base, pesos): s = sum(int(x) * p for x, p in zip(base, pesos)) % 11; return '0' if s < 2 else str(11 - s)
    p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    return d[12] == dv(d[:12], p1) and d[13] == dv(d[:13], [6] + p1)


def data_br(v):
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', (v or '').strip()) or re.match(r'^(\d{4})-(\d{2})-(\d{2})', (v or '').strip())
    if not m: return None
    try:
        a, b, c = m.groups(); return date(int(c), int(b), int(a)) if len(a) == 2 else date(int(a), int(b), int(c))
    except ValueError:
        return None


def validar_retencoes(linhas, hoje=None, janela_meses=60):
    """linhas: lista de dicts com CNPJ_EMISSOR, NUMERO_NOTA, DATA_EMISSAO, VALOR_BRUTO, BASE_CALCULO, INSS_RETIDO, IRRF_RETIDO
    (texto como veio do portal/planilha). Devolve {'validas': [...convertidas...], 'problemas': [...], 'gravidade'}."""
    hoje = hoje or date.today(); limite = date(hoje.year - janela_meses // 12, hoje.month, 1)
    validas, problemas, vistas = [], [], {}
    for i, l in enumerate(linhas, 1):
        erros = []
        p = lambda campo, valor, regra: erros.append({'linha': i, 'campo': campo, 'valor': str(valor)[:40], 'regra': regra})
        cnpj = re.sub(r'\D', '', str(l.get('CNPJ_EMISSOR', '')))
        if not cnpj_valido(cnpj): p('CNPJ_EMISSOR', l.get('CNPJ_EMISSOR'), 'CNPJ com 14 dígitos e dígito verificador correto')
        nota = str(l.get('NUMERO_NOTA', '')).strip()
        if not nota: p('NUMERO_NOTA', '', 'número da nota obrigatório (sem ele não há como achar nota repetida)')
        dt = data_br(str(l.get('DATA_EMISSAO', '')))
        if not dt: p('DATA_EMISSAO', l.get('DATA_EMISSAO'), 'data DD/MM/AAAA válida')
        elif dt > hoje: p('DATA_EMISSAO', l.get('DATA_EMISSAO'), 'data no futuro')
        elif dt < limite: p('DATA_EMISSAO', l.get('DATA_EMISSAO'), f'fora da janela de {janela_meses} meses (possível prescrição; conferir antes de somar)')
        v = {}
        for campo in ('VALOR_BRUTO', 'BASE_CALCULO', 'INSS_RETIDO', 'IRRF_RETIDO'):
            x, e = num_br(l.get(campo, ''))
            if e: p(campo, l.get(campo), e)
            elif x < 0: p(campo, l.get(campo), 'valor negativo')
            v[campo] = x
        if all(isinstance(v.get(k), float) for k in v):
            if v['VALOR_BRUTO'] <= 0: p('VALOR_BRUTO', v['VALOR_BRUTO'], 'valor bruto maior que zero')
            if v['BASE_CALCULO'] > v['VALOR_BRUTO'] + 0.01: p('BASE_CALCULO', v['BASE_CALCULO'], 'base não pode passar do valor bruto')
            if v['INSS_RETIDO'] > round(v['BASE_CALCULO'] * 0.11, 2) + 0.01: p('INSS_RETIDO', v['INSS_RETIDO'], 'INSS retido acima de 11% da base (Lei 8.212/1991, art. 31): conferir a base ou a nota')
            if v['IRRF_RETIDO'] > v['VALOR_BRUTO'] * 0.0945 + 0.01: p('IRRF_RETIDO', v['IRRF_RETIDO'], 'IRRF acima do maior percentual usual de retenção (9,45%): conferir')
        chave = (cnpj, nota)
        if nota and cnpj and chave in vistas: p('NUMERO_NOTA', nota, f'nota repetida (mesma da linha {vistas[chave]}): contaria em dobro')
        elif nota and cnpj: vistas[chave] = i
        if erros: problemas.extend(erros)
        else: validas.append({'CNPJ_EMISSOR': cnpj, 'NUMERO_NOTA': nota, 'DATA_EMISSAO': dt, **v})
    grav = 'ok' if not problemas else 'bloqueante' if any(re.search(r'repetida|ponto decimal|dígito|acima de 11%', x['regra']) for x in problemas) else 'atencao'
    return {'validas': validas, 'problemas': problemas, 'gravidade': grav, 'total': len(linhas)}


def validar_c170(campos_brutos, linha=0):
    """C170 da EFD-Contribuições, campos como vêm do split('|') (índice 0 vazio, 1 = 'C170').
    Confere formato e a conta VL_PIS = VL_BC_PIS × ALIQ_PIS / 100 (e o mesmo para a Cofins)."""
    r, erros = campos_brutos, []
    def get(i): return r[i] if len(r) > i else None
    def p(i, nome, regra): erros.append({'linha': linha, 'campo': f'{nome} ({i})', 'valor': str(get(i))[:40], 'regra': regra})
    if get(1) != 'C170': p(1, 'REG', 'registro C170')
    if not re.match(r'^\d+$', get(2) or ''): p(2, 'NUM_ITEM', 'número do item inteiro')
    if not (get(3) or '').strip(): p(3, 'COD_ITEM', 'código do item obrigatório')
    if not re.match(r'^\d{2}$', get(25) or ''): p(25, 'CST_PIS', 'CST de 2 dígitos')
    if not re.match(r'^\d{2}$', get(31) or ''): p(31, 'CST_COFINS', 'CST de 2 dígitos')
    vals = {}
    for i, nome in ((7, 'VL_ITEM'), (26, 'VL_BC_PIS'), (27, 'ALIQ_PIS'), (30, 'VL_PIS'), (32, 'VL_BC_COFINS'), (33, 'ALIQ_COFINS'), (36, 'VL_COFINS')):
        x, e = num_sped(get(i) or '')
        if e: p(i, nome, e)
        vals[nome] = x
    for bc, al, vl, nome in (('VL_BC_PIS', 'ALIQ_PIS', 'VL_PIS', 'PIS'), ('VL_BC_COFINS', 'ALIQ_COFINS', 'VL_COFINS', 'COFINS')):
        if None not in (vals[bc], vals[al], vals[vl]) and vals[al] > 0 and abs(vals[bc] * vals[al] / 100 - vals[vl]) > 0.02:
            p(30 if nome == 'PIS' else 36, 'VL_' + nome, f'VL_{nome} diferente de base × alíquota ({vals[bc] * vals[al] / 100:.2f}): campo deslocado ou valor errado')
    return erros


class Testes(unittest.TestCase):
    HOJE = date(2026, 11, 3)
    BOA = {'CNPJ_EMISSOR': '11.222.333/0001-81', 'NUMERO_NOTA': '1001', 'DATA_EMISSAO': '15/03/2024', 'VALOR_BRUTO': '10.000,00', 'BASE_CALCULO': '10.000,00', 'INSS_RETIDO': '1.100,00', 'IRRF_RETIDO': '150,00'}

    def test_linha_boa(self):
        r = validar_retencoes([self.BOA], self.HOJE); self.assertEqual(r['gravidade'], 'ok'); self.assertEqual(r['validas'][0]['INSS_RETIDO'], 1100.0)

    def test_ponto_decimal_e_cnpj(self):
        r = validar_retencoes([dict(self.BOA, VALOR_BRUTO='10000.50', CNPJ_EMISSOR='11.222.333/0001-82')], self.HOJE)
        self.assertEqual(r['gravidade'], 'bloqueante'); regras = ' '.join(x['regra'] for x in r['problemas'])
        self.assertIn('ponto decimal', regras); self.assertIn('dígito verificador', regras)

    def test_nota_repetida_e_inss_acima(self):
        r = validar_retencoes([self.BOA, dict(self.BOA), dict(self.BOA, NUMERO_NOTA='1002', INSS_RETIDO='1.500,00')], self.HOJE)
        regras = [x['regra'] for x in r['problemas']]
        self.assertTrue(any('repetida' in x for x in regras)); self.assertTrue(any('acima de 11%' in x for x in regras)); self.assertEqual(len(r['validas']), 1)

    def test_janela_60_meses_e_data(self):
        r = validar_retencoes([dict(self.BOA, DATA_EMISSAO='10/10/2021'), dict(self.BOA, NUMERO_NOTA='2', DATA_EMISSAO='31/02/2025')], self.HOJE)
        regras = ' '.join(x['regra'] for x in r['problemas']); self.assertIn('fora da janela de 60 meses', regras); self.assertIn('data DD/MM/AAAA válida', regras)
        self.assertEqual(r['gravidade'], 'atencao')

    def test_c170(self):
        boa = ('|C170|1|P1|PROD|1|UN|500,00|0|0|0|5102|1||0|0|0|0|0|0|0|0|0|0|0|01|500,00|1,65|||8,25|01|500,00|7,60|||38,00||').split('|')
        self.assertEqual(validar_c170(boa), [])
        ruim = list(boa); ruim[30] = '82,50'; ruim[7] = '500.00'
        e = validar_c170(ruim, 7); self.assertTrue(any('VL_PIS' in x['campo'] for x in e)); self.assertTrue(any('VL_ITEM' in x['campo'] for x in e))


if __name__ == '__main__':
    unittest.main(verbosity=1)
