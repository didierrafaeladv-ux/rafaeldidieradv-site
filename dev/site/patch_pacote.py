# Patch sobre index.html (site): pacote de dados padronizado (RD-SITE v1) para contato, simulações e pedido de material — 03/11/2026
# - Todo envio do site monta o mesmo JSON: {formato:"rd-site", versao:1, tipo, em, pagina, contato, entrada, resultado, consentimento}
# - O visitante escolhe WhatsApp ou e-mail; o e-mail leva o texto legível e o pacote entre marcadores, que a rotina de e-mails lê.
# - Consentimento LGPD explícito (caixa obrigatória) no contato e no pedido de material.
import sys
P = sys.argv[1]
s = open(P, encoding='utf-8').read()
def troca(s, a, b):
    assert s.count(a) == 1, ('âncora não única ou ausente', a[:80], s.count(a))
    return s.replace(a, b)
CONS = '<label style="display:flex;gap:.5rem;align-items:flex-start;font-weight:400"><input type="checkbox" id="%s" required style="width:auto;margin-top:.3rem"> Autorizo o uso destes dados para o escritório responder ao meu pedido (LGPD, art. 7º, V). Posso pedir a exclusão a qualquer momento.</label>'
s = troca(s, '      <p class="note">Ao enviar, você concorda com o tratamento dos dados para retorno do contato (LGPD). Nenhuma informação é compartilhada com terceiros.</p>',
             '      ' + CONS % 'cLgpd' + '\n      <p class="note">Nenhuma informação é vendida ou compartilhada com terceiros. Veja a <a href="#privacidade">política de privacidade</a>.</p>')
s = troca(s, '      <p class="note">O guia é enviado por e-mail. Você pode pedir a exclusão dos dados a qualquer momento.</p>',
             '      ' + CONS % 'mLgpd' + '\n      <p class="note">O guia é enviado por e-mail.</p>')
# política: menciona e-mail e o pacote; termos de uso
s = troca(s, 'A calculadora roda no seu navegador e não envia os valores digitados.',
             'As calculadoras rodam no seu navegador e só enviam os valores se você tocar em “Pedir análise”, pelo WhatsApp ou pelo seu próprio e-mail, e nesse caso o escritório recebe os números digitados e a estimativa. Os dados ficam guardados enquanto durar o atendimento e pelo prazo exigido em lei.')
s = troca(s, '<section id="equipe" class="wrap" style="padding-block:1rem 2.5rem">',
             '<section id="termos" class="wrap" style="padding-block:0 1.5rem">\n  <details><summary>Termos de uso</summary>\n  <p>O conteúdo e as calculadoras deste site são informativos e não substituem a análise do caso concreto por advogado. As estimativas são simplificadas e não representam promessa de resultado. O envio de mensagem pelo site, WhatsApp ou e-mail não cria relação de cliente com o escritório, que só existe com contrato de honorários assinado. Não envie documentos sigilosos pelo formulário: o escritório indica o canal seguro depois do primeiro contato.</p></details>\n</section>\n\n<section id="equipe" class="wrap" style="padding-block:1rem 2.5rem">')
s = troca(s, '<a href="#privacidade">Política de privacidade</a> ·', '<a href="#privacidade">Política de privacidade</a> · <a href="#termos">Termos de uso</a> ·')
JS = r'''
  // ---------- pacote padronizado de envio (RD-SITE v1, 03/11/2026) ----------
  const EMAIL='didierrafaeladv@gmail.com', MARCA_INI='--- RD-SITE v1 (não apague) ---', MARCA_FIM='--- fim RD-SITE ---';
  const PACOTES=[];
  function pacote(tipo,contato,entrada,resultado,consent){ const p={formato:'rd-site',versao:1,tipo,em:new Date().toISOString(),pagina:location.pathname+location.hash,contato:contato||{},entrada:entrada||{},resultado:resultado||{},consentimento:{lgpd:!!consent,base:consent?'art. 7º, V (pedido do titular)':'',em:consent?new Date().toISOString():''}}; PACOTES.push(p); return p }
  const ROT={contato:'Contato pelo site',simulacao_inss:'Simulação de INSS retido',simulacao_regime:'Simples × Presumido',material:'Pedido de material'};
  function linkEmail(p,texto){ const assunto='[Site] '+(ROT[p.tipo]||p.tipo)+(p.contato.nome?' — '+p.contato.nome:'');
    return 'mailto:'+EMAIL+'?subject='+enc(assunto)+'&body='+enc(texto+'\n\n'+MARCA_INI+'\n'+JSON.stringify(p)+'\n'+MARCA_FIM) }
  function botoes(p,texto,rotulo){ return '<div class="cta"><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/'+WA+'?text='+enc(texto)+'">'+(rotulo||'Enviar')+' pelo WhatsApp</a><a class="btn" href="'+linkEmail(p,texto)+'">'+(rotulo||'Enviar')+' por e-mail</a></div>' }
  window.__site={pacotes:()=>PACOTES.slice(),MARCA_INI,MARCA_FIM};
'''
s = troca(s, "  const enc=s=>encodeURIComponent(s);\n", "  const enc=s=>encodeURIComponent(s);\n" + JS)
# showDone recebe o pacote e oferece WhatsApp e e-mail
s = troca(s, "  function showDone(box,texto){\n    const url='https://wa.me/'+WA+'?text='+enc(texto);\n    box.innerHTML='<strong>Mensagem pronta.</strong><p class=\"note\">Toque em \"Enviar pelo WhatsApp\" ou copie o texto e envie por e-mail.</p><code>'+texto.replace(/</g,'&lt;')+'</code><div class=\"cta\"><a class=\"btn primary\" target=\"_blank\" rel=\"noopener\" href=\"'+url+'\">Enviar pelo WhatsApp</a><button type=\"button\" class=\"btn copy\">Copiar texto</button></div>';",
             "  function showDone(box,texto,p){\n    box.innerHTML='<strong>Mensagem pronta.</strong><p class=\"note\">Escolha como enviar: pelo WhatsApp ou pelo seu e-mail.</p><code>'+texto.replace(/</g,'&lt;')+'</code>'+botoes(p,texto)+'<div class=\"cta\"><button type=\"button\" class=\"btn copy\">Copiar texto</button></div>';")
