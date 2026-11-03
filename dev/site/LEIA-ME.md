# Evolução do site (index.html)

- `patch_pacote.py` (03/11/2026): pacote padronizado RD-SITE v1 em todos os envios do site (contato, simulação de INSS retido, Simples × Presumido, pedido de material); envio por WhatsApp ou por e-mail (o e-mail leva o pacote entre marcadores, lido pela rotina "Entrada de e-mails" e mostrado no painel "E-mails a triar" do Atendimento); consentimento LGPD obrigatório; termos de uso.
- Teste: `node dev/site/test/site.e2e.js index.html`.

Formato do pacote: `{formato:"rd-site", versao:1, tipo:"contato"|"simulacao_inss"|"simulacao_regime"|"material", em, pagina, contato:{nome,empresa,email,fone}, entrada:{...}, resultado:{...}, consentimento:{lgpd, base, em}}`.
