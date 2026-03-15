"""
Serializers for backups app
"""

from rest_framework import serializers
from backups.models import BackupSchedule, Backup, DataExport, ImportJob


class BackupScheduleSerializer(serializers.ModelSerializer):
    """Backup schedule serializer"""
    
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    retention_days_display = serializers.SerializerMethodField()
    
    class Meta:
        model = BackupSchedule
        fields = [
            'id', 'organization', 'name', 'frequency', 'frequency_display',
            'time_of_day', 'day_of_week', 'day_of_month',
            'retention_days', 'retention_days_display',
            'include_attachments', 'storage_location', 'encryption_key_id',
            'is_active', 'last_run_at', 'next_run_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['organization', 'last_run_at', 'next_run_at', 'created_at', 'updated_at']
    
    def get_retention_days_display(self, obj):
        if obj.retention_days == 0:
            return 'Forever'
        elif obj.retention_days == 1:
            return '1 day'
        return f'{obj.retention_days} days'


class BackupSerializer(serializers.ModelSerializer):
    """Backup serializer"""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    size_display = serializers.SerializerMethodField()
    schedule_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Backup
        fields = [
            'id', 'schedule', 'schedule_name', 'status', 'status_display',
            'started_at', 'completed_at', 'file_path', 'file_size',
            'size_display', 'checksum', 'is_encrypted', 'metadata',
            'error_message', 'created_at'
        ]
        read_only_fields = ['__all__']
    
    def get_size_display(self, obj):
        if not obj.file_size:
            return 'Unknown'
        
        size = obj.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f'{size:.1f} {unit}'
            size /= 1024
        return f'{size:.1f} PB'
    
    def get_schedule_name(self, obj):
        if obj.schedule:
            return obj.schedule.name
        return 'Manual backup'


class BackupCreateSerializer(serializers.Serializer):
    """Serializer for creating manual backup"""
    
    include_attachments = serializers.BooleanField(default=True)
    description = serializers.CharField(required=False, allow_blank=True)


class DataExportSerializer(serializers.ModelSerializer):
    """Data export serializer"""
    
    format_display = serializers.CharField(source='get_format_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    size_display = serializers.SerializerMethodField()
    
    class Meta:
        model = DataExport
        fields = [
            'id', 'organization', 'requested_by', 'format', 'format_display',
            'data_types', 'filters', 'status', 'status_display',
            'started_at', 'completed_at', 'file_path', 'file_size',
            'size_display', 'download_url', 'expires_at', 'download_count',
            'error_message', 'created_at'
        ]
        read_only_fields = [
            'organization', 'requested_by', 'status', 'started_at', 'completed_at',
            'file_path', 'file_size', 'download_url', 'expires_at', 'download_count',
            'error_message', 'created_at'
        ]
    
    def get_size_display(self, obj):
        if not obj.file_size:
            return 'Unknown'
        
        size = obj.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f'{size:.1f} {unit}'
            size /= 1024
        return f'{size:.1f} PB'


class DataExportCreateSerializer(serializers.Serializer):
    """Serializer for creating data export"""
    
    format = serializers.ChoiceField(choices=DataExport.Format.choices)
    data_types = serializers.ListField(
        child=serializers.ChoiceField(choices=[
            ('subscriptions', 'Subscriptions'),
            ('usage', 'Usage Data'),
            ('costs', 'Cost Records'),
            ('users', 'Users'),
            ('recommendations', 'Recommendations'),
            ('alerts', 'Alerts'),
            ('audit_logs', 'Audit Logs'),
        ]),
        required=False
    )
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)


class ImportJobSerializer(serializers.ModelSerializer):
    """Import job serializer"""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ImportJob
        fields = [
            'id', 'organization', 'uploaded_by', 'file_name', 'file_size',
            'import_type', 'status', 'status_display',
            'total_rows', 'processed_rows', 'success_count', 'error_count',
            'errors', 'mapping', 'started_at', 'completed_at', 'created_at'
        ]
        read_only_fields = [
            'organization', 'uploaded_by', 'status', 'total_rows', 'processed_rows',
            'success_count', 'error_count', 'errors', 'started_at', 'completed_at', 'created_at'
        ]


class ImportJobCreateSerializer(serializers.Serializer):
    """Serializer for creating import job"""
    
    file = serializers.FileField()
    import_type = serializers.ChoiceField(choices=ImportJob.ImportType.choices)
    mapping = serializers.DictField(required=False)


class ImportMappingSerializer(serializers.Serializer):
    """Serializer for import field mapping"""
    
    source_field = serializers.CharField()
    target_field = serializers.CharField()
    transform = serializers.CharField(required=False, allow_blank=True)


class BackupRestoreSerializer(serializers.Serializer):
    """Serializer for backup restore"""
    
    backup_id = serializers.UUIDField()
    restore_options = serializers.DictField(required=False, default={})
    confirm = serializers.BooleanField(required=True)
    
    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError(
                'You must confirm the restore operation'
            )
        return value
