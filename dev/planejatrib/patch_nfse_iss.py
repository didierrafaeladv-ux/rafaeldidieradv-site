#!/usr/bin/env python3
"""PlanejaTrib RD — o leitor de NFS-e passa a ler o ISS (valor, retido, alíquota e competência), base da tese do Tema 118/STF (05/11/2026)."""
import sys
def troca(s, a, b):
    n = s.count(a)
    if n != 1: sys.exit(f'[erro] trecho encontrado {n} vezes: {a[:90]}')
    return s.replace(a, b)
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
if 'issRetido:' in s: sys.exit('[ok] já aplicado')
s = troca(s, "crt: '' } , inss: num(tag(x, 'vRetCP')), numero: tag(x, 'nNFSe'), tomador: tag(tag(x, 'toma'), 'CNPJ') };",
  "crt: '' } , inss: num(tag(x, 'vRetCP')), numero: tag(x, 'nNFSe'), tomador: tag(tag(x, 'toma'), 'CNPJ'),\n"
  "          iss: num(tag(x, 'vISSQN')), issRetido: tag(x, 'tpRetISSQN') === '2' ? num(tag(x, 'vISSQN')) : 0, aliqIss: num(tag(x, 'pAliq')), competencia: mesDe(tag(x, 'dCompet')) };")
s = troca(s, "inss: num(tag(tag(serv, 'Valores'), 'ValorInss')), numero: tag(inf, 'Numero'), tomador: tag(tag(inf, 'TomadorServico') || tag(inf, 'Tomador'), 'Cnpj') };",
  "inss: num(tag(tag(serv, 'Valores'), 'ValorInss')), numero: tag(inf, 'Numero'), tomador: tag(tag(inf, 'TomadorServico') || tag(inf, 'Tomador'), 'Cnpj'),\n"
  "          iss: num(tag(tag(serv, 'Valores'), 'ValorIss')), issRetido: num(tag(tag(serv, 'Valores'), 'ValorIssRetido')) || (tag(tag(serv, 'Valores'), 'IssRetido') === '1' ? num(tag(tag(serv, 'Valores'), 'ValorIss')) : 0),\n"
  "          aliqIss: num(tag(tag(serv, 'Valores'), 'Aliquota')), competencia: mesDe(tag(inf, 'Competencia')) };")
open(p, 'w', encoding='utf-8').write(s); print('[ok] ISS no leitor de NFS-e:', p)
