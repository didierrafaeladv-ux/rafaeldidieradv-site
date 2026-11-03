# Robô de recuperação de contribuições previdenciárias patronais

`robo_previdenciario.py` lê quatro entradas e gera um .xlsx com memória de cálculo:

- a folha por rubrica;
- o extrato de GPS do e-CAC;
- a SELIC mensal do Banco Central (série 4390);
- um `caso.json` com as verbas do título, o status de cada uma, o período, o RAT/FAP e o mês da compensação.

Como o cálculo é feito:
- **Classificação:** cada rubrica é ligada a uma verba por palavra-chave ou por código.
- **Teto:** o indébito de cada competência fica limitado ao que foi recolhido em GPS.
- **Atualização:** SELIC acumulada do mês seguinte ao pagamento até o mês anterior à compensação, mais 1% no mês da compensação.

O modelo de caso é `caso_modelo_aprece.json`, do MS coletivo APRECE 0001242-10.2010.4.05.8102. Os dados de clientes não ficam no repositório.

Testes, com dados fictícios: `python3 test/test_robo.py`.
