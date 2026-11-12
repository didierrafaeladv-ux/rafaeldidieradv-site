// Casos do leitor numBR. A mesma lista (casos_numero_br.json) testa as cópias em financeiro.js, recupera_folha.js e robo_previdenciario.py.
const assert = require('assert'); const { numBR } = require('../numero_br.js'); const casos = require('./casos_numero_br.json');
let ok = 0; for (const [e, s] of casos) { assert.strictEqual(numBR(e), s, `${e} → ${numBR(e)} (esperado ${s})`); ok++; }
console.log(`numero_br: ${ok} casos ok`);
