// Integração: o Leitor do PlanejaTrib (extraído da página) usa a validação. Uso: node integracao.test.js <planejatrib.html>
const assert = require('node:assert/strict'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(process.argv[2], 'utf8'); const i = html.indexOf('/* Leitor de documentos fiscais no navegador'), j = html.indexOf('</script>', i);
require('../valida_sped.js'); new Function(html.slice(i, j))(); const L = globalThis.Leitor; let ok = 0;
const fecha = l => l.concat(['|9999|' + (l.length + 1) + '|']).join('\r\n');
const base = ['|0000|017|0|01102026|31102026|EMPRESA EXEMPLO LTDA|11222333000181||CE|0612345678|2312345|||A|1|', '|C100|1|0|||55|00|1|' + '1'.repeat(44) + '|', '|C190|000|5102|18,00|1000,00|1000,00|180,00|0|0|0|0||', '|E110|0|0|0|0|0|0|0|0|0|0|0|180,00|0|0|'];
let d = L.lerTexto(fecha(base)); assert.equal(d.tipo, 'efd-icms'); assert.equal(d.validacao.gravidade, 'ok'); assert.equal(d.vendas, 1000); assert.ok(!(d.alertas || []).some(a => /Validação de formato/.test(a.origem))); ok++; console.log('ok   arquivo correto: validação ok, sem alerta, valores lidos');
const ruim = base.slice(); ruim[2] = '|C190|000|5102|18,00|1000.50|1000,00|180,00|0|0|0|0||'; d = L.lerTexto(fecha(ruim));
assert.equal(d.vendas, 100050, 'o leitor de fato lê 1000.50 como 100050'); assert.equal(d.validacao.gravidade, 'bloqueante');
const a = d.alertas.find(x => /Validação de formato/.test(x.origem)); assert.equal(a.nivel, 'alto'); assert.match(a.texto, /Leitura não confiável/); assert.match(a.origem, /linha 3, C190, campo 5/); ok++; console.log('ok   ponto decimal: o leitor leria R$ 100.050,00 no lugar de R$ 1.000,50 — agora sai alerta alto com linha e campo');
console.log(ok + ' ok');
