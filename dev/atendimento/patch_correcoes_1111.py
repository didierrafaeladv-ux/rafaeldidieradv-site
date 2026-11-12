# Patch sobre equipe/atendimento.html — correções de 11/11/2026:
#  1. sincroniza as cópias embutidas de equipe/js (financeiro.js com a leitura de valores do numBR; prazo_processual.js,
#     publicacao.js e materia.js com o feriado de Sobral só na comarca de Sobral e o calendário do TJCE por ano);
#  2. horas úteis: feriado municipal só do município configurado (padrão: Sobral, sede do expediente);
#  3. protocolo com o ano atual no lugar de "RD-2026-";
#  4. calculadora de prazos: campo "Comarca" (Sobral ou outra), preenchido pelo número do processo;
#  5. aba Documentos: sem a leitura simulada; "Ler documentos" usa o mesmo leitor da conversa (PDF com texto, foto, .txt ou texto colado).
# Uso: python3 dev/atendimento/patch_correcoes_1111.py equipe/atendimento.html <commit com as versões antigas dos módulos>
# Cada troca exige o trecho exato uma única vez; se algum não existir, nada é gravado.
import os, subprocess, sys

P, BASE = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'HEAD')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(P)))
s = open(P, encoding='utf-8').read()


def troca(velho, novo, nome):
    global s
    n = s.count(velho)
    if n != 1: raise SystemExit(f'[falha] {nome}: trecho encontrado {n} vez(es)')
    s = s.replace(velho, novo)


# 1. módulos embutidos: a versão antiga (do commit BASE) é trocada pela atual do arquivo
for mod in ('financeiro.js', 'prazo_processual.js', 'publicacao.js', 'materia.js'):
    antigo = subprocess.run(['git', '-C', RAIZ, 'show', f'{BASE}:equipe/js/{mod}'], capture_output=True, text=True, check=True).stdout.strip()
    atual = open(os.path.join(RAIZ, 'equipe', 'js', mod), encoding='utf-8').read().strip()
    if antigo != atual: troca(antigo, atual, mod)

# 2. horas úteis: o feriado de 5/7 (Sobral) só para o município configurado
troca("""/* Atendimento RD — prazos em horas úteis (v1.0, 30/10/2026).
 * Expediente: segunda a sexta, das 8h às 17h (horário de Brasília, o do navegador). Não conta feriados nacionais
 * (inclusive Carnaval, Sexta-feira Santa e Corpus Christi, calculados pela Páscoa), a Data Magna do Ceará (25/3)
 * e o aniversário de Sobral (5/7). Navegador (window.Prazo) e node. */""",
"""/* Atendimento RD — prazos em horas úteis (v1.1, 11/11/2026; v1.0, 30/10/2026).
 * Expediente: segunda a sexta, das 8h às 17h (horário de Brasília, o do navegador). Não conta feriados nacionais
 * (inclusive Carnaval, Sexta-feira Santa e Corpus Christi, calculados pela Páscoa, ano a ano), a Data Magna do Ceará (25/3)
 * e o feriado do município do expediente (MUNICIPAIS; padrão: Sobral, 5/7 — Prazo.configurar({ municipio: '' }) tira).
 * Navegador (window.Prazo) e node. */""", 'cabeçalho das horas úteis')
