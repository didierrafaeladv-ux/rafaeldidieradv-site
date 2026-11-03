#!/usr/bin/env python3
"""Contexto enxuto do projeto para IA — Rafael Didier Advocacia (v2.0, 03/11/2026).

Em vez de despejar o projeto inteiro (que custa dezenas ou centenas de milhares de tokens a cada uso),
gera só o que a IA precisa, dentro de um orçamento de tokens:

  python3 contexto_enxuto.py                      -> MAPA: árvore + resumo de cada arquivo (funções, tamanho)
  python3 contexto_enxuto.py equipe/js/rotinas.js  -> mapa + conteúdo integral só dos arquivos indicados
  python3 contexto_enxuto.py --mudancas            -> mapa + arquivos alterados no git (o que está sendo revisado)
  opções: --orcamento 30000 (tokens, padrão)  --raiz <pasta>  --saida <arquivo>

Proteções: respeita o .gitignore (usa git quando disponível), ignora binários, minificados, travas e dados grandes,
mascara segredos (chaves de API, tokens, senhas) e nunca lê .env, chaves e credenciais. Sem dependências externas.
"""
import argparse, os, re, subprocess, sys
from pathlib import Path

IGNORAR_PASTAS = {'.git', '.venv', 'venv', '__pycache__', 'node_modules', '.idea', '.vscode', 'dist', 'build', '.next', 'out', '.cache', 'coverage'}
IGNORAR_ARQUIVOS = {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', '.DS_Store'}
NUNCA_LER = re.compile(r'(^|/)(\.env(\..*)?|.*\.(pem|key|p12|pfx|crt)|id_rsa.*|credentials?\.json|secrets?\.(json|ya?ml)|token\.json)$', re.I)
EXTENSOES = {'.py': 'python', '.ts': 'typescript', '.js': 'javascript', '.json': 'json', '.sql': 'sql', '.md': 'markdown',
             '.yml': 'yaml', '.yaml': 'yaml', '.html': 'html', '.css': 'css', '.sh': 'bash'}
SEGREDOS = [
    (re.compile(r'sk-ant-[A-Za-z0-9_\-]{20,}'), '[CHAVE-ANTHROPIC]'), (re.compile(r'sk-[A-Za-z0-9_\-]{20,}'), '[CHAVE-API]'),
    (re.compile(r'gh[pousr]_[A-Za-z0-9]{30,}'), '[TOKEN-GITHUB]'), (re.compile(r'AIza[0-9A-Za-z_\-]{35}'), '[CHAVE-GOOGLE]'),
    (re.compile(r'xox[abpr]-[A-Za-z0-9\-]{10,}'), '[TOKEN-SLACK]'),
    (re.compile(r'(?i)((?:password|senha|secret|token|api[_-]?key)\s*["\']?\s*[:=]\s*["\'])[^"\']{6,}(["\'])'), r'\1[OCULTO]\2')]
MAX_ARQUIVO = 40_000          # caracteres: acima disso, só o resumo (a menos que o arquivo seja pedido)
tok = lambda s: len(s) // 4  # estimativa simples de tokens
fmt = lambda n: f'{n:,}'.replace(',', '.')  # 12.345


def listar(raiz: Path):
    """Arquivos rastreados pelo git (respeita .gitignore); sem git, varre a pasta com os filtros."""
    try:
        out = subprocess.run(['git', '-C', str(raiz), 'ls-files', '-co', '--exclude-standard'], capture_output=True, text=True, timeout=20)
        if out.returncode == 0 and out.stdout.strip():
            return sorted(p for p in (Path(x) for x in out.stdout.splitlines()) if not set(p.parts) & IGNORAR_PASTAS and p.name not in IGNORAR_ARQUIVOS)
    except (OSError, subprocess.SubprocessError):
        pass
    achados = []
    for atual, pastas, arquivos in os.walk(raiz, followlinks=False):
        pastas[:] = sorted(d for d in pastas if d not in IGNORAR_PASTAS)
        for a in sorted(arquivos):
            if a not in IGNORAR_ARQUIVOS: achados.append((Path(atual) / a).relative_to(raiz))
    return achados


def ler(caminho: Path):
    if NUNCA_LER.search(caminho.as_posix()): return None, 'sensível (não lido)'
    try:
        bruto = caminho.read_bytes()
    except OSError as e:
        return None, f'erro ao ler: {e.strerror}'
    if b'\x00' in bruto[:4096]: return None, 'binário'
    texto = bruto.decode('utf-8', errors='replace')
    linhas = texto.count('\n') + 1
    if linhas and len(texto) / linhas > 400 and len(texto) > 5000: return None, 'minificado'
    for padrao, troca in SEGREDOS: texto = padrao.sub(troca, texto)
    return texto, ''


ASSINATURAS = {
    'python': re.compile(r'^\s*(?:async\s+)?(?:def|class)\s+(\w+)', re.M),
    'javascript': re.compile(r'(?:^|\s)(?:async\s+)?function\s+(\w+)|^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?[\w,\s]*\)?\s*=>|^\s*class\s+(\w+)', re.M),
    'html': re.compile(r'function\s+(\w+)\s*\(|<section[^>]*id="([\w-]+)"'),
    'sql': re.compile(r'(?i)create\s+(?:table|view|function)\s+(?:if\s+not\s+exists\s+)?([\w.]+)'),
    'markdown': re.compile(r'^#{1,3}\s+(.+)$', re.M)}
ASSINATURAS['typescript'] = ASSINATURAS['javascript']


def resumo(rel: Path, texto: str, motivo: str):
    if texto is None: return f'- `{rel}` — {motivo}'
    lang = EXTENSOES.get(rel.suffix.lower(), '')
    nomes = []
    if lang in ASSINATURAS:
        for m in ASSINATURAS[lang].finditer(texto):
            n = next((g for g in m.groups() if g), None)
            if n and n not in nomes: nomes.append(n.strip()[:60])
    desc = re.search(r'^\s*(?:"""|/\*\*?|#|//)\s*(.{10,140})', texto)
    extra = f' — {desc.group(1).strip()}' if desc else ''
    lista = (': ' + ', '.join(nomes[:25]) + (f' (+{len(nomes) - 25})' if len(nomes) > 25 else '')) if nomes else ''
    return f'- `{rel}` ({fmt(len(texto))} caracteres, ~{fmt(tok(texto))} tokens){extra}{lista}'


def arvore(arqs):
    linhas, vistos = [], set()
    for a in arqs:
        for i, parte in enumerate(a.parts):
            chave = a.parts[:i + 1]
            if chave in vistos: continue
            vistos.add(chave); linhas.append('  ' * i + parte + ('/' if i < len(a.parts) - 1 else ''))
    return '\n'.join(linhas)


def alterados(raiz: Path):
    try:
        out = subprocess.run(['git', '-C', str(raiz), 'status', '--porcelain'], capture_output=True, text=True, timeout=20).stdout
        return [Path(l[3:].split(' -> ')[-1]) for l in out.splitlines() if l.strip()]
    except (OSError, subprocess.SubprocessError):
        return []


def main(argv=None):
    ap = argparse.ArgumentParser(description='Contexto enxuto do projeto para IA')
    ap.add_argument('arquivos', nargs='*', help='arquivos a incluir por inteiro')
    ap.add_argument('--mudancas', action='store_true', help='incluir por inteiro os arquivos alterados no git')
    ap.add_argument('--orcamento', type=int, default=30_000, help='limite aproximado de tokens do arquivo gerado')
    ap.add_argument('--raiz', default='.'); ap.add_argument('--saida', default='')
    a = ap.parse_args(argv)
    raiz = Path(a.raiz).resolve()
    saida = Path(a.saida) if a.saida else raiz.parent / f'contexto_{raiz.name}.md'   # fora da pasta: nunca se lê de novo
    todos = [p for p in listar(raiz) if p.suffix.lower() in EXTENSOES]
    pedidos = [Path(x) for x in a.arquivos] + (alterados(raiz) if a.mudancas else [])
    pedidos = [p if not p.is_absolute() else p.relative_to(raiz) for p in pedidos]
    partes = [f'# Contexto do projeto `{raiz.name}`\n', '> Gerado por contexto_enxuto.py. Mapa completo; conteúdo integral só dos arquivos pedidos. Segredos mascarados.\n',
              '## Estrutura\n', '```text\n' + arvore(todos) + '\n```\n', '## Mapa dos arquivos\n']
    textos = {}
    for rel in todos:
        t, motivo = ler(raiz / rel); textos[rel] = (t, motivo); partes.append(resumo(rel, t, motivo))
    usado = tok('\n'.join(partes)); incluidos, cortados = [], []
    if pedidos: partes.append('\n## Arquivos pedidos (conteúdo integral)\n')
    for rel in dict.fromkeys(pedidos):
        t, motivo = textos.get(rel) or ler(raiz / rel)
        if t is None: cortados.append(f'{rel} ({motivo or "não encontrado"})'); continue
        bloco = f'### `{rel}`\n```{EXTENSOES.get(rel.suffix.lower(), "")}\n{t}\n```\n'
        if usado + tok(bloco) > a.orcamento: cortados.append(f'{rel} (estouraria o orçamento: ~{fmt(tok(bloco))} tokens)'); continue
        partes.append(bloco); usado += tok(bloco); incluidos.append(str(rel))
    if cortados: partes.append('\n> Não incluídos: ' + '; '.join(cortados) + '. Peça trechos específicos ou aumente --orcamento.\n')
    saida.write_text('\n'.join(partes), encoding='utf-8')
    print(f'[ok] {saida}  ~{fmt(usado)} tokens · {len(todos)} arquivos no mapa · {len(incluidos)} por inteiro')
    for c in cortados: print('  [!] fora:', c)
    return 0


if __name__ == '__main__':
    sys.exit(main())
