"""
Celery tasks for backups app
"""

from celery import shared_task
from django.utils import timezone
from django.conf import settings
import logging
import os
import json
import hashlib
import zipfile

logger = logging.getLogger('swm')


@shared_task(bind=True, max_retries=3)
def run_backup(self, backup_id):
    """Run a backup job"""
    from backups.models import Backup
    
    try:
        backup = Backup.objects.select_related('schedule').get(id=backup_id)
        
        backup.status = 'running'
        backup.started_at = timezone.now()
        backup.save()
        
        try:
            # Get organization
            org = backup.organization
            
            # Create backup directory
            backup_dir = os.path.join(settings.BACKUP_ROOT, str(org.id))
            os.makedirs(backup_dir, exist_ok=True)
            
            # Create backup filename
            timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
            filename = f"backup_{org.slug}_{timestamp}_{backup.id}.zip"
            filepath = os.path.join(backup_dir, filename)
            
            # Collect data
            data = collect_backup_data(org, {})
            
            # Create zip file
            with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as zf:
                # Add JSON data
                zf.writestr('data.json', json.dumps(data, indent=2, default=str))
                
                # Add metadata
                zf.writestr('metadata.json', json.dumps({
                    'organization': str(org.id),
                    'organization_name': org.name,
                    'created_at': timezone.now().isoformat(),
                    'version': '1.0'
                }, indent=2))
            
            # Calculate checksum
            with open(filepath, 'rb') as f:
                checksum = hashlib.sha256(f.read()).hexdigest()
            
            # Update backup record
            backup.status = 'completed'
            backup.completed_at = timezone.now()
            backup.file_path = filepath
            backup.file_size = os.path.getsize(filepath)
            backup.checksum = checksum
            backup.save()
            
            # Update schedule
            if backup.schedule:
                backup.schedule.last_backup = timezone.now()
                backup.schedule.save(update_fields=['last_backup'])
            
            logger.info(f"Backup completed: {filepath}")
            
            # Cleanup old backups
            cleanup_old_backups.delay(str(backup.schedule.id))
            
        except Exception as e:
            backup.status = 'failed'
            backup.error_message = str(e)
            backup.completed_at = timezone.now()
            backup.save()
            raise
        
    except Backup.DoesNotExist:
        logger.error(f"Backup {backup_id} not found")
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        self.retry(countdown=300)


def collect_backup_data(organization, options):
    """Collect all organization data for backup"""
    from users.models import User, Department, Team, Role
    from services.models import (
        Subscription, SubscriptionUser, UsageMetrics,
        CostRecord, Recommendation, Alert, Workflow
    )
    from integrations.models import Integration
    
    data = {
        'users': list(User.objects.filter(organization=organization).values('id', 'email', 'first_name', 'last_name', 'date_joined')),
        'departments': list(Department.objects.filter(organization=organization).values()),
        'teams': list(Team.objects.filter(organization=organization).values()),
        'roles': list(Role.objects.filter(organization=organization).values()),
        'subscriptions': list(Subscription.objects.filter(organization=organization).values()),
        'subscription_users': list(
            SubscriptionUser.objects.filter(
                subscription__organization=organization
            ).values()
        ),
        'recommendations': list(
            Recommendation.objects.filter(
                subscription__organization=organization
            ).values()
        ),
        'alerts': list(
            Alert.objects.filter(
                subscription__organization=organization
            ).values()
        ),
        'workflows': list(Workflow.objects.filter(organization=organization).values()),
        'integrations': list(
            Integration.objects.filter(organization=organization).values(
                'id', 'name', 'type', 'status', 'config', 'created_at'
                # Exclude credentials for security
            )
        )
    }
    
    # Optionally include usage data (can be large)
    if options.get('include_usage', True):
        # Limit to last 90 days
        threshold = timezone.now() - timezone.timedelta(days=90)
        
        data['usage_metrics'] = list(
            UsageMetrics.objects.filter(
                subscription__organization=organization,
                period_start__gte=threshold.date()
            ).values()
        )
        
        data['cost_records'] = list(
            CostRecord.objects.filter(
                subscription__organization=organization,
                period_start__gte=threshold.date()
            ).values()
        )
    
    return data


