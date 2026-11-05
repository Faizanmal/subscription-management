from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.core.management import call_command, CommandError
from django.test import SimpleTestCase


class LaunchCheckTests(SimpleTestCase):
    def setUp(self):
        self.config = SimpleNamespace(
            DEBUG=False, SECRET_KEY='a' * 60, SIMPLE_JWT={'SIGNING_KEY': 'b' * 48},
            ENCRYPTION_KEY=Fernet.generate_key(), FRONTEND_URL='https://app.acme.com',
            ALLOWED_HOSTS=['api.acme.com'], CORS_ALLOWED_ORIGINS=['https://app.acme.com'],
            CSRF_TRUSTED_ORIGINS=['https://app.acme.com'], SECURE_SSL_REDIRECT=True,
            SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True,
            DATABASES={'default': {'ENGINE': 'django.db.backends.postgresql'}},
            EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend', EMAIL_HOST='smtp.acme.com',
            EMAIL_HOST_USER='mail-user', EMAIL_HOST_PASSWORD='private-password', DEFAULT_FROM_EMAIL='noreply@acme.com',
            STRIPE_SECRET_KEY='', STRIPE_WEBHOOK_SECRET='', STRIPE_PRICE_PRO='',
            GOOGLE_CLIENT_ID='', GOOGLE_CLIENT_SECRET='', MICROSOFT_CLIENT_ID='', MICROSOFT_CLIENT_SECRET='',
            PLAID_CLIENT_ID='', PLAID_SECRET='', OPENAI_API_KEY='', SENTRY_DSN='https://public@sentry.acme.com/1',
            CELERY_BROKER_URL='redis://private-password@redis/1',
            ENFORCE_EMAIL_VERIFICATION=True, ENFORCE_POLICY_ACCEPTANCE=True,
            CELERY_TASK_ALWAYS_EAGER=False,
        )
        self.output = StringIO()
        module = 'users.management.commands.check_launch_ready'
        for target, value in [
            (f'{module}.settings', self.config),
            (f'{module}.connection', None),
        ]:
            if value is not None:
                patcher = patch(target, value)
            else:
                patcher = patch(target)
            result = patcher.start()
            self.addCleanup(patcher.stop)
            if value is None:
                self.connection = result
        patcher = patch(f'{module}.MigrationExecutor')
        self.executor = patcher.start().return_value
        self.executor.migration_plan.return_value = []
        self.addCleanup(patcher.stop)
        patcher = patch('redis.Redis.from_url')
        self.broker = patcher.start().return_value
        self.broker.ping.return_value = True
        self.addCleanup(patcher.stop)

    def run_check(self, **options):
        call_command('check_launch_ready', stdout=self.output, **options)

    def test_unconfigured_optional_features_do_not_block_strict_release(self):
        self.run_check(strict=True)
        self.assertIn('SKIP Billing', self.output.getvalue())

    def test_debug_does_not_pass_even_in_test_environment(self):
        self.config.DEBUG = True
        with self.assertRaises(CommandError):
            self.run_check()

    def test_placeholders_and_invalid_prefixes_are_rejected(self):
        for key in ['sk_test_', 'not_a_stripe_key_but_long_enough']:
            self.config.STRIPE_SECRET_KEY = key
            with self.assertRaises(CommandError):
                self.run_check()

    def test_required_billing_and_connector_cannot_be_skipped(self):
        for options in [{'require_billing': True}, {'require_connector': ['google']}]:
            with self.assertRaises(CommandError):
                self.run_check(**options)

    def test_partial_connector_configuration_is_rejected(self):
        self.config.GOOGLE_CLIENT_ID = 'configured-client'
        with self.assertRaises(CommandError):
            self.run_check()

    def test_local_origin_short_jwt_and_wildcard_host_are_rejected(self):
        self.config.FRONTEND_URL = 'https://localhost'
        self.config.SIMPLE_JWT = {'SIGNING_KEY': 'short'}
        self.config.ALLOWED_HOSTS = ['*']
        with self.assertRaises(CommandError):
            self.run_check()
        for label in ['FRONTEND_URL', 'JWT signing key', 'explicit hosts']:
            self.assertIn('FAIL ' + label if label != 'explicit hosts' else 'ALLOWED_HOSTS contains explicit hosts', self.output.getvalue())

    def test_pending_migrations_block_release(self):
        self.executor.migration_plan.return_value = ['pending migration']
        with self.assertRaises(CommandError):
            self.run_check()

    def test_database_errors_do_not_print_credentials(self):
        self.connection.ensure_connection.side_effect = RuntimeError('postgres://sensitive:password@db')
        with self.assertRaises(CommandError):
            self.run_check()
        self.assertNotIn('sensitive', self.output.getvalue())

    def test_broker_outage_blocks_release(self):
        self.broker.ping.side_effect = RuntimeError('private-password')
        with self.assertRaises(CommandError):
            self.run_check()
        self.assertNotIn('private-password', self.output.getvalue())

    def test_disabled_account_boundaries_block_release(self):
        for flag in ['ENFORCE_EMAIL_VERIFICATION', 'ENFORCE_POLICY_ACCEPTANCE']:
            with self.subTest(flag=flag):
                setattr(self.config, flag, False)
                with self.assertRaises(CommandError):
                    self.run_check()
                setattr(self.config, flag, True)

    def test_eager_jobs_do_not_count_as_worker_readiness(self):
        self.config.CELERY_TASK_ALWAYS_EAGER = True
        with self.assertRaises(CommandError):
            self.run_check()
        self.assertIn('FAIL Background jobs use real workers', self.output.getvalue())

    def test_test_only_email_backends_block_release(self):
        for name in ['console', 'locmem', 'dummy', 'filebased']:
            with self.subTest(backend=name):
                self.config.EMAIL_BACKEND = f'django.core.mail.backends.{name}.EmailBackend'
                with self.assertRaises(CommandError):
                    self.run_check()