troca("""  const cache = {};
  function feriados(ano) {
    if (cache[ano]) return cache[ano];
    const fixos = [[1, 1], [3, 25], [4, 21], [5, 1], [7, 5], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25]].map(([m, d]) => new Date(ano, m - 1, d));
    const p = pascoa(ano), mais = n => new Date(p.getFullYear(), p.getMonth(), p.getDate() + n);
    return (cache[ano] = new Set([...fixos, mais(-48), mais(-47), mais(-2), mais(60)].map(chave)));
  }""",
"""  const cache = {};
  const MUNICIPAIS = { sobral: [[7, 5]] };   // feriados municipais por município
  let MUNICIPIO = 'sobral';                    // sede do expediente do escritório
  function configurar(o) { if (o && 'municipio' in o) { MUNICIPIO = MUNICIPAIS[o.municipio] ? o.municipio : ''; Object.keys(cache).forEach(k => delete cache[k]); } return { municipio: MUNICIPIO }; }
  function feriados(ano, municipio) {
    const mun = municipio === undefined ? MUNICIPIO : (MUNICIPAIS[municipio] ? municipio : ''), k = ano + '|' + mun;
    if (cache[k]) return cache[k];
    const fixos = [[1, 1], [3, 25], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25], ...(MUNICIPAIS[mun] || [])].map(([m, d]) => new Date(ano, m - 1, d));
    const p = pascoa(ano), mais = n => new Date(p.getFullYear(), p.getMonth(), p.getDate() + n);
    return (cache[k] = new Set([...fixos, mais(-48), mais(-47), mais(-2), mais(60)].map(chave)));
  }""", 'feriados das horas úteis')
troca("  const API = { somar, entre, proximo, feriados, pascoa, diaUtil, ABRE, FECHA, versao: '1.0' };",
      "  const API = { somar, entre, proximo, feriados, pascoa, diaUtil, configurar, MUNICIPAIS, ABRE, FECHA, versao: '1.1' };", 'API das horas úteis')

# 3. protocolo com o ano corrente
troca('const f={proto:"RD-2026-"+String(st.seq).padStart(4,"0")', 'const f={proto:"RD-"+new Date().getFullYear()+"-"+String(st.seq).padStart(4,"0")', 'protocolo')

# 4. calculadora de prazos: comarca
troca('e os feriados nacionais, do Ceará e de Sobral.', 'e os feriados nacionais e do Ceará; o municipal de Sobral (5/7) só entra quando a comarca é Sobral.', 'texto da calculadora')
troca('<div class="fld"><label for="pp-proc">Processo (opcional)</label><input id="pp-proc" placeholder="0000000-00.0000.0.00.0000"></div>',
      '<div class="fld"><label for="pp-comarca">Comarca</label><select id="pp-comarca"><option value="">Outra (sem feriado municipal)</option><option value="sobral">Sobral (feriado de 5/7)</option></select></div>\n'
      '        <div class="fld"><label for="pp-proc">Processo (opcional)</label><input id="pp-proc" placeholder="0000000-00.0000.0.00.0000"></div>', 'campo comarca')
troca('const o={dias:+$("pp-dias").value,dobro:$("pp-dobro").checked,feriadosExtras:extras,tribunal:$("pp-trib").value}; o[$("pp-tipo").value]=$("pp-data").value;',
      'const o={dias:+$("pp-dias").value,dobro:$("pp-dobro").checked,feriadosExtras:extras,tribunal:$("pp-trib").value,comarca:$("pp-comarca").value}; o[$("pp-tipo").value]=$("pp-data").value;', 'comarca no cálculo')
troca("""  function toastPP(t){ const b=$("pp-copia"); if(b) b.textContent=t }""",
"""  function toastPP(t){ const b=$("pp-copia"); if(b) b.textContent=t }
  $("pp-proc").addEventListener("change",()=>{ const cnj=$("pp-proc").value; if(Leitura.cnjValido(cnj)) $("pp-comarca").value=PrazoProcessual.comarcaDoCNJ(cnj) });   // TJCE 0167 e JF 8103 = Sobral""", 'comarca pelo processo')
troca("""'</pre><div>Calendário: '+esc(r.tribunal)+'. '+esc(r.aviso)+'</div>""", """'</pre><div>Calendário: '+esc(r.tribunal)+'. Comarca: '+esc(r.comarca)+'. '+esc(r.aviso)+'</div>""", 'comarca no resultado')

# 5. aba Documentos: leitura real
troca('Leitura simulada: em produção, a extração é feita por IA no n8n e os dados de CNPJ vêm de consulta pública pelo número.',
      'A leitura usa o mesmo leitor da conversa (PDF com texto, foto quando o reconhecimento de texto está disponível, .txt ou texto colado) e cada campo é conferido pela equipe; os dados de CNPJ vêm de consulta pública pelo número.', 'subtítulo')
