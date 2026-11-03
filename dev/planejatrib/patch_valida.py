# Patch sobre a página do PlanejaTrib RD: validação de formato do SPED antes do cálculo (03/11/2026)
# Cada SPED lido pelo Leitor recebe d.validacao (ValidaSped) e, se houver problema, um alerta na lista de alertas do mês.
import sys, os
P, MOD = sys.argv[1], sys.argv[2]
s = open(P, encoding='utf-8').read(); m = open(MOD, encoding='utf-8').read()
assert s.count('  function lerSped(txt) {\n') == 1 and 'ValidaSped' not in s
s = s.replace('  function lerSped(txt) {\n', '''  function lerSped(txt) {   // validação de formato antes do uso dos valores (ValidaSped, 03/11/2026)
    const d = lerSpedBase(txt);
    try { if (d && d.tipo && d.tipo !== 'desconhecido' && root && root.ValidaSped) { const v = root.ValidaSped.validar(txt, d.tipo); d.validacao = v;
      if (v.gravidade !== 'ok') (d.alertas = d.alertas || []).push({ mes: d.mes || d.ano || '', nivel: v.gravidade === 'bloqueante' ? 'alto' : 'médio', tipo: 'risco',
        texto: (v.gravidade === 'bloqueante' ? 'Leitura não confiável deste arquivo: ' : 'Inconsistência de formato no arquivo: ') + v.resumo,
        conferir: v.gravidade === 'bloqueante' ? 'não use os valores deste mês antes de conferir ou reenviar o arquivo original do PVA' : 'conferir os registros indicados (linha e campo) antes de usar os valores',
        origem: 'Validação de formato do SPED' + (v.problemas[0] ? ' (1º problema: linha ' + v.problemas[0].linha + ', ' + v.problemas[0].reg + ', campo ' + v.problemas[0].campo + ')' : '') }); } } catch (e) {}
    return d;
  }
  function lerSpedBase(txt) {
''')
i = s.find('<script'); s = s[:i] + '<script>\n' + m + '\n</script>\n' + s[i:]
open(P, 'w', encoding='utf-8').write(s); print('ok', len(s))
