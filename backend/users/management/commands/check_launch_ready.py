"""
Validate staging/production launch configuration.

Usage:
  python manage.py check_launch_ready
  python manage.py check_launch_ready --strict
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Check env/config readiness for staging or production launch'

    def add_arguments(self, parser):
        parser.add_argument(
            '--strict',
            action='store_true',
            help='Exit non-zero if any required or recommended check fails',
        )

    def handle(self, *args, **options):
        strict = options['strict']
        required_failures = []
        warnings = []

        def req(ok, label, hint=''):
            if ok:
                self.stdout.write(self.style.SUCCESS(f'OK  {label}'))
            else:
                msg = f'FAIL {label}' + (f' — {hint}' if hint else '')
                self.stdout.write(self.style.ERROR(msg))
                required_failures.append(label)

        def warn(ok, label, hint=''):
            if ok:
                self.stdout.write(self.style.SUCCESS(f'OK  {label}'))
            else:
                msg = f'WARN {label}' + (f' — {hint}' if hint else '')
                self.stdout.write(self.style.WARNING(msg))
                warnings.append(label)

        debug = bool(settings.DEBUG)
        testing = bool(getattr(settings, 'TESTING', False))

        req(not debug or testing, 'DJANGO_DEBUG is False', 'Set DJANGO_DEBUG=False for staging/prod')
        req(bool(settings.SECRET_KEY) and 'insecure' not in settings.SECRET_KEY.lower(),
            'DJANGO_SECRET_KEY is set', 'Use a long random secret')
        req(bool(getattr(settings, 'ENCRYPTION_KEY', '')),
            'ENCRYPTION_KEY is set', 'Generate with Fernet.generate_key()')

        if getattr(settings, 'ENCRYPTION_KEY', ''):
            try:
                from cryptography.fernet import Fernet
                Fernet(settings.ENCRYPTION_KEY.encode() if isinstance(settings.ENCRYPTION_KEY, str) else settings.ENCRYPTION_KEY)
                self.stdout.write(self.style.SUCCESS('OK  ENCRYPTION_KEY is a valid Fernet key'))
            except Exception:
                req(False, 'ENCRYPTION_KEY is a valid Fernet key', 'Regenerate the key')

        frontend = getattr(settings, 'FRONTEND_URL', '') or ''
        req(frontend.startswith('https://') or debug or testing,
            'FRONTEND_URL uses HTTPS', f'Current: {frontend or "(empty)"}')

        cors = getattr(settings, 'CORS_ALLOWED_ORIGINS', None) or []
        if isinstance(cors, str):
            cors_list = [o.strip() for o in cors.split(',') if o.strip()]
        else:
            cors_list = list(cors)
        frontend_norm = frontend.rstrip('/')
        warn(
            (not frontend_norm) or frontend_norm in [o.rstrip('/') for o in cors_list] or debug or testing,
            'CORS_ALLOWED_ORIGINS includes FRONTEND_URL',
            f'FRONTEND_URL={frontend or "(empty)"}; CORS={cors_list or "(empty)"}',
        )

        email_backend = getattr(settings, 'EMAIL_BACKEND', '')
        warn(
            'console' not in email_backend,
            'Email backend is not console',
            f'Current: {email_backend}',
        )

        def _stripe_filled(value, prefixes):
            """True when value looks like a real Stripe id, not a bare prefix placeholder."""
            value = (value or '').strip()
            if not value:
                return False
            for prefix in prefixes:
                if value == prefix or value == prefix.rstrip('_'):
                    return False
                if value.startswith(prefix) and len(value) > len(prefix) + 8:
                    return True
            return len(value) > 16

        stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '') or ''
        stripe_whsec = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '') or ''
        stripe_price = getattr(settings, 'STRIPE_PRICE_PRO', '') or ''
        warn(
            _stripe_filled(stripe_key, ('sk_test_', 'sk_live_')),
            'STRIPE_SECRET_KEY looks complete',
            'Paste full sk_test_… / sk_live_… from Stripe Dashboard (not just the prefix)',
        )
        warn(
            _stripe_filled(stripe_whsec, ('whsec_',)),
            'STRIPE_WEBHOOK_SECRET looks complete',
            'From `stripe listen` or Dashboard webhook signing secret',
        )
        warn(
            _stripe_filled(stripe_price, ('price_',)),
            'STRIPE_PRICE_PRO looks complete',
            'Use a full Price ID (price_…) from the Stripe product',
        )

        if stripe_key.startswith('sk_live_'):
            warn(frontend.startswith('https://'), 'Live Stripe + HTTPS frontend',
                 'Do not take live payments on HTTP')

        warn(bool(getattr(settings, 'SENTRY_DSN', '')),
             'SENTRY_DSN set', 'Recommended for production errors')
        warn(bool(getattr(settings, 'GOOGLE_CLIENT_ID', '')),
             'GOOGLE_CLIENT_ID set', 'Needed for Workspace discovery smoke test')
        warn(bool(getattr(settings, 'MICROSOFT_CLIENT_ID', '')),
             'MICROSOFT_CLIENT_ID set', 'Needed for M365 discovery smoke test')

        # DB ping
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            self.stdout.write(self.style.SUCCESS('OK  Database connection'))
        except Exception as exc:
            req(False, 'Database connection', str(exc)[:160])

        self.stdout.write('')
        self.stdout.write(
            f'Summary: {len(required_failures)} required failure(s), {len(warnings)} warning(s)'
        )
        self.stdout.write(self.style.NOTICE(
            'Stripe webhook endpoint: https://<api-host>/api/v1/auth/billing/webhook/'
        ))
        self.stdout.write(self.style.NOTICE(
            'Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted'
        ))
        self.stdout.write(self.style.NOTICE('Health: GET /api/v1/health/'))
        self.stdout.write(self.style.NOTICE(
            'Local Stripe CLI: stripe listen --forward-to localhost:8000/api/v1/auth/billing/webhook/'
        ))

        if required_failures and strict:
            raise CommandError('Launch readiness check failed (required items)')
        if (required_failures or warnings) and strict:
            raise CommandError('Launch readiness check failed (strict mode)')