troca("""        <div class="cases" role="group" aria-label="Escolha o caso">
          <button type="button" class="case" data-case="pj" aria-pressed="true"><b>Comercial Serra Alta Ltda</b><span class="hint">Pessoa jurídica · protocolo RD-2026-0412</span><span class="files"><span class="pill line">cartao_cnpj.pdf</span><span class="pill line">contrato_social.pdf</span><span class="pill line">cnh_socio.jpg</span></span></button>
          <button type="button" class="case" data-case="pf" aria-pressed="false"><b>Fernanda Lopes</b><span class="hint">Pessoa física · protocolo RD-2026-0411</span><span class="files"><span class="pill line">rg_frente.jpg</span><span class="pill line">rg_verso.jpg</span><span class="pill line">conta_luz.pdf</span></span></button>
        </div>""",
"""        <div class="cases" role="group" aria-label="Tipo de cliente">
          <button type="button" class="case" data-case="pj" aria-pressed="true"><b>Pessoa jurídica</b><span class="hint">Cartão CNPJ, contrato social e documento do representante</span></button>
          <button type="button" class="case" data-case="pf" aria-pressed="false"><b>Pessoa física</b><span class="hint">RG ou CNH e comprovante de endereço</span></button>
        </div>
        <div class="hint" id="dc-cliente" style="margin-top:6px"></div>
        <div style="display:grid;gap:8px;margin-top:10px">
          <label class="btn ghost small" style="cursor:pointer;justify-self:start">Escolher arquivos (PDF, foto ou .txt)<input type="file" id="dc-arq" accept=".pdf,image/*,.txt" multiple hidden></label>
          <span class="hint" id="dc-arqs"></span>
          <textarea id="dc-tx" rows="3" aria-label="Texto dos documentos" placeholder="…ou cole aqui o texto dos documentos"></textarea>
        </div>""", 'escolha do caso')
troca("""        <button class="btn" type="button" id="ler">Ler documentos</button>
        <div class="scan" aria-hidden="true"><span id="scanbar"></span></div>""",
"""        <button class="btn" type="button" id="ler">Ler documentos</button>
        <div class="hint" id="dc-msg" role="status"></div>""", 'botão ler')
troca('<div class="hint" style="margin-top:4px;color:var(--crit)">A leitura encontrou a cláusula de administração, mas não determinou se a assinatura é isolada ou conjunta.</div>',
      '<div class="hint" id="dc-adm" style="margin-top:4px;color:var(--crit)">Confira na cláusula de administração do contrato social se a assinatura é isolada ou conjunta.</div>', 'aviso de poderes')
troca("""    if(c.nome==="Fernanda Lopes"||c.nome==="Comercial Serra Alta Ltda"){ escolherCaso(c.nome==="Fernanda Lopes"?"pf":"pj"); mostrar("docs"); return }
""", "", 'atalho dos exemplos')
troca("""      const b0=document.querySelector('.case[data-case="pj"] b'); if(b0) b0.textContent=c.nome; }
    escolherCaso(dg.length===11?"pf":"pj"); mostrar("docs");""",
"""    }
    escolherCaso(dg.length===11?"pf":"pj"); dcCliente(c.nome); mostrar("docs");""", 'nome do cliente nos documentos')

