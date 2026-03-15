"""
Backup models for Subscription Waste Manager
Scheduled backups and data exports
"""

import uuid
from django.db import models
from users.models import Organization, User


class BackupSchedule(models.Model):
    """Scheduled backup configuration"""
    
    class Frequency(models.TextChoices):
        HOURLY = 'hourly', 'Hourly'
        DAILY = 'daily', 'Daily'
        WEEKLY = 'weekly', 'Weekly'
        MONTHLY = 'monthly', 'Monthly'
    
    class BackupType(models.TextChoices):
        FULL = 'full', 'Full Backup'
        INCREMENTAL = 'incremental', 'Incremental'
        DIFFERENTIAL = 'differential', 'Differential'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='backup_schedules')
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.DAILY)
    backup_type = models.CharField(max_length=20, choices=BackupType.choices, default=BackupType.FULL)
    
    # What to backup
    include_subscriptions = models.BooleanField(default=True)
    include_usage_data = models.BooleanField(default=True)
    include_cost_records = models.BooleanField(default=True)
    include_recommendations = models.BooleanField(default=True)
    include_workflows = models.BooleanField(default=True)
    include_integrations = models.BooleanField(default=False)  # Sensitive
    
    # Schedule details
    schedule_time = models.TimeField()  # Time of day for daily/weekly/monthly
    schedule_day_of_week = models.IntegerField(null=True, blank=True)  # 0-6 for weekly
    schedule_day_of_month = models.IntegerField(null=True, blank=True)  # 1-31 for monthly
    
    # Retention
    retention_days = models.IntegerField(default=30)
    max_backups = models.IntegerField(default=10)
    
    # Storage
    storage_location = models.CharField(max_length=255, default='s3')
    storage_path = models.CharField(max_length=500, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    last_backup = models.DateTimeField(blank=True, null=True)
    next_backup = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'backup_schedules'
        ordering = ['name']


class Backup(models.Model):
    """Individual backup records"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        EXPIRED = 'expired', 'Expired'
        DELETED = 'deleted', 'Deleted'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='backups')
    schedule = models.ForeignKey(BackupSchedule, on_delete=models.SET_NULL, null=True, blank=True, related_name='backups')
    
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Storage
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField(default=0)  # bytes
    checksum = models.CharField(max_length=64, blank=True)  # SHA-256
    
    # Content
    tables_backed_up = models.JSONField(default=list)
    record_counts = models.JSONField(default=dict)
    
    # Timing
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    
    # Error handling
    error_message = models.TextField(blank=True)
    
    # Who triggered
    triggered_by = models.CharField(max_length=50, default='scheduled')  # 'scheduled', 'manual', 'api'
    triggered_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'backups'
        ordering = ['-created_at']


class DataExport(models.Model):
    """Data export requests"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        EXPIRED = 'expired', 'Expired'
    
    class Format(models.TextChoices):
        JSON = 'json', 'JSON'
        CSV = 'csv', 'CSV'
        EXCEL = 'excel', 'Excel'
        PDF = 'pdf', 'PDF'
    
    class ExportType(models.TextChoices):
        SUBSCRIPTIONS = 'subscriptions', 'Subscriptions'
        USAGE = 'usage', 'Usage Data'
        COSTS = 'costs', 'Cost Records'
        RECOMMENDATIONS = 'recommendations', 'Recommendations'
        SAVINGS = 'savings', 'Savings Report'
        FULL = 'full', 'Full Export'
        CUSTOM = 'custom', 'Custom'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='data_exports')
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='data_exports')
    
    export_type = models.CharField(max_length=20, choices=ExportType.choices)
    format = models.CharField(max_length=10, choices=Format.choices, default=Format.CSV)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Filters
    filters = models.JSONField(default=dict, blank=True)
    date_from = models.DateField(blank=True, null=True)
    date_to = models.DateField(blank=True, null=True)
    
    # Output
    file_path = models.CharField(max_length=500, blank=True)
    file_size = models.BigIntegerField(default=0)
    download_url = models.URLField(blank=True)
    download_expires_at = models.DateTimeField(blank=True, null=True)
    
    # Progress
    progress = models.IntegerField(default=0)  # 0-100
    records_exported = models.IntegerField(default=0)
    
    # Timing
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'data_exports'
        ordering = ['-created_at']


class ImportJob(models.Model):
    """Data import jobs"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        VALIDATING = 'validating', 'Validating'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        ROLLED_BACK = 'rolled_back', 'Rolled Back'
    
    class ImportType(models.TextChoices):
        SUBSCRIPTIONS = 'subscriptions', 'Subscriptions'
        USERS = 'users', 'Users'
        COST_RECORDS = 'cost_records', 'Cost Records'
        MIXED = 'mixed', 'Mixed Data'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='import_jobs')
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='import_jobs')
    
    import_type = models.CharField(max_length=20, choices=ImportType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Input file
    source_file = models.FileField(upload_to='imports/')
    source_file_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField(default=0)
    
    # Mapping
    column_mapping = models.JSONField(default=dict, blank=True)
    
    # Progress
    total_rows = models.IntegerField(default=0)
    processed_rows = models.IntegerField(default=0)
    successful_rows = models.IntegerField(default=0)
    failed_rows = models.IntegerField(default=0)
    
    # Errors
    validation_errors = models.JSONField(default=list, blank=True)
    processing_errors = models.JSONField(default=list, blank=True)
    
    # Timing
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    # Rollback info
    can_rollback = models.BooleanField(default=True)
    rollback_data = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'import_jobs'
        ordering = ['-created_at']
