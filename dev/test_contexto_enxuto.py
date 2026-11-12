#!/usr/bin/env python3
"""Teste do limite MAX_ARQUIVO do contexto_enxuto.py (11/11/2026). Uso: python3 dev/test_contexto_enxuto.py"""
import os, subprocess, sys, tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contexto_enxuto as ce

with tempfile.TemporaryDirectory() as d:
    raiz = Path(d) / 'proj'; raiz.mkdir()
    g = lambda *a: subprocess.run(['git', '-C', str(raiz), *a], check=True, capture_output=True)
    g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't')
    grande = raiz / 'grande.js'; pequeno = raiz / 'pequeno.js'
    grande.write_text(''.join(f'function f{i}() {{ return {i}; }}\n' for i in range(3000)), encoding='utf-8')
    pequeno.write_text('function a() { return 1; }\n', encoding='utf-8')
    g('add', '.'); g('commit', '-qm', 'base')
    grande.write_text(grande.read_text(encoding='utf-8').replace('return 1500;', 'return 1501; // MUDOU'), encoding='utf-8')
    pequeno.write_text('function a() { return 2; }\n', encoding='utf-8')
    novo = raiz / 'novo_grande.js'; novo.write_text('x'.join('function n() {}\n' for _ in range(4000)), encoding='utf-8')
    saida = Path(d) / 'ctx.md'

    ce.main(['--raiz', str(raiz), '--saida', str(saida), '--mudancas', '--max-arquivo', '20000'])
    t = saida.read_text(encoding='utf-8')
    assert '### `grande.js` (só o diff' in t and 'MUDOU' in t and 'function f2999' not in t, 'arquivo grande alterado deveria entrar só pelo diff'
    assert '### `pequeno.js`\n' in t, 'arquivo pequeno alterado entra inteiro'
    assert 'novo_grande.js (acima de 20.000 caracteres e sem diff' in t, 'arquivo novo grande fica só no mapa'
    print('ok   --mudancas: grande entra pelo diff, pequeno inteiro, novo grande só no mapa')

    ce.main(['--raiz', str(raiz), '--saida', str(saida), 'grande.js', '--max-arquivo', '20000', '--orcamento', '100000'])
    t = saida.read_text(encoding='utf-8')
    assert '### `grande.js`\n' in t and 'function f2999' in t, 'arquivo pedido pelo nome entra inteiro'
    print('ok   pedido pelo nome: entra inteiro, mesmo acima do limite')
print('\n2 ok')