@shared_task
def cleanup_old_backups(schedule_id):
    """Clean up old backups based on retention policy"""
    from backups.models import BackupSchedule, Backup
    
    try:
        schedule = BackupSchedule.objects.get(id=schedule_id)
        
        if schedule.retention_days == 0:
            # Keep forever
            return
        
        threshold = timezone.now() - timezone.timedelta(days=schedule.retention_days)
        
        old_backups = Backup.objects.filter(
            schedule=schedule,
            created_at__lt=threshold,
            status='completed'
        )
        
        for backup in old_backups:
            # Delete file
            if backup.file_path and os.path.exists(backup.file_path):
                os.remove(backup.file_path)
            
            backup.delete()
        
        if old_backups.count() > 0:
            logger.info(f"Cleaned up {old_backups.count()} old backups")
        
    except BackupSchedule.DoesNotExist:
        logger.error(f"Backup schedule {schedule_id} not found")


@shared_task(bind=True, max_retries=0)
def restore_backup(self, backup_id, options=None):
    from backups.models import Backup
    backup = Backup.objects.get(pk=backup_id)
    backup.restore_status = 'running'
    backup.save(update_fields=['restore_status'])
    try:
        if backup.status != 'completed' or not backup.file_path:
            raise ValueError('Snapshot is incomplete')
        with open(backup.file_path, 'rb') as stream:
            if hashlib.sha256(stream.read()).hexdigest() != backup.checksum:
                raise ValueError('Snapshot checksum does not match')
        with zipfile.ZipFile(backup.file_path) as archive:
            metadata = json.loads(archive.read('metadata.json'))
            data = json.loads(archive.read('data.json'))
        if str(backup.organization_id) != metadata.get('organization'):
            raise ValueError('Snapshot organization mismatch')
        restore_data(backup.organization, data, options or {})
        backup.restore_status = 'completed'
        backup.restore_error = ''
        backup.save(update_fields=['restore_status', 'restore_error'])
        return {'success': True}
    except Exception:
        logger.warning('Workspace snapshot restore failed')
        backup.restore_status = 'failed'
        backup.restore_error = 'Restore failed. Verify the snapshot and its related records before retrying.'
        backup.save(update_fields=['restore_status', 'restore_error'])
        return {'success': False}


def restore_data(organization, data, options):
    """Atomic merge of supported entities with strict organization boundaries."""
    from django.db import transaction
    from users.models import Organization, Department, Team, Role
    from services.models import Subscription, Recommendation
    from users.plans import require_subscription_slot
    selected = options.get('entities', ['all'])
    with transaction.atomic():
        organization = Organization.objects.select_for_update().get(pk=organization.pk)
        for key, model in [('departments', Department), ('teams', Team), ('roles', Role), ('subscriptions', Subscription), ('recommendations', Recommendation)]:
            if 'all' not in selected and key not in selected:
                continue
            for row in data.get(key, []):
                if 'organization_id' in row and str(row['organization_id']) != str(organization.pk):
                    raise ValueError('Snapshot contains foreign records')
                existing = model.objects.filter(pk=row['id']).first()
                if existing and ((hasattr(existing, 'organization_id') and existing.organization_id != organization.pk) or (hasattr(existing, 'subscription') and existing.subscription.organization_id != organization.pk)):
                    raise ValueError('Foreign record conflict')
                values = {}
                for field in model._meta.concrete_fields:
                    if field.primary_key or field.name == 'organization' or field.attname not in row:
                        continue
                    value = row[field.attname]
                    if field.is_relation and value:
                        related = field.related_model.objects.filter(pk=value).first()
                        if related and hasattr(related, 'organization_id') and related.organization_id != organization.pk:
                            raise ValueError('Foreign relationship in snapshot')
                        if related is None and field.null:
                            value = None
                    values[field.attname] = value
                if any(field.name == 'organization' for field in model._meta.fields):
                    values['organization'] = organization
                if model == Subscription and not existing and require_subscription_slot(organization):
                    raise ValueError('Subscription limit reached')
                model.objects.update_or_create(pk=row['id'], defaults=values)


