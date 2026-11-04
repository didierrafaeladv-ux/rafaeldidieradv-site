# PlanejaTrib RD: validação dos dados fiscais (03/11/2026)

- `valida_sped.js`: confere o formato dos campos do SPED que o leitor usa (mesmas posições) e a integridade do arquivo (registro 9999). Entra na página do PlanejaTrib pelo `patch_valida.py`; cada SPED lido recebe `validacao` e, se houver problema, um alerta no mês.
- `valida_retencoes.py`: contrato de dados das retenções de INSS/IRRF (SIM/TCE-CE, planilhas) e do C170, para os scripts em Python. Sem dependências.
- Testes: `node dev/planejatrib/test/valida_sped.test.js`, `python3 dev/planejatrib/valida_retencoes.py`. A integração (`test/integracao.test.js`) precisa da página do PlanejaTrib, que não fica neste repositório público.

## 04/11/2026 (versão 40 da página)
- `numero_br.js` + `patch_numeros.py`: um único leitor de números (`numBR`) no lugar dos quatro antigos, que apagavam todos os pontos ("1000.50" virava 100050). Ponto decimal no SPED deixou de bloquear a leitura; continua como alerta de atenção.
- `recupera_folha.js` + `patch_folha.py`: painel "Contribuição previdenciária sobre verbas da folha" na aba Recuperação (folha por rubrica em CSV, extrato de GPS do e-CAC, Selic desde 11/2005, perfis empresa e título judicial, status por verba definido pelo advogado). No cliente ficam só as bases agregadas.
- Ordem de aplicação: `patch_valida.py` (já na página) → `patch_numeros.py` → `patch_folha.py`.
- Testes: `node test/numero_br.test.js`, `node test/recupera_folha.test.js`, `node test/valida_sped.test.js`, `node test/integracao.test.js <página>`.
