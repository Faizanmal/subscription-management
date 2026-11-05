"""Create local-only env files without rotating existing keys or DB passwords."""

import base64
from pathlib import Path
import re
import secrets


def read_values(path):
    if not path.exists():
        return {}
    return dict(re.findall(r'^([A-Z_]+)=([^\r\n]*)', path.read_text(encoding='utf-8-sig'), re.M))


def ensure_key(path, key):
    text = path.read_text(encoding='utf-8-sig') if path.exists() else ''
    current = read_values(path).get('ENCRYPTION_KEY', '').strip()
    if current:
        return  # Existing ciphertext may depend on this key.
    if re.search(r'^ENCRYPTION_KEY=', text, re.M):
        text = re.sub(r'^ENCRYPTION_KEY=[^\r\n]*', f'ENCRYPTION_KEY={key}', text, flags=re.M)
    else:
        text = text.rstrip() + f'\nENCRYPTION_KEY={key}\n'
    path.write_text(text, encoding='utf-8')


def bootstrap(root):
    root = Path(root)
    backend = root / 'backend'
    local, production, compose = backend / '.env', backend / '.env.prod', root / '.env'
    # Reuse local keys; never silently rotate existing secrets.
    key = read_values(local).get('ENCRYPTION_KEY', '').strip() or read_values(compose).get('ENCRYPTION_KEY', '').strip()
    key = key or base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
    if not local.exists():
        local.write_text((backend / '.env.example').read_text(encoding='utf-8-sig'), encoding='utf-8')
    ensure_key(local, key)
    ensure_key(compose, key)
    if not production.exists():
        text = (backend / '.env.prod.example').read_text(encoding='utf-8-sig')
        pgpass = secrets.token_urlsafe(24)
        replacements = {
            'DJANGO_SECRET_KEY': secrets.token_urlsafe(48),
            'JWT_SECRET_KEY': secrets.token_urlsafe(48),
            'ENCRYPTION_KEY': key,
            'POSTGRES_PASSWORD': pgpass,
            'DATABASE_URL': f'postgres://swm_user:{pgpass}@db:5432/swm_db',
            'DJANGO_DEBUG': 'True',
            'DJANGO_ALLOWED_HOSTS': 'localhost,127.0.0.1,backend',
            'FRONTEND_URL': 'http://localhost:3000',
            'CORS_ALLOWED_ORIGINS': 'http://localhost:3000',
            'CSRF_TRUSTED_ORIGINS': 'http://localhost:3000',
            'NEXT_PUBLIC_API_URL': 'http://localhost:8000/api/v1',
            'NEXT_PUBLIC_WS_URL': 'ws://localhost:8000/ws',
            'NEXT_PUBLIC_APP_URL': 'http://localhost:3000',
            'NEXT_PUBLIC_INDEXABLE': 'false',
            'DJANGO_TRUST_PROXY': 'False',
        }
        for name, value in replacements.items():
            text = re.sub(rf'^{name}=[^\r\n]*', f'{name}={value}', text, flags=re.M)
        production.write_text('# LOCAL SMOKE ONLY — not public production configuration.\n' + text, encoding='utf-8')
    frontend = root / 'frontend'
    if not (frontend / '.env.local').exists():
        (frontend / '.env.local').write_text((frontend / '.env.example').read_text(encoding='utf-8-sig'), encoding='utf-8')


if __name__ == '__main__':
    bootstrap(Path(__file__).resolve().parent.parent)
    print('Local env files ready. Existing credentials were preserved; no database was modified.')
    print('Fill provider credentials privately. For public staging, use HTTPS hosts and DJANGO_DEBUG=False.')
