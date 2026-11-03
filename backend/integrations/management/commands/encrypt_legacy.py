"""
Re-encrypt Integration credentials (and migrate legacy plaintext webhook URLs
out of config into credentials).

Usage:
  python manage.py encrypt_legacy
  python manage.py encrypt_legacy --dry-run
"""

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings


class Command(BaseCommand):
    help = 'Encrypt plaintext Integration credentials and migrate webhook URLs from config'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would change without writing',
        )

    def handle(self, *args, **options):
        from integrations.models import Integration, EncryptedFieldMixin, _fernet

        if not _fernet():
            raise CommandError(
                'ENCRYPTION_KEY is missing or invalid. Set a Fernet key before running encrypt_legacy.'
            )

        dry_run = options['dry_run']
        updated = 0
        migrated_webhooks = 0

        for integration in Integration.objects.all().iterator():
            changed = False
            credentials = dict(integration.credentials or {})
            config = dict(integration.config or {})

            # Move plaintext webhook_url from config into credentials
            if 'webhook_url' in config and config.get('webhook_url'):
                if not credentials.get('webhook_url'):
                    credentials['webhook_url'] = config.pop('webhook_url')
                    migrated_webhooks += 1
                    changed = True
                else:
                    config.pop('webhook_url', None)
                    changed = True

            # Re-encrypt any credential values that are still plaintext
            plain = {}
            for key, value in credentials.items():
                if value is None:
                    continue
                if isinstance(value, str) and value.startswith(EncryptedFieldMixin.FERNET_PREFIX):
                    plain[key] = EncryptedFieldMixin.decrypt_value(value)
                else:
                    plain[key] = value
                    changed = True

            # Also detect already-encrypted that may have been stored under wrong key
            # by always rewriting through set_credentials_dict when anything changed
            # or when any value lacks the enc: prefix
            needs_rewrite = any(
                not (isinstance(v, str) and v.startswith(EncryptedFieldMixin.FERNET_PREFIX))
                for v in credentials.values()
                if v is not None
            )
            if needs_rewrite:
                changed = True

            if not changed:
                continue

            updated += 1
            self.stdout.write(
                f"{'[dry-run] ' if dry_run else ''}"
                f"Re-encrypt {integration.type} ({integration.id}) "
                f"keys={list(plain.keys())}"
            )
            if dry_run:
                continue

            integration.config = config
            integration.set_credentials_dict(plain)
            integration.save(update_fields=['config', 'credentials', 'updated_at'])

        self.stdout.write(self.style.SUCCESS(
            f"{'Would update' if dry_run else 'Updated'} {updated} integration(s); "
            f"migrated {migrated_webhooks} webhook URL(s). "
            f"ENCRYPTION_KEY present={bool(getattr(settings, 'ENCRYPTION_KEY', ''))}"
        ))