i = s.index('// documentos\nconst CASOS={'); j = s.index('const PODERES=', i)
s = s[:i] + """// documentos: leitura real dos arquivos (11/11/2026; antes, campos de exemplo fixos e barra de leitura simulada)
const CAMPOS_DOC={
  PJ:[["RAZAO","Razão social"],["CNPJ","CNPJ"],["ENDERECO","Endereço da sede"],["REP_NOME","Representante"],["REP_CARGO","Cargo"],["REP_CPF","CPF do representante"]],
  PF:[["NOME","Nome completo"],["NACIONALIDADE","Nacionalidade"],["ESTADO_CIVIL","Estado civil"],["PROFISSAO","Profissão"],["RG","RG e órgão emissor"],["CPF","CPF"],["ENDERECO","Endereço"]]};
function casoVazio(tipo,nome){ return {tipo,nome:nome||"",campos:CAMPOS_DOC[tipo].map(([k,l])=>[k,l,"","baixa","não lido: leia os documentos ou preencha"])} }
const CASOS={pj:casoVazio("PJ"),pf:casoVazio("PF")};
// campo lido pelo Leitura.extrair → campo do documento (na PJ, nome e CPF de RG/CNH são do representante: confiança no máximo média)
const DE_PARA={PJ:{RAZAO:["RAZAO_SOCIAL"],CNPJ:["CNPJ"],ENDERECO:["ENDERECO"],REP_NOME:["NOME"],REP_CPF:["CPF"]},PF:{NOME:["NOME"],RG:["RG"],CPF:["CPF"],ENDERECO:["ENDERECO"]}};
function dcCliente(nome){ const el=document.getElementById("dc-cliente"); if(el) el.textContent=nome?"Cliente: "+nome:"" }
function camposDosDocumentos(tipo,lidos){ const novo=casoVazio(tipo,CASOS[tipo==="PJ"?"pj":"pf"].nome); let adm="";
  novo.campos=novo.campos.map(([k,l,v,conf])=>{ for(const {nome,r} of lidos) for(const ch of (DE_PARA[tipo][k]||[])){ const x=r.campos.find(c=>c.chave===ch&&c.valor); if(!x) continue;
      let val=x.valor; if(k==="ENDERECO"){ const cep=r.campos.find(c=>c.chave==="CEP"&&c.valor); if(cep&&!val.includes(cep.valor)) val+=", CEP "+cep.valor }
      const cf=/^REP_/.test(k)&&x.conf==="alta"?"media":x.conf;
      return [k,l,val,cf,r.tipo.nome+" ("+nome+")"+(x.obs?" · "+x.obs:"")+(/^REP_/.test(k)?" · conferir se é do representante":"")] }
    return [k,l,v,conf,lidos.length?"não encontrado nos documentos lidos":"não lido: leia os documentos ou preencha"] });
  lidos.forEach(({r})=>{ const a=r.campos.find(c=>c.chave==="ADMINISTRACAO"&&c.valor); if(a&&!adm) adm=a.valor });
  return {novo,adm} }
""" + s[j:]

troca('function escolherCaso(k){caso=k;lido=false;document.querySelectorAll(".case").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.case===k)));document.getElementById("extracao").hidden=true;document.getElementById("scanbar").style.width="0";limparPrevia()}',
      'function escolherCaso(k){caso=k;lido=false;document.querySelectorAll(".case").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.case===k)));document.getElementById("extracao").hidden=true;limparPrevia()}', 'escolha do tipo')