@shared_task(bind=True, max_retries=3)
def run_data_export(self, export_id):
    """Run a data export job"""
    from backups.models import DataExport
    
    try:
        export = DataExport.objects.get(id=export_id)
        
        export.status = DataExport.Status.PROCESSING
        export.started_at = timezone.now()
        export.save(update_fields=['status', 'started_at'])
        
        try:
            org = export.organization
            
            # Collect data based on data_types
            data = collect_export_data(org, export.data_types, export.filters)
            
            # Create export directory
            export_dir = os.path.join(settings.EXPORT_ROOT, str(org.id))
            os.makedirs(export_dir, exist_ok=True)
            
            # Generate file
            timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
            
            if export.format == DataExport.Format.JSON:
                filename = f"export_{timestamp}_{export.id}.json"
                filepath = os.path.join(export_dir, filename)
                with open(filepath, 'w') as f:
                    json.dump(data, f, indent=2, default=str)
            
            elif export.format == DataExport.Format.CSV:
                filename = f"export_{timestamp}_{export.id}.zip"
                filepath = os.path.join(export_dir, filename)
                create_csv_export(data, filepath)
            
            elif export.format == DataExport.Format.EXCEL:
                filename = f"export_{timestamp}_{export.id}.xlsx"
                filepath = os.path.join(export_dir, filename)
                create_excel_export(data, filepath)
            
            else:
                raise ValueError(f"Unsupported format: {export.format}")
            
            # Update export record
            export.status = DataExport.Status.COMPLETED
            export.completed_at = timezone.now()
            export.file_path = filepath
            export.file_size = os.path.getsize(filepath)
            export.download_expires_at = timezone.now() + timezone.timedelta(days=7)
            export.records_exported = sum(
                len(rows) if isinstance(rows, list) else 0
                for rows in data.values()
            )
            export.progress = 100
            export.save()
            
            # Notify user
            if export.requested_by_id:
                from users.models import Notification
                Notification.objects.create(
                    user=export.requested_by,
                    organization=export.organization,
                    type=Notification.NotificationType.SYSTEM,
                    title='Data export ready',
                    message='Your data export is ready for download.',
                    action_url=f'/settings/backups?export={export.id}',
                )
            
            logger.info(f"Export completed: {filepath}")
            
        except Exception as e:
            export.status = DataExport.Status.FAILED
            export.error_message = str(e)
            export.completed_at = timezone.now()
            export.save(update_fields=['status', 'error_message', 'completed_at'])
            raise
        
    except DataExport.DoesNotExist:
        logger.error(f"Export {export_id} not found")
    except Exception as e:
        logger.error(f"Export failed: {e}")
        self.retry(countdown=60)


def collect_export_data(organization, data_types, filters):
    """Collect data for export"""
    from services.models import Subscription, UsageMetrics, CostRecord, Recommendation, Alert
    from users.models import User, AuditLog
    
    data = {}
    
    # Parse date filters
    date_from = filters.get('date_from')
    date_to = filters.get('date_to')
    
    if not data_types or 'subscriptions' in data_types:
        qs = Subscription.objects.filter(organization=organization)
        data['subscriptions'] = list(qs.values())
    
    if not data_types or 'usage' in data_types:
        qs = UsageMetrics.objects.filter(subscription__organization=organization)
        if date_from:
            qs = qs.filter(period_start__gte=date_from)
        if date_to:
            qs = qs.filter(period_end__lte=date_to)
        data['usage'] = list(qs.values())
    
    if not data_types or 'costs' in data_types:
        qs = CostRecord.objects.filter(subscription__organization=organization)
        if date_from:
            qs = qs.filter(period_start__gte=date_from)
        if date_to:
            qs = qs.filter(period_end__lte=date_to)
        data['costs'] = list(qs.values())
    
    if not data_types or 'recommendations' in data_types:
        qs = Recommendation.objects.filter(subscription__organization=organization)
        data['recommendations'] = list(qs.values())
    
    if not data_types or 'alerts' in data_types:
        qs = Alert.objects.filter(subscription__organization=organization)
        data['alerts'] = list(qs.values())
    
    if not data_types or 'users' in data_types:
        qs = User.objects.filter(organization=organization)
        data['users'] = list(qs.values('id', 'email', 'first_name', 'last_name', 'is_active', 'date_joined'))
    
    if not data_types or 'audit_logs' in data_types:
        qs = AuditLog.objects.filter(organization=organization)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        data['audit_logs'] = list(qs.values())
    
    return data


