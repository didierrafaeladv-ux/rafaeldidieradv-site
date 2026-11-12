"""Roteador de modelos por complexidade — Rafael Didier Advocacia (v2.0, 03/11/2026).

Mesma regra do nó "Avaliar complexidade" do fluxo n8n (regras.json é a fonte única).
Três faixas: SIMPLES (modelo leve), PADRAO (intermediário), CRITICO (topo, para peça, parecer e prazo).
Sem dependências externas. Rode: python3 roteador.py  (executa os testes)
"""
import json, os, re, time, unicodedata, unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
REGRAS = json.load(open(os.path.join(AQUI, 'regras.json'), encoding='utf-8'))


def normalizar(texto: str) -> str:
    """Minúsculas e sem acento: 'Código' e 'codigo' contam igual."""
    t = unicodedata.normalize('NFD', texto or '')
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()


def _achar(termos, texto):
    """Primeiro termo encontrado como palavra inteira ('tese' não casa com 'síntese' nem 'prótese')."""
    for termo in termos:
        if re.search(r'(?<![a-z0-9])' + re.escape(termo) + r'(?![a-z0-9])', texto):
            return termo
    return None


def avaliar(prompt: str, regras=REGRAS) -> dict:
    inicio = time.perf_counter()
    t = normalizar(prompt)
    simples = _achar(regras['simples'], t)
    producao = _achar(regras['verbosProducao'], t)
    critico = _achar(regras['critico'], t)
    padrao = _achar(regras['padrao'], t)
    n = len(prompt or '')
    lim = regras['limites']
    if critico and (producao or not simples):
        faixa, motivo = 'CRITICO', f'termo crítico "{critico}"' + (f' com pedido de produção "{producao}"' if producao else '')
    elif n > lim['caracteresCritico'] and producao:
        faixa, motivo = 'CRITICO', f'texto longo ({n} caracteres) com pedido de produção "{producao}"'
    elif padrao and not simples:
        faixa, motivo = 'PADRAO', f'termo técnico "{padrao}"'
    elif n > lim['caracteresPadrao'] and not simples:
        faixa, motivo = 'PADRAO', f'texto longo ({n} caracteres)'
    else:
        faixa = 'SIMPLES'
        motivo = f'tarefa simples ("{simples}")' if simples else 'pedido curto, sem termo técnico ou crítico'
    m = regras['modelos'][faixa]
    return {'faixa': faixa, 'modelo': m['modelo'], 'maxTokens': m['maxTokens'], 'motivo': motivo,
            'caracteres': n, 'ms': round((time.perf_counter() - inicio) * 1000, 3)}


_CPF = re.compile(r'\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b')
_CNPJ = re.compile(r'\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b')
_EMAIL = re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.]+\b')
_FONE = re.compile(r'(?<!\d)(?:\(?\d{2}\)?\s?)?9?\s?\d{4}-?\d{4}(?!\d)')
_CNJ = re.compile(r'\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b')


def mascarar(texto: str) -> str:
    """LGPD: troca CPF, CNPJ, e-mail e telefone por marcadores antes de enviar ao modelo. Número de processo (público) é mantido."""
    guardados = {}
    def guarda(m):
        k = f'\x00{len(guardados)}\x00'; guardados[k] = m.group(0); return k
    t = _CNJ.sub(guarda, texto or '')
    t = _CNPJ.sub('[CNPJ]', t); t = _CPF.sub('[CPF]', t); t = _EMAIL.sub('[E-MAIL]', t); t = _FONE.sub('[TELEFONE]', t)
    for k, v in guardados.items(): t = t.replace(k, v)
    return t


CASOS = json.load(open(os.path.join(AQUI, 'casos.json'), encoding='utf-8'))


class TestRoteador(unittest.TestCase):
    def test_casos(self):
        for c in CASOS:
            with self.subTest(c['id']):
                prompt = c['prompt'] + (' A' * c.get('repetirA', 0))
                r = avaliar(prompt)
                self.assertEqual(r['faixa'], c['esperado'], f"{c['id']}: {r['motivo']}")

    def test_modelos(self):
        self.assertEqual(avaliar('Bom dia')['modelo'], 'claude-haiku-5-5')
        self.assertEqual(avaliar('Redija o parecer')['modelo'], 'claude-opus-5-5')

    def test_mascarar(self):
        t = mascarar('CPF 123.456.789-09, CNPJ 11.222.333/0001-81, fulana@exemplo.com, (88) 9 9693-6282, processo 0001234-85.2025.8.06.0167')
        self.assertEqual(t, 'CPF [CPF], CNPJ [CNPJ], [E-MAIL], [TELEFONE], processo 0001234-85.2025.8.06.0167')


if __name__ == '__main__':
    r = unittest.main(exit=False, verbosity=1).result
    print('\nRelatório por caso:')
    for c in CASOS:
        a = avaliar(c['prompt'] + (' A' * c.get('repetirA', 0)))
        print(f"{c['id']:5} {'OK   ' if a['faixa'] == c['esperado'] else 'FALHA'} {a['faixa']:8} {a['modelo']:18} {a['motivo']}")
    raise SystemExit(0 if r.wasSuccessful() else 1)
