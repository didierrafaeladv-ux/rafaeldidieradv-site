"""Testes do robô com dados fictícios. Rode: python3 test/test_robo.py"""
import json, os, sys, tempfile, unittest
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(AQUI))
import robo_previdenciario as R

CASO = json.load(open(os.path.join(os.path.dirname(AQUI), 'caso_modelo_aprece.json'), encoding='utf-8'))


class Testes(unittest.TestCase):
    def test_leitura_de_valores(self):
        casos = json.load(open(os.path.join(AQUI, '..', '..', 'planejatrib', 'test', 'casos_numero_br.json'), encoding='utf-8'))
        for entrada, esperado in casos:
            with self.subTest(entrada=entrada): self.assertEqual(R.num(entrada), esperado)
        self.assertEqual(R.num('1000.50'), 1000.5); self.assertEqual(R.num('1.000,50'), 1000.5); self.assertEqual(R.num('0.125'), 0.125)

    def test_classificacao(self):
        c = lambda d: R.classificar(d, '', CASO)[0]
        self.assertEqual(c('AUXILIO DOENCA 15 DIAS'), 'quinze_dias')
        self.assertEqual(c('Aviso Prévio Indenizado'), 'aviso_previo')
        self.assertIsNone(c('AVISO PREVIO TRABALHADO'))
        self.assertEqual(c('RATEIO FUNDEB 60%'), 'fundeb')
        self.assertEqual(c('SALÁRIO-MATERNIDADE'), 'sal_mat')
        self.assertEqual(c('1/3 DE FÉRIAS'), 'terco_ferias')
        self.assertIsNone(c('SALARIO BASE'))
        self.assertIsNone(c('GRATIFICACAO FUNCAO'))

    def test_datas_e_selic(self):
        self.assertEqual(R.mes_pagamento('2015-01'), (2015, 2)); self.assertEqual(R.mes_pagamento('2015-12'), (2016, 1))
        self.assertEqual(R.mes_pagamento('2015-13'), (2015, 12))
        selic = {'2015-03': 1.0, '2015-04': 2.0}
        f, faltam = R.selic_acumulada('2015-01', (2015, 5), selic)   # pago 02/2015 → soma 03 e 04 + 1%
        self.assertEqual(f, 4.0); self.assertEqual(faltam, [])
        self.assertEqual(R.comp('13/2010'), '2010-13'); self.assertEqual(R.num('1.234,56'), 1234.56); self.assertEqual(R.num('1234.56'), 1234.56)

    def test_calculo_teto_rpps_e_status(self):
        caso = dict(CASO, competencia_inicial='01/2015', competencia_final='03/2015', mes_compensacao='2015-06', rat_pct=2, fap={'padrao': 1.0})
        folha = [
            {'competencia': '01/2015', 'codigo': '', 'descricao': 'AVISO PREVIO INDENIZADO', 'valor': '1.000,00'},
            {'competencia': '01/2015', 'codigo': '', 'descricao': 'RATEIO FUNDEB', 'valor': '9.000,00', 'vinculo': 'RPPS'},
            {'competencia': '01/2015', 'codigo': '', 'descricao': 'SALARIO MATERNIDADE', 'valor': '5.000,00'},
            {'competencia': '01/2015', 'codigo': '', 'descricao': '1/3 FERIAS', 'valor': '3.000,00'},
            {'competencia': '02/2015', 'codigo': '', 'descricao': 'AUX DOENCA 15 DIAS', 'valor': '100.000,00'},
        ]
        gps = [{'competencia': '01/2015', 'valor_recolhido': '50.000,00'}, {'competencia': '02/2015', 'valor_recolhido': '10.000,00'},
               {'competencia': '03/2015', 'valor_recolhido': '8.000,00'}]
        selic = [{'mes': '2015-03', 'selic_pct': '1,00'}, {'mes': '2015-04', 'selic_pct': '1,00'}, {'mes': '2015-05', 'selic_pct': '1,00'}]
        res = R.calcular(caso, folha, gps, selic); L = {l['competencia']: l for l in res['linhas']}
        # 01/2015: só o aviso prévio entra (RPPS fora, salário-maternidade pendente, terço excluído) → 1.000 × 22%
        self.assertEqual(L['2015-01']['indebito_nominal'], 220.0)
        self.assertEqual(L['2015-01']['por_tese']['sal_mat'], 5000.0)
        self.assertEqual(L['2015-01']['selic_acumulada_pct'], 4.0)          # pago 02 → 03+04+05 + 1%
        self.assertEqual(L['2015-01']['indebito_atualizado'], 228.8)
        # 02/2015: 22.000 calculado > 10.000 recolhido → limitado
        self.assertEqual(L['2015-02']['indebito_limitado'], 10000.0)
        tipos = {(a['competencia'], a['tipo']) for a in res['alertas']}
        self.assertIn(('2015-02', 'teto'), tipos); self.assertIn(('2015-03', 'sem folha'), tipos)

    def test_planilha(self):
        caso = dict(CASO, competencia_inicial='01/2015', competencia_final='01/2015', mes_compensacao='2015-04')
        res = R.calcular(caso, [{'competencia': '01/2015', 'descricao': 'AVISO PREVIO INDENIZADO', 'valor': '100,00'}],
                         [{'competencia': '01/2015', 'valor_recolhido': '1.000,00'}], [{'mes': '2015-03', 'selic_pct': '1'}])
        out = os.path.join(tempfile.mkdtemp(), 't.xlsx'); R.gravar_xlsx(caso, res, R.resumo(res, caso), out)
        from openpyxl import load_workbook
        wb = load_workbook(out); self.assertEqual(wb.sheetnames, ['Resumo', 'Memória de cálculo', 'Rubricas classificadas', 'Alertas', 'Fontes e premissas'])


if __name__ == '__main__':
    unittest.main(verbosity=1)