def create_csv_export(data, filepath):
    """Create CSV export (zip of multiple CSVs)"""
    
    with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as zf:
        for key, records in data.items():
            if not records:
                continue
            
            # Create CSV in memory
            output = []
            headers = records[0].keys()
            output.append(','.join(headers))
            
            for record in records:
                row = [str(record.get(h, '')) for h in headers]
                output.append(','.join(f'"{v}"' for v in row))
            
            zf.writestr(f'{key}.csv', '\n'.join(output))


def create_excel_export(data, filepath):
    """Create Excel export"""
    try:
        from openpyxl import Workbook
        
        wb = Workbook()
        
        first_sheet = True
        for key, records in data.items():
            if not records:
                continue
            
            if first_sheet:
                ws = wb.active
                ws.title = key[:31]  # Excel sheet name limit
                first_sheet = False
            else:
                ws = wb.create_sheet(key[:31])
            
            # Add headers
            headers = list(records[0].keys())
            for col, header in enumerate(headers, 1):
                ws.cell(row=1, column=col, value=header)
            
            # Add data
            for row_num, record in enumerate(records, 2):
                for col, header in enumerate(headers, 1):
                    ws.cell(row=row_num, column=col, value=str(record.get(header, '')))
        
        wb.save(filepath)
        
    except ImportError:
        # Fall back to CSV if openpyxl not available
        create_csv_export(data, filepath.replace('.xlsx', '.zip'))


@shared_task(bind=True, max_retries=3)
def run_import_job(self, import_job_id):
    """Run an import job"""
    from backups.models import ImportJob
    
    try:
        job = ImportJob.objects.get(id=import_job_id)
        
        if job.status not in ['pending', 'validating']:
            return
        
        job.status = 'processing'
        job.started_at = timezone.now()
        job.save()
        
        try:
            temp_path = job.source_file.path if job.source_file else None
            
            if not temp_path or not os.path.exists(temp_path):
                raise ValueError("Import file not found")
            
            # Parse and import data
            result = process_import(job, temp_path)
            
            job.status = 'completed'
            job.completed_at = timezone.now()
            job.total_rows = result['total']
            job.processed_rows = result['processed']
            job.successful_rows = result['success']
            job.failed_rows = result['errors']
            job.processing_errors = result.get('error_details', [])
            job.save()
            
            # Cleanup temp file
            job.source_file.delete(save=False)
            
            # Notify user
            if job.initiated_by_id:
                from users.models import Notification
                Notification.objects.create(
                    user=job.initiated_by,
                    organization=job.organization,
                    type=Notification.NotificationType.SYSTEM,
                    title='Import completed',
                    message=f'Imported {result["success"]} of {result["total"]} records.',
                    action_url=f'/settings/backups?import={job.id}',
                )
            
            logger.info(f"Import completed: {result}")
            
        except Exception as e:
            job.status = 'failed'
            job.processing_errors = [{'error': 'Import failed. Check the file format and retry.'}]
            job.completed_at = timezone.now()
            job.save()
            raise
        
    except ImportJob.DoesNotExist:
        logger.error(f"Import job {import_job_id} not found")
    except Exception as e:
        logger.error(f"Import failed: {e}")
        self.retry(countdown=60)


