# Evolução do Atendimento RD

A página publicada é `equipe/atendimento.html`. As mudanças a partir de 02/11/2026 são aplicadas por scripts de patch sobre esse arquivo
(cada um troca trechos exatos e falha se a âncora não existir), com testes em `test/` (dados fictícios).

- `patch_indicadores.py` — painel "Controles de qualidade" na aba Indicadores (teste: `test/qualidade.e2e.js`).
- `patch_automacoes.py` — aba "Automações" com o motor de regras `equipe/js/automacoes.js` (testes: `test/automacoes.test.js`, `test/automacoes.e2e.js`).
- `test/abas.smoke.js` — abre todas as abas e falha se houver erro de script.

Rodar: `node dev/atendimento/test/automacoes.test.js` e `node dev/atendimento/test/<arquivo>.e2e.js equipe/atendimento.html`.
- `test/modulos.test.js` — carrega todos os módulos de `equipe/js` e testa o básico de cada um.

Os testes rodam sozinhos no GitHub a cada envio (`.github/workflows/testes.yml`, aba Actions do repositório).
