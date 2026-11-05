"""Validate release configuration without exposing credentials."""

import ipaddress
from urllib.parse import urlsplit

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


def complete(value, prefixes=()):
    value = (value or '').strip()
    if any(word in value.lower() for word in ('replace', 'placeholder', 'example', 'dummy', 'change-me', 'changeme', 'your-', 'your_')):
        return False
    return any(value.startswith(p) and len(value) > len(p) + 8 for p in prefixes) if prefixes else bool(value)


def public_origin(value):
    try:
        url = urlsplit(value)
        _ = url.port  # Reject malformed ports as well as malformed hostnames.
        host = (url.hostname or '').lower()
        if url.scheme != 'https' or not host or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
            return False
        if host in ('localhost', 'backend', 'frontend', 'example.com') or host.endswith(('.localhost', '.local', '.example.com', '.test', '.invalid')):
            return False
        try:
            return ipaddress.ip_address(host).is_global
        except ValueError:
            return '.' in host and '*' not in host
    except ValueError:
        return False


class Command(BaseCommand):
    help = 'Check release configuration, database, migrations, cache, and Celery broker'

    def add_arguments(self, parser):
        parser.add_argument('--strict', action='store_true', help='Also fail on operational recommendations')
        parser.add_argument('--require-billing', action='store_true')
        parser.add_argument('--require-connector', action='append', default=[], choices=['google', 'microsoft', 'plaid', 'ai'])

    def handle(self, *args, **options):
        failures, warnings = [], []

        def check(ok, label, hint='', recommended=False):
            if ok:
                self.stdout.write(self.style.SUCCESS(f'OK  {label}'))
            else:
                (warnings if recommended else failures).append(label)
                self.stdout.write(f'{"WARN" if recommended else "FAIL"} {label}' + (f' — {hint}' if hint else ''))

        check(not settings.DEBUG, 'DJANGO_DEBUG is False')
        for label, value, minimum in [('DJANGO_SECRET_KEY', settings.SECRET_KEY, 50), ('JWT signing key', settings.SIMPLE_JWT['SIGNING_KEY'], 32)]:
            check(complete(value) and len(value) >= minimum and 'insecure' not in value.lower(), f'{label} is strong', f'Use a random secret of at least {minimum} characters')
        try:
            from cryptography.fernet import Fernet
            Fernet(settings.ENCRYPTION_KEY)
            valid_key = True
        except (ValueError, TypeError):
            valid_key = False
        check(valid_key, 'ENCRYPTION_KEY is a valid Fernet key')
        frontend = settings.FRONTEND_URL.rstrip('/')
        check(public_origin(frontend), 'FRONTEND_URL is a public HTTPS origin')
        hosts = settings.ALLOWED_HOSTS
        check(bool(hosts) and all(host and not host.startswith('.') and '*' not in host for host in hosts), 'ALLOWED_HOSTS contains explicit hosts')
        check(any(public_origin(f'https://{host}') for host in hosts), 'ALLOWED_HOSTS includes a public host')
        for name in ('CORS_ALLOWED_ORIGINS', 'CSRF_TRUSTED_ORIGINS'):
            origins = getattr(settings, name, [])
            check(frontend in [origin.rstrip('/') for origin in origins] and all(public_origin(origin) for origin in origins), f'{name} matches public frontend')
        check(getattr(settings, 'SECURE_SSL_REDIRECT', False), 'HTTPS redirect is enabled')
        check(getattr(settings, 'SESSION_COOKIE_SECURE', False) and getattr(settings, 'CSRF_COOKIE_SECURE', False), 'Session and CSRF cookies require HTTPS')
        check(settings.DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql', 'Production database uses PostgreSQL')
        check(getattr(settings, 'ENFORCE_EMAIL_VERIFICATION', False), 'Email ownership verification is enforced')
        check(getattr(settings, 'ENFORCE_POLICY_ACCEPTANCE', False), 'Current policy acceptance is enforced')
        check(not getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False), 'Background jobs use real workers')
        backend = settings.EMAIL_BACKEND
        check(not any(part in backend for part in ('console.', 'locmem.', 'dummy.', 'filebased.')), 'Email uses a delivery backend')
        if backend == 'django.core.mail.backends.smtp.EmailBackend':
            check(complete(settings.EMAIL_HOST) and settings.EMAIL_HOST != 'localhost', 'SMTP host is configured')
            check(not settings.EMAIL_HOST_USER or complete(settings.EMAIL_HOST_PASSWORD), 'SMTP authentication is complete')
        check(complete(settings.DEFAULT_FROM_EMAIL) and not settings.DEFAULT_FROM_EMAIL.endswith('@swm.com'), 'Sender email is configured')
        billing = [settings.STRIPE_SECRET_KEY, settings.STRIPE_WEBHOOK_SECRET, settings.STRIPE_PRICE_PRO]
        if options['require_billing'] or any(billing):
            for label, value, prefixes in zip(('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO'), billing, (('sk_test_', 'sk_live_'), ('whsec_',), ('price_',))):
                check(complete(value, prefixes), f'{label} looks complete')
        else:
            self.stdout.write('SKIP Billing is unconfigured; do not offer paid checkout')
        connectors = {
            'google': (settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET),
            'microsoft': (settings.MICROSOFT_CLIENT_ID, settings.MICROSOFT_CLIENT_SECRET),
            'plaid': (settings.PLAID_CLIENT_ID, settings.PLAID_SECRET),
            'ai': (settings.OPENAI_API_KEY,),
        }
        for name, values in connectors.items():
            if name in options['require_connector'] or any(values):
                check(all(complete(value) for value in values), f'{name} credentials are complete')
            else:
                self.stdout.write(f'SKIP {name} is unconfigured; do not advertise it as available')
        check(bool(settings.SENTRY_DSN) and settings.SENTRY_DSN.startswith('https://'), 'SENTRY_DSN configured', 'Configure production error monitoring', recommended=True)
        try:
            connection.ensure_connection()
            check(True, 'Database connection')
            executor = MigrationExecutor(connection)
            check(not executor.migration_plan(executor.loader.graph.leaf_nodes()), 'All database migrations applied')
        except Exception:
            check(False, 'Database and migration checks', 'Check connectivity and credentials privately')
        try:
            from django.core.cache import cache
            from uuid import uuid4
            key = f'launch-probe:{uuid4()}'
            cache.set(key, 'ok', timeout=10)
            check(cache.get(key) == 'ok', 'Cache read/write')
            cache.delete(key)
        except Exception:
            check(False, 'Cache read/write', 'Check Redis configuration privately')
        try:
            import redis
            broker = redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=3, socket_timeout=3)
            try:
                check(broker.ping(), 'Celery Redis broker connection')
            finally:
                broker.close()
        except Exception:
            check(False, 'Celery Redis broker connection', 'Check broker configuration privately')
        self.stdout.write(f'Summary: {len(failures)} required failure(s), {len(warnings)} warning(s)')
        if failures or (options['strict'] and warnings):
            raise CommandError('Launch readiness check failed; resolve the checks above')
