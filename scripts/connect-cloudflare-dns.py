#!/usr/bin/env python3
"""Valida e guarda localmente um token DNS restrito para a migração do Volátil."""
import getpass
import json
import os
import re
from pathlib import Path
import sys
import tempfile
import urllib.error
import urllib.request

ZONE_ID = 'b2fd9c4337bac472912487dd1bda59b4'
HOSTNAME = 'volatil.vibelab.app.br'


def normalize_token(value):
    token = value.strip().strip('"\'')
    token = re.sub(r'^(?:Authorization:\s*)?Bearer\s+', '', token, flags=re.IGNORECASE)
    if not re.fullmatch(r'[A-Za-z0-9_-]+', token):
        raise RuntimeError('Cole somente o valor completo do API Token, não um comando curl, o nome ou o identificador do token.')
    return token


def dns_error(error):
    codes = []
    try:
        payload = json.loads(error.read(16384))
        pending = list(payload.get('errors', []))
        while pending:
            item = pending.pop()
            if isinstance(item.get('code'), int):
                codes.append(item['code'])
            pending.extend(item.get('error_chain', []))
    except (ValueError, TypeError, AttributeError):
        pass
    # Somente códigos numéricos são exibidos; nunca o corpo da resposta.
    suffix = f"; códigos {', '.join(map(str, codes))}" if codes else ''
    if error.code == 400 or any(code in (6003, 6111, 9106, 9109) for code in codes):
        reason = 'A Cloudflare não reconheceu a autenticação. Copie novamente o valor completo do API Token recém-criado, não o Token ID ou o Client Secret do GitHub.'
    elif error.code == 403:
        reason = 'Confira a permissão Zone → DNS → Edit e a restrição à zona vibelab.app.br.'
    else:
        reason = 'Não foi possível confirmar o acesso DNS. Nenhuma credencial foi salva.'
    return f'Cloudflare HTTP {error.code}{suffix}. {reason}'


def validate_token(token):
    request = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/dns_records?name={HOSTNAME}',
        headers={'Authorization': f'Bearer {token}', 'User-Agent': 'volatil-domain-setup'},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(dns_error(error)) from None
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
        token = normalize_token(token)
        count = validate_token(token)
        store_token(token)
    except (RuntimeError, OSError) as error:
        raise SystemExit(str(error)) from None
    print(f'Acesso DNS validado. Registros exatos existentes para {HOSTNAME}: {count}.')
    print('Token guardado fora do repositório, com acesso somente ao seu usuário.')
    print('Nenhum registro DNS foi alterado. Avise ao Codex para concluir a migração.')


if __name__ == '__main__':
    main()
