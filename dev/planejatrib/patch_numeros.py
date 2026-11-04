#!/usr/bin/env python3
"""PlanejaTrib RD — troca os 4 leitores de número que apagavam todos os pontos pelo numBR (numero_br.js). 04/11/2026.
Uso: python3 patch_numeros.py pagina.html  (grava no lugar; falha se algum trecho não for encontrado exatamente uma vez)"""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))

def troca(s, a, b):
    n = s.count(a)
    if n != 1: sys.exit(f'[erro] trecho encontrado {n} vezes: {a[:80]}')
    return s.replace(a, b)

p = sys.argv[1]; s = open(p, encoding='utf-8').read()
if 'function numBR(' in s: sys.exit('[ok] já aplicado')
mod = open(os.path.join(AQUI, 'numero_br.js'), encoding='utf-8').read()
i = s.find('<script'); s = s[:i] + '<script>\n' + mod + '\n</script>\n' + s[i:]
s = troca(s, "const num = v => { const s = String(v || '').trim(); if (!s) return 0; return /,\\d{1,2}$/.test(s) ? +s.replace(/\\./g, '').replace(',', '.') : +s; };",
          "const num = v => root.numBR(v);   // numBR: 04/11/2026")
s = troca(s, "const nv = v => { const x = parseFloat(String(v || '').replace(/\\./g, '').replace(',', '.')); return isFinite(x) ? x : 0; };",
          "const nv = v => root.numBR(v);   // numBR: ponto decimal deixou de multiplicar o valor (04/11/2026)")
s = troca(s, "const brNum = v => { const x = parseFloat(String(v || '').replace(/\\./g, '').replace(',', '.')); return isFinite(x) ? x : 0; };",
          "const brNum = v => root.numBR(v);   // numBR: 04/11/2026")
s = troca(s, "const valor = +String(c[2]).replace(/[^\\d,.-]/g, '').replace(/\\./g, '').replace(',', '.'); if (!isFinite(valor)) return;",
          "const valor = root.numBR(c[2]); if (!valor && !/\\d/.test(c[2])) return;")
ini = s.find('/* Validação de formato do SPED antes do cálculo'); fim = s.find("})(typeof window !== 'undefined' ? window : globalThis);", ini)
if ini < 0 or fim < 0: sys.exit('[erro] módulo ValidaSped não encontrado na página')
fim += len("})(typeof window !== 'undefined' ? window : globalThis);")
s = s[:ini] + open(os.path.join(AQUI, 'valida_sped.js'), encoding='utf-8').read().rstrip() + s[fim:]
open(p, 'w', encoding='utf-8').write(s); print('[ok] numBR aplicado em', p)
