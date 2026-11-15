#!/usr/bin/env python3
"""Envia as credenciais OAuth diretamente ao Cloudflare Worker, sem criar arquivos."""
import getpass
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys


def find_node():
    candidates = []
    current = shutil.which('node')
    if current:
        candidates.append(Path(current))
    installed = (Path.home() / '.nvm/versions/node').glob('v*/bin/node')
    def version_key(path):
        return tuple(int(part) for part in path.parents[1].name.lstrip('v').split('.'))
    candidates.extend(sorted(installed, key=version_key, reverse=True))
    for candidate in dict.fromkeys(candidates):
        try:
            result = subprocess.run([str(candidate), '--version'], capture_output=True, text=True, check=True)
            match = re.fullmatch(r'v(\d+)\.(\d+)\.(\d+)', result.stdout.strip())
            if match and tuple(map(int, match.groups())) >= (22, 12, 0):
                return str(candidate), result.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            continue
    raise SystemExit('Node.js 22.12.0 ou superior não encontrado. Instale ou ative o Node 24.')


def main():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SystemExit('Execute este programa em um terminal interativo para ocultar o segredo.')
    root = Path(__file__).resolve().parents[1]
    cli = root / '.tools/cloudflare/node_modules/wrangler/bin/wrangler.js'
    if not cli.is_file():
        raise SystemExit('Wrangler local ausente. Consulte docs/operacao-pt-br.md.')
    node, version = find_node()
    print(f'Usando Node.js {version}.')
    client_id = input('Client ID da OAuth App Volátil CMS: ').strip()
    client_secret = getpass.getpass('Client Secret (entrada oculta): ').strip()
    if not client_id or not client_secret:
        raise SystemExit('Os dois valores são obrigatórios. Nenhuma alteração foi enviada.')
    environment = os.environ.copy()
    environment['PATH'] = str(Path(node).parent) + os.pathsep + environment.get('PATH', '')
    result = subprocess.run(
        [node, str(cli), 'secret', 'bulk', '--config', str(root / 'services/oauth/wrangler.toml')],
        input=json.dumps({'GITHUB_CLIENT_ID': client_id, 'GITHUB_CLIENT_SECRET': client_secret}),
        text=True,
        cwd=root,
        env=environment,
        check=False,
    )
    if result.returncode:
        raise SystemExit(result.returncode)
    print('Credenciais enviadas ao Worker. Avise ao Codex para concluir a conexão do painel.')


if __name__ == '__main__':
    main()