# contato
s = troca(s, "    showDone($('#contactDone'),t);\n    enviaN8N({nome:$('#cNome').value,empresa:$('#cEmp').value,email:$('#cMail').value,fone:$('#cFone').value,assunto:$('#cAss').value,regime:$('#cReg').value,urgencia:$('#cUrg').value,mensagem:$('#cMsg').value})",
             "    const pc=pacote('contato',{nome:$('#cNome').value.trim(),empresa:$('#cEmp').value.trim(),email:$('#cMail').value.trim(),fone:$('#cFone').value.trim()},{assunto:$('#cAss').value,regime:$('#cReg').value,urgencia:$('#cUrg').value,mensagem:$('#cMsg').value.trim()},{},$('#cLgpd').checked);\n    showDone($('#contactDone'),t,pc);\n    enviaN8N(pc)")
# simulações: pacote no botão de análise
s = troca(s, "+'<a class=\"btn primary\" target=\"_blank\" rel=\"noopener\" href=\"https://wa.me/'+WA+'?text='+enc(txt+'\\n\\nGostaria de uma análise.')+'\">Enviar para análise pelo WhatsApp</a>'", "+botoes(pcI,txt+'\\n\\nGostaria de uma análise.','Enviar para análise')")
s = troca(s, "    out.innerHTML=total>0\n", "    const pcI=pacote('simulacao_inss',{},{notasMes:notas,materialPct:mat,meses,inssDevidoMes:semDevido?null:devido},{retidoMes:Math.round(retMes),saldoMes:Math.round(saldoMes),totalPeriodo:Math.round(total),teto:semDevido},false);\n    out.innerHTML=total>0\n")
s = troca(s, "      +'<a class=\"btn primary\" target=\"_blank\" rel=\"noopener\" href=\"https://wa.me/'+WA+'?text='+enc(txt+'\\n\\nGostaria de uma análise do regime.')+'\">Pedir análise pelo WhatsApp</a>';",
             "      +botoes(pacote('simulacao_regime',{},{receitaMes:num('#sRec'),folhaMes:num('#sFol'),issPct:num('#sIss')||5},{melhor:r.melhor,simples:{anexo:S.anexo,total:Math.round(S.total)},presumido:{total:Math.round(P.total)},economiaMes:Math.round(r.economia)},false),txt+'\\n\\nGostaria de uma análise do regime.','Pedir análise');")
# material
s = troca(s, "    showDone($('#matDone'),t);\n    enviaN8N({nome:$('#mNome').value,email:$('#mMail').value,assunto:'Pedido de material: '+material,mensagem:'Perfil: '+$('#mPerfil').value+' · Avisos por e-mail: '+($('#mNews').checked?'sim':'não')});",
             "    const pm=pacote('material',{nome:$('#mNome').value.trim(),email:$('#mMail').value.trim()},{material,perfil:$('#mPerfil').value,avisos:$('#mNews').checked},{},$('#mLgpd').checked);\n    showDone($('#matDone'),t,pm);\n    enviaN8N(pm);")
s = troca(s, "const bad=!i.value.trim()||(i.type==='email'", "const bad=(i.type==='checkbox'?!i.checked:!i.value.trim())||(i.type==='email'")
open(P, 'w', encoding='utf-8').write(s); print('ok', len(s))