troca("""document.getElementById("ler").addEventListener("click",()=>{
  const bar=document.getElementById("scanbar"); bar.style.width="0"; void bar.offsetWidth; bar.style.width="100%";
  setTimeout(()=>{lido=true;renderExt();document.getElementById("extracao").hidden=false},650);
});""",
"""document.getElementById("dc-arq").addEventListener("change",e=>{ document.getElementById("dc-arqs").textContent=[...e.target.files].map(f=>f.name).join(" · ") });
document.getElementById("ler").addEventListener("click",async()=>{ const msg=document.getElementById("dc-msg"), btn=document.getElementById("ler"), arqs=[...document.getElementById("dc-arq").files], tx=document.getElementById("dc-tx").value;
  if(!arqs.length&&!tx.trim()){ msg.textContent="Escolha os arquivos ou cole o texto dos documentos. Para preencher à mão, use a tabela abaixo."; lido=true; renderExt(); document.getElementById("extracao").hidden=false; return }
  const lidos=[], falhas=[]; btn.disabled=true;
  try{ for(const f of arqs){ msg.textContent="Lendo "+f.name+"…"; try{ lidos.push({nome:f.name,r:Leitura.extrair(await extrairTexto(f,m=>{msg.textContent=m}))}) }catch(err){ falhas.push(f.name+": "+err.message) } }
    if(tx.trim()) lidos.push({nome:"texto colado",r:Leitura.extrair(tx)}); }
  finally{ btn.disabled=false }
  const tipo=caso==="pf"?"PF":"PJ", res=camposDosDocumentos(tipo,lidos); CASOS[caso]=res.novo;
  document.getElementById("dc-adm").textContent=res.adm?"Trecho lido da cláusula de administração: “"+res.adm.slice(0,300)+"…”. Confira se a assinatura é isolada ou conjunta.":"Confira na cláusula de administração do contrato social se a assinatura é isolada ou conjunta.";
  lido=true; renderExt(); document.getElementById("extracao").hidden=false;
  const achados=res.novo.campos.filter(c=>c[2]).length, alertas=[].concat(...lidos.map(x=>x.r.alertas));
  msg.textContent=(lidos.length?lidos.length+" documento(s) lido(s): "+lidos.map(x=>x.r.tipo.nome+" ("+x.nome+")").join("; ")+". ":"")+achados+" de "+res.novo.campos.length+" campo(s) preenchido(s) pela leitura; confira cada um."+(falhas.length?" Não lidos: "+falhas.join("; ")+".":"")+(alertas.length?" "+alertas.join(" "):"");
  const cn=res.novo.campos.find(c=>c[0]==="CNPJ"&&c[2]); if(cn){ const n=document.getElementById("cn-num"); n.value=cn[2]; n.dispatchEvent(new Event("input")) }
});""", 'leitura dos documentos')
troca("""  const b=document.querySelector('.case[data-case="pj"] b'); if(b)b.textContent=n.razao;""", """  dcCliente(n.razao);""", 'nome pelo CNPJ')

# leitor de arquivo compartilhado entre a conversa e a aba Documentos
troca("""async function textoDaImagem(file){ const T=await carregaScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js","Tesseract");
  docMsg("Lendo a imagem (pode levar até 1 minuto)…"); const r=await T.recognize(file,"por"); return r.data.text }""",
"""async function textoDaImagem(file,aviso){ const T=await carregaScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js","Tesseract");
  (aviso||docMsg)("Lendo a imagem (pode levar até 1 minuto)…"); const r=await T.recognize(file,"por"); return r.data.text }
// texto de um arquivo (PDF com texto, foto por reconhecimento de texto, .txt): usado pela conversa e pela aba Documentos
async function extrairTexto(f,aviso){
  if(/\\.pdf$/i.test(f.name)||f.type==="application/pdf"){ const tx=await textoDoPDF(await f.arrayBuffer()); if(tx.replace(/\\s/g,"").length<30) throw new Error("o PDF parece ser uma digitalização (imagem), sem texto. Copie o texto da imagem e cole no campo de texto"); return tx }
  if(/^image\\//.test(f.type)){ try{ return await textoDaImagem(f,aviso) }catch(err){ throw new Error("a leitura de foto não está disponível aqui. Copie o texto da foto no celular e cole no campo de texto") } }
  return await f.text() }""", 'leitor compartilhado')
troca("""  try{ let tx="";
    if(/\\.pdf$/i.test(f.name)||f.type==="application/pdf"){ tx=await textoDoPDF(await f.arrayBuffer()); if(tx.replace(/\\s/g,"").length<30) throw new Error("o PDF parece ser uma digitalização (imagem), sem texto. Copie o texto da imagem e cole abaixo") }
    else if(/^image\\//.test(f.type)){ try{ tx=await textoDaImagem(f) }catch(err){ throw new Error("a leitura de foto não está disponível aqui. Copie o texto da foto no celular e cole abaixo") } }
    else tx=await f.text();
    document.getElementById("doc-tx").value=tx; lerDocumento() }""",
"""  try{ const tx=await extrairTexto(f,docMsg);
    document.getElementById("doc-tx").value=tx; lerDocumento() }""", 'conversa usa o leitor compartilhado')

open(P, 'w', encoding='utf-8').write(s)
print('ok', len(s))
