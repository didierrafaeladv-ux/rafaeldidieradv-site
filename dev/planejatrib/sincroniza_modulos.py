#!/usr/bin/env python3
"""PlanejaTrib RD — atualiza na página os módulos já embutidos pelos patches (11/11/2026).

Os patch_*.py embutem numero_br.js, valida_sped.js, recupera_folha.js e tema118.js na página do PlanejaTrib, que não fica
neste repositório. Quando um desses módulos muda, este script procura na página a cópia de qualquer versão anterior
(o histórico do git guarda todas) e troca pela versão atual do arquivo. Não mexe em mais nada.
Uso: python3 sincroniza_modulos.py pagina.html   (grava no lugar; mostra o que foi trocado)
"""
import os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
MODULOS = ['numero_br.js', 'valida_sped.js', 'recupera_folha.js', 'tema118.js']


def versoes(arquivo):
    raiz = subprocess.run(['git', '-C', AQUI, 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip()
    rel = os.path.relpath(os.path.join(AQUI, arquivo), raiz)
    commits = subprocess.run(['git', '-C', raiz, 'log', '--format=%H', '--', rel], capture_output=True, text=True, check=True).stdout.split()
    for c in commits:
        r = subprocess.run(['git', '-C', raiz, 'show', f'{c}:{rel}'], capture_output=True, text=True)
        if r.returncode == 0: yield c[:7], r.stdout


def main(p):
    s = open(p, encoding='utf-8').read(); mudou = []
    for m in MODULOS:
        atual = open(os.path.join(AQUI, m), encoding='utf-8').read().strip()
        if atual in s: print(f'  {m}: já está na versão atual'); continue
        for c, antigo in versoes(m):
            antigo = antigo.strip()
            if antigo and s.count(antigo) == 1: s = s.replace(antigo, atual); mudou.append(f'{m} (versão de {c} → atual)'); break
        else: print(f'  {m}: não encontrado na página (o patch que o inclui ainda não foi aplicado?)')
    if mudou: open(p, 'w', encoding='utf-8').write(s)
    print('[ok]', p, '·', '; '.join(mudou) if mudou else 'nada a trocar')


if __name__ == '__main__':
    if len(sys.argv) < 2: raise SystemExit(__doc__)
    main(sys.argv[1])