def process_import(job, filepath):
    """Process import file"""
    
    # Determine file type
    if filepath.endswith('.csv'):
        data = parse_csv(filepath)
    elif filepath.endswith('.json'):
        with open(filepath) as f:
            data = json.load(f)
    else:
        raise ValueError("Unsupported file format")
    
    result = {
        'total': len(data),
        'processed': 0,
        'success': 0,
        'errors': 0,
        'error_details': []
    }
    
    if not isinstance(data, list) or len(data) > 5000 or any(not isinstance(row, dict) for row in data):
        raise ValueError('Use an array of up to 5000 records')
    org = job.organization
    mapping = job.column_mapping or {}
    
    for i, row in enumerate(data):
        try:
            if job.import_type == 'subscriptions':
                import_subscription(org, row, mapping)
            else:
                raise ValueError(f"Unknown import type: {job.import_type}")
            
            result['success'] += 1
            
        except Exception as e:
            result['errors'] += 1
            result['error_details'].append({
                'row': i + 1,
                'error': str(e)
            })
        
        result['processed'] += 1
    
    return result


def parse_csv(filepath):
    """Parse CSV file"""
    import csv
    
    data = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append(row)
    
    return data


def import_subscription(organization, row, mapping):
    """Validate each imported row under the same limits as manual entry."""
    from decimal import Decimal
    from django.db import transaction
    from users.models import Organization
    from users.plans import subscription_limit
    from services.models import Subscription, SoftwareVendor
    from services.serializers import SubscriptionCreateSerializer
    with transaction.atomic():
        organization = Organization.objects.select_for_update().get(pk=organization.pk)
        name = (row.get(mapping.get('name', 'name')) or '').strip()
        if not name:
            raise ValueError('Name is required')
        if Subscription.objects.filter(organization=organization, name=name).exists():
            return  # Imports skip duplicate names; editing is an explicit UI action.
        limit = subscription_limit(organization)
        if limit is not None and organization.subscriptions.filter(status='active').count() >= limit:
            raise ValueError('Subscription limit reached')
        licenses = int(row.get(mapping.get('total_licenses', 'total_licenses')) or 1)
        if licenses < 1:
            raise ValueError('Licenses must be positive')
        total = Decimal(str(row.get(mapping.get('monthly_cost', 'monthly_cost')) or 0))
        if not total.is_finite() or total < 0:
            raise ValueError('Cost must be a nonnegative number')
        payload = {'name': name, 'status': row.get(mapping.get('status', 'status')) or 'active', 'billing_cycle': row.get(mapping.get('billing_cycle', 'billing_cycle')) or 'monthly', 'cost_per_unit': str((total / licenses).quantize(Decimal('0.01'))), 'total_licenses': licenses, 'currency': row.get(mapping.get('currency', 'currency')) or 'USD'}
        from types import SimpleNamespace
        serializer = SubscriptionCreateSerializer(data=payload, context={'request': SimpleNamespace(user=SimpleNamespace(organization=organization, organization_id=organization.pk))})
        serializer.is_valid(raise_exception=True)
        vendor_name = row.get(mapping.get('vendor', 'vendor'))
        vendor = SoftwareVendor.objects.get_or_create(name=vendor_name)[0] if vendor_name else None
        serializer.save(organization=organization, vendor=vendor)


def import_user(organization, row, mapping):
    """Import a user row"""
    from users.models import User
    
    email = row.get(mapping.get('email', 'email'))
    if not email:
        raise ValueError("Email is required")
    
    if User.objects.filter(email=email).exclude(organization=organization).exists():
        raise ValueError('User belongs to another organization')
    User.objects.update_or_create(
        email=email,
        defaults={
            'organization': organization,
            'first_name': row.get(mapping.get('first_name', 'first_name'), ''),
            'last_name': row.get(mapping.get('last_name', 'last_name'), ''),
            'is_active': True
        }
    )


