# Patch: e-mail vindo do formulário do site (pacote RD-SITE v1) abre a demanda com canal "Site" e o WhatsApp do contato — 03/11/2026
import sys
P = sys.argv[1]; s = open(P, encoding='utf-8').read()
def troca(s, a, b):
    assert s.count(a) == 1, ('âncora', a[:80], s.count(a)); return s.replace(a, b)
s = troca(s, 'g("nm-canal").value="E-mail"; g("nm-nome").value=e.deNome||""; g("nm-contato").value=e.deEmail||"";',
  'const sp=e.site||null, sc=(sp&&sp.contato)||{}; g("nm-canal").value=sp?"Site":"E-mail"; g("nm-nome").value=sc.nome||e.deNome||""; g("nm-contato").value=sc.fone||sc.email||e.deEmail||"";')
s = troca(s, "(e.tipo===\"tribunal\"?'<span class=\"pill info\">tribunal</span>':'')", "(e.tipo===\"tribunal\"?'<span class=\"pill info\">tribunal</span>':'')+(e.site?' <span class=\"pill ok\">site · '+esc(e.site.tipo||'')+'</span>':'')")
open(P, 'w', encoding='utf-8').write(s); print('ok', len(s))
