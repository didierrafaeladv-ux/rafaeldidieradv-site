# PlanejaTrib RD: validação dos dados fiscais (03/11/2026)

- `valida_sped.js`: confere o formato dos campos do SPED que o leitor usa (mesmas posições) e a integridade do arquivo (registro 9999). Entra na página do PlanejaTrib pelo `patch_valida.py`; cada SPED lido recebe `validacao` e, se houver problema, um alerta no mês.
- `valida_retencoes.py`: contrato de dados das retenções de INSS/IRRF (SIM/TCE-CE, planilhas) e do C170, para os scripts em Python. Sem dependências.
- Testes: `node dev/planejatrib/test/valida_sped.test.js`, `python3 dev/planejatrib/valida_retencoes.py`. A integração (`test/integracao.test.js`) precisa da página do PlanejaTrib, que não fica neste repositório público.

## 04/11/2026 (versão 40 da página)
- `numero_br.js` + `patch_numeros.py`: um único leitor de números (`numBR`) no lugar dos quatro antigos, que apagavam todos os pontos ("1000.50" virava 100050). Ponto decimal no SPED deixou de bloquear a leitura; continua como alerta de atenção.
- `recupera_folha.js` + `patch_folha.py`: painel "Contribuição previdenciária sobre verbas da folha" na aba Recuperação (folha por rubrica em CSV, extrato de GPS do e-CAC, Selic desde 11/2005, perfis empresa e título judicial, status por verba definido pelo advogado). No cliente ficam só as bases agregadas.
- Ordem de aplicação: `patch_valida.py` (já na página) → `patch_numeros.py` → `patch_folha.py`.
- Testes: `node test/numero_br.test.js`, `node test/recupera_folha.test.js`, `node test/valida_sped.test.js`, `node test/integracao.test.js <página>`.

## 05/11/2026 (versão 41 da página)
- `valida_sped.js` v1.2: ignora a assinatura digital gravada depois do registro 9999 (arquivos assinados no PVA eram marcados como "leitura não confiável").
- `patch_nfse_iss.py`: o leitor de NFS-e (ABRASF e padrão nacional) passa a ler ISS, ISS retido, alíquota e competência.
- `tema118.js` + `patch_t118.py`: painel "ISS fora da base do PIS/Cofins (Tema 118/STF)" na aba Recuperação, com prescrição, Selic, teto pela EFD-Contribuições e cenário de modulação na data do julgamento (21/10/2026).
- Ordem: `patch_numeros.py` → `patch_folha.py` → `patch_nfse_iss.py` → `patch_t118.py`. Teste: `node test/tema118.test.js`.

## 11/11/2026
- `recupera_folha.js` v1.1: o leitor reserva (usado só se o `numero_br.js` não estiver na página) segue a mesma regra do `numBR`; antes, "1000.50" virava 100050.
- `test/casos_numero_br.json`: a mesma lista de casos testa o `numBR`, o `financeiro.js` do Atendimento, o `recupera_folha.js` e o `num()` do robô em Python.
- `sincroniza_modulos.py pagina.html`: troca na página do PlanejaTrib as cópias antigas dos módulos (numero_br, valida_sped, recupera_folha, tema118) pela versão atual. Rodar na página depois desta atualização.