def import_usage(organization, row, mapping):
    """Import usage data row"""
    from services.models import Subscription, UsageEvent
    
    subscription_name = row.get(mapping.get('subscription', 'subscription'))
    if not subscription_name:
        raise ValueError("Subscription is required")
    
    subscription = Subscription.objects.get(
        organization=organization,
        name=subscription_name
    )
    
    UsageEvent.objects.create(
        subscription=subscription,
        event_type=row.get(mapping.get('event_type', 'event_type'), 'usage'),
        timestamp=row.get(mapping.get('timestamp', 'timestamp')),
        event_data=row
    )


@shared_task
def cleanup_old_data(organization_id):
    """Clean up old data based on retention policy"""
    from users.models import Organization
    from services.models import UsageEvent, UsageMetrics
    from users.models import AuditLog
    from backups.models import DataExport
    
    try:
        org = Organization.objects.get(id=organization_id)
        
        # Usage data (default 365 days)
        usage_retention = getattr(org, 'retention_usage_days', 365)
        usage_threshold = timezone.now() - timezone.timedelta(days=usage_retention)
        
        deleted_events, _ = UsageEvent.objects.filter(
            subscription__organization=org,
            timestamp__lt=usage_threshold
        ).delete()
        
        deleted_metrics, _ = UsageMetrics.objects.filter(
            subscription__organization=org,
            period_start__lt=usage_threshold.date()
        ).delete()
        
        # Audit logs (default 365 days)
        audit_retention = getattr(org, 'retention_audit_days', 365)
        audit_threshold = timezone.now() - timezone.timedelta(days=audit_retention)
        
        deleted_audit, _ = AuditLog.objects.filter(
            organization=org,
            created_at__lt=audit_threshold
        ).delete()
        
        # Expired exports
        deleted_exports, _ = DataExport.objects.filter(
            organization=org,
            download_expires_at__lt=timezone.now()
        ).delete()
        
        logger.info(
            f"Cleanup for {org.name}: "
            f"events={deleted_events}, metrics={deleted_metrics}, "
            f"audit={deleted_audit}, exports={deleted_exports}"
        )
        
    except Organization.DoesNotExist:
        logger.error(f"Organization {organization_id} not found")


@shared_task
def run_scheduled_backups():
    """Check and run scheduled backups"""
    from backups.models import BackupSchedule, Backup
    
    now = timezone.now()
    
    schedules = BackupSchedule.objects.filter(
        is_active=True,
        next_backup__lte=now
    )
    
    for schedule in schedules:
        # Create backup
        backup = Backup.objects.create(
            schedule=schedule, organization=schedule.organization, name=f'Workspace snapshot {timezone.now().isoformat()}',
            status='pending'
        )
        
        # Trigger backup task
        run_backup.delay(str(backup.id))
        
        # Calculate next run
        schedule.next_backup = calculate_next_run(schedule)
        schedule.save()
    
    logger.info(f"Triggered {schedules.count()} scheduled backups")


def calculate_next_run(schedule):
    """UTC schedule, including short months and a future time later today."""
    import calendar
    now = timezone.now()
    if schedule.frequency == 'hourly':
        return now.replace(minute=0, second=0, microsecond=0) + timezone.timedelta(hours=1)
    candidate = now.replace(hour=schedule.schedule_time.hour, minute=schedule.schedule_time.minute, second=0, microsecond=0)
    if schedule.frequency == 'daily':
        return candidate if candidate > now else candidate + timezone.timedelta(days=1)
    if schedule.frequency == 'weekly':
        candidate += timezone.timedelta(days=((schedule.schedule_day_of_week or 0) - now.weekday()) % 7)
        return candidate if candidate > now else candidate + timezone.timedelta(days=7)
    if schedule.frequency == 'monthly':
        year, month = now.year, now.month
        for _ in range(2):
            day = min(schedule.schedule_day_of_month or 1, calendar.monthrange(year, month)[1])
            candidate = candidate.replace(year=year, month=month, day=day)
            if candidate > now:
                return candidate
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return None
