# Evolução do Atendimento RD

A página publicada é `equipe/atendimento.html`. As mudanças a partir de 02/11/2026 são aplicadas por scripts de patch sobre esse arquivo
(cada um troca trechos exatos e falha se a âncora não existir), com testes em `test/` (dados fictícios).

- `patch_indicadores.py` — painel "Controles de qualidade" na aba Indicadores (teste: `test/qualidade.e2e.js`).
- `patch_automacoes.py` — aba "Automações" com o motor de regras `equipe/js/automacoes.js` (testes: `test/automacoes.test.js`, `test/automacoes.e2e.js`).
- `patch_financeiro.py` — aba "Financeiro" com o módulo `equipe/js/financeiro.js` (testes: `test/financeiro.test.js`, `test/financeiro.e2e.js`).
- `patch_email.py` — painel "E-mails a triar" na Fila, alimentado pela rotina Entrada de e-mails (teste: `test/email.e2e.js`).
- `patch_correcoes_1111.py` (11/11/2026) — aba Documentos com leitura real (mesmo leitor da conversa; sem campos de exemplo nem barra simulada);
  feriado de Sobral (5/7) só quando a comarca é Sobral (calculadora com campo Comarca, publicações pela origem do número CNJ) e calendário do TJCE por ano;
  horas úteis com o feriado municipal configurável (padrão: Sobral, sede do expediente); protocolo com o ano atual; cópias embutidas de
  `financeiro.js` (leitura de valores pela regra do numBR), `prazo_processual.js`, `publicacao.js` e `materia.js` atualizadas (teste: `test/documentos.e2e.js`).
- `test/abas.smoke.js` — abre todas as abas e falha se houver erro de script.

Rodar: `node dev/atendimento/test/automacoes.test.js` e `node dev/atendimento/test/<arquivo>.e2e.js equipe/atendimento.html`.
- `test/modulos.test.js` — carrega todos os módulos de `equipe/js` e testa o básico de cada um.

Os testes rodam sozinhos no GitHub a cada envio (`.github/workflows/testes.yml`, aba Actions do repositório).
