# PlanejaTrib RD: validação dos dados fiscais (03/11/2026)

- `valida_sped.js`: confere o formato dos campos do SPED que o leitor usa (mesmas posições) e a integridade do arquivo (registro 9999). Entra na página do PlanejaTrib pelo `patch_valida.py`; cada SPED lido recebe `validacao` e, se houver problema, um alerta no mês.
- `valida_retencoes.py`: contrato de dados das retenções de INSS/IRRF (SIM/TCE-CE, planilhas) e do C170, para os scripts em Python. Sem dependências.
- Testes: `node dev/planejatrib/test/valida_sped.test.js`, `python3 dev/planejatrib/valida_retencoes.py`. A integração (`test/integracao.test.js`) precisa da página do PlanejaTrib, que não fica neste repositório público.
