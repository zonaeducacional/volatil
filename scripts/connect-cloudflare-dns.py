#!/usr/bin/env python3
"""Valida e guarda localmente um token DNS restrito para a migração do Volátil."""
import getpass
import json
import os
from pathlib import Path
import sys
import tempfile
import urllib.error
import urllib.request

ZONE_ID = 'b2fd9c4337bac472912487dd1bda59b4'
HOSTNAME = 'volatil.vibelab.app.br'


def validate_token(token):
    request = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/dns_records?name={HOSTNAME}',
        headers={'Authorization': f'Bearer {token}', 'User-Agent': 'volatil-domain-setup'},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Cloudflare recusou o acesso DNS (HTTP {error.code}). Confira o token e sua restrição à zona vibelab.app.br.') from None
    except (urllib.error.URLError, ValueError):
        raise RuntimeError('Não foi possível verificar o acesso DNS. Nenhuma credencial foi salva.') from None
    if not data.get('success') or not isinstance(data.get('result'), list):
        raise RuntimeError('A Cloudflare não confirmou o acesso DNS. Nenhuma credencial foi salva.')
    return len(data['result'])


def store_token(token):
    directory = Path.home() / '.config/volatil'
    if directory.is_symlink():
        raise RuntimeError('O diretório de credenciais não pode ser um link simbólico.')
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)
    destination = directory / 'cloudflare-dns-token'
    fd, temporary = tempfile.mkstemp(prefix='.dns-token-', dir=directory)
    try:
        with os.fdopen(fd, 'w') as output:
            output.write(token)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return destination


def main():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SystemExit('Execute em um terminal interativo para ocultar o token.')
    token = getpass.getpass('Token Cloudflare DNS (entrada oculta): ').strip()
    if not token:
        raise SystemExit('Token vazio. Nenhuma alteração foi feita.')
    try:
        count = validate_token(token)
        store_token(token)
    except (RuntimeError, OSError) as error:
        raise SystemExit(str(error)) from None
    print(f'Acesso DNS validado. Registros exatos existentes para {HOSTNAME}: {count}.')
    print('Token guardado fora do repositório, com acesso somente ao seu usuário.')
    print('Nenhum registro DNS foi alterado. Avise ao Codex para concluir a migração.')


if __name__ == '__main__':
    main()
