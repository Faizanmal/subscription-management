import json
import os
import tempfile
from decimal import Decimal
from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from users.models import Organization, User, Role
from services.models import Subscription
from backups.models import Backup, DataExport, ImportJob
from backups.tasks import run_backup, run_data_export, run_import_job, restore_backup, restore_data

@override_settings(ENFORCE_EMAIL_VERIFICATION=False, ENFORCE_POLICY_ACCEPTANCE=False)
class CustomerDataActionsTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Data One', slug='data-one')
        self.other = Organization.objects.create(name='Data Two', slug='data-two')
        self.role = Role.objects.create(organization=self.org, name='Admin', type='admin')
        self.user = User.objects.create_user('data@example.com', 'UniqueTestPhrase123!', organization=self.org, role=self.role)
        self.subscription = Subscription.objects.create(organization=self.org, name='Original', cost_per_unit=10, total_licenses=1)
        self.foreign = Subscription.objects.create(organization=self.other, name='Private', cost_per_unit=30, total_licenses=1)
        self.client = APIClient();self.client.force_authenticate(self.user)
        self.files = tempfile.TemporaryDirectory()
        self.config = override_settings(BACKUP_ROOT=self.files.name, EXPORT_ROOT=self.files.name, MEDIA_ROOT=self.files.name)
        self.config.enable();self.addCleanup(self.files.cleanup);self.addCleanup(self.config.disable)

    def test_backup_create_download_restore_and_scope(self):
        with patch('backups.tasks.run_backup.delay', side_effect=lambda pk: run_backup.run(pk)), patch('backups.tasks.cleanup_old_backups.delay'):
            response = self.client.post(reverse('backup-create-manual'), {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        snapshot = Backup.objects.get(pk=response.data['backup_id'])
        self.assertEqual(snapshot.status, 'completed', snapshot.error_message)
        self.assertEqual(self.client.get(reverse('backup-list')).status_code, 200)
        download = self.client.get(reverse('backup-download', args=[snapshot.pk]))
        self.assertEqual(download.status_code, 200);download.close()
        self.subscription.cost_per_unit = 99;self.subscription.save()
        self.assertEqual(self.client.post(reverse('backup-restore', args=[snapshot.pk]), {}, format='json').status_code, 400)
        with patch('backups.tasks.restore_backup.delay', side_effect=lambda pk, opts: type('Result', (), {'id': 'local-test', 'value': restore_backup.run(pk, opts)})()):
            response = self.client.post(reverse('backup-restore', args=[snapshot.pk]), {'confirm': True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        snapshot.refresh_from_db();self.assertEqual(snapshot.restore_status, 'completed', snapshot.restore_error)
        self.subscription.refresh_from_db();self.assertEqual(self.subscription.cost_per_unit, Decimal('10'))
        with self.assertRaises(ValueError):
            restore_data(self.org, {'subscriptions': [{'id': str(self.foreign.pk), 'organization_id': str(self.other.pk), 'name': 'Stolen'}]}, {})
        self.foreign.refresh_from_db();self.assertEqual(self.foreign.name, 'Private')

    def test_export_download_and_subscription_import_skip_duplicates(self):
        with patch('backups.tasks.run_data_export.delay', side_effect=lambda pk: run_data_export.run(pk)):
            response = self.client.post(reverse('export-list'), {'format': 'json', 'data_types': ['subscriptions', 'users']}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        export = DataExport.objects.get(pk=response.data['id'])
        self.assertEqual(export.status, 'completed', export.error_message)
        with open(export.file_path) as stream: data = json.load(stream)
        self.assertEqual(len(data['subscriptions']), 1)
        self.assertNotIn('password', data['users'][0])
        download = self.client.get(reverse('export-download', args=[export.pk]));self.assertEqual(download.status_code, 200);download.close()
        file = SimpleUploadedFile('subscriptions.csv', b'name,monthly_cost,total_licenses\nImported,24,2\nOriginal,999,1\n', content_type='text/csv')
        with patch('backups.tasks.run_import_job.delay', side_effect=lambda pk: run_import_job.run(pk)):
            response = self.client.post(reverse('import-list'), {'file': file, 'import_type': 'subscriptions'}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        job = ImportJob.objects.get(pk=response.data['id'])
        self.assertEqual(job.status, 'completed', job.processing_errors)
        self.assertEqual(job.failed_rows, 0, job.processing_errors)
        imported = Subscription.objects.get(organization=self.org, name='Imported')
        self.assertEqual(imported.monthly_cost, Decimal('24'))
        self.subscription.refresh_from_db();self.assertEqual(self.subscription.cost_per_unit, Decimal('10'))
        self.assertEqual(self.client.get(reverse('import-list')).status_code, 200)

    def test_unsupported_user_import_is_rejected_before_moving_membership(self):
        response = self.client.post(reverse('import-list'), {'file': SimpleUploadedFile('users.csv', b'email\ndata@example.com\n'), 'import_type': 'users'}, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_schedule_creation_and_due_job_use_model_fields(self):
        from django.utils import timezone
        from backups.models import BackupSchedule
        from backups.tasks import run_scheduled_backups
        response = self.client.post(reverse('backup-schedule-list'), {'name': 'Daily', 'frequency': 'daily', 'retention_days': 30, 'is_active': True}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        schedule = BackupSchedule.objects.get(pk=response.data['id'])
        self.assertIsNotNone(schedule.next_backup)
        schedule.next_backup = timezone.now() - timezone.timedelta(minutes=1);schedule.save()
        with patch('backups.tasks.run_backup.delay') as run:
            run_scheduled_backups.run()
        run.assert_called_once()
        self.assertTrue(Backup.objects.filter(organization=self.org, schedule=schedule).exists())
