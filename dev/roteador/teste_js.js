const src = require('fs').readFileSync(__dirname + '/roteador_n8n.js', 'utf8'); const m = { exports: {} }; new Function('module', src)(m);
const { avaliar, mascarar } = m.exports, casos = require('./casos.json'); let f = 0;
casos.forEach(c => { const r = avaliar(c.prompt + ' A'.repeat(c.repetirA || 0)); if (r.faixa !== c.esperado) { f++; console.log('FALHA', c.id, r.faixa, r.motivo); } });
const t = mascarar('CPF 123.456.789-09, CNPJ 11.222.333/0001-81, fulana@exemplo.com, (88) 9 9693-6282, processo 3011867-07.2025.8.06.0167');
if (t !== 'CPF [CPF], CNPJ [CNPJ], [E-MAIL], [TELEFONE], processo 3011867-07.2025.8.06.0167') { f++; console.log('FALHA máscara', t); }
console.log((casos.length + 1 - f) + ' de ' + (casos.length + 1) + ' ok (JS)'); process.exit(f ? 1 : 0);
