"""
Serializers for backups app
"""

from rest_framework import serializers
from backups.models import BackupSchedule, Backup, DataExport, ImportJob


class BackupScheduleSerializer(serializers.ModelSerializer):
    frequency = serializers.ChoiceField(choices=BackupSchedule.Frequency.choices)
    last_run = serializers.DateTimeField(source='last_backup', read_only=True)
    next_run = serializers.DateTimeField(source='next_backup', read_only=True)
    class Meta:
        model = BackupSchedule
        fields = ['id', 'name', 'frequency', 'retention_days', 'is_active', 'last_run', 'next_run', 'created_at']
    def validate_retention_days(self, value):
        if value < 1 or value > 3650:
            raise serializers.ValidationError('Choose a retention period from 1 to 3650 days.')
        return value
    def create(self, validated_data):
        from datetime import time
        return super().create({**validated_data, 'schedule_time': time(2), 'schedule_day_of_week': 0, 'schedule_day_of_month': 1, 'storage_location': 'local'})

class BackupSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source='triggered_by', read_only=True)
    file_name = serializers.CharField(source='name', read_only=True)
    schedule_id = serializers.UUIDField(read_only=True)
    class Meta:
        model = Backup
        fields = ['id', 'schedule_id', 'type', 'file_name', 'status', 'file_size', 'checksum', 'started_at', 'completed_at', 'error_message', 'created_at', 'restore_status', 'restore_error']
        read_only_fields = fields

class BackupCreateSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=True)


class DataExportSerializer(serializers.ModelSerializer):
    """Data export serializer"""
    
    format_display = serializers.CharField(source='get_format_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    expires_at = serializers.DateTimeField(source='download_expires_at', read_only=True)
    size_display = serializers.SerializerMethodField()
    
    class Meta:
        model = DataExport
        fields = [
            'id', 'organization', 'requested_by', 'export_type', 'format', 'format_display',
            'data_types', 'filters', 'date_from', 'date_to', 'status', 'status_display',
            'started_at', 'completed_at', 'file_path', 'file_size',
            'size_display', 'download_url', 'expires_at', 'download_count',
            'progress', 'records_exported', 'error_message', 'created_at'
        ]
        read_only_fields = [
            'organization', 'requested_by', 'export_type', 'status', 'started_at', 'completed_at',
            'file_path', 'file_size', 'download_url', 'expires_at', 'download_count',
            'progress', 'records_exported', 'error_message', 'created_at'
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

    FORMAT_ALIASES = {
        'xlsx': DataExport.Format.EXCEL,
        'xls': DataExport.Format.EXCEL,
    }
    DATA_TYPE_CHOICES = [
        ('subscriptions', 'Subscriptions'),
        ('usage', 'Usage Data'),
        ('costs', 'Cost Records'),
        ('users', 'Users'),
        ('recommendations', 'Recommendations'),
        ('alerts', 'Alerts'),
        ('audit_logs', 'Audit Logs'),
    ]
    
    format = serializers.ChoiceField(
        choices=list(DataExport.Format.choices) + [('xlsx', 'Excel (xlsx)'), ('xls', 'Excel (xls)')]
    )
    data_types = serializers.ListField(
        child=serializers.ChoiceField(choices=DATA_TYPE_CHOICES),
        required=False,
        allow_empty=True,
    )
    export_type = serializers.ChoiceField(
        choices=DataExport.ExportType.choices,
        required=False,
    )
    filters = serializers.DictField(required=False)
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)

    def validate_format(self, value):
        return self.FORMAT_ALIASES.get(value, value)

    def validate(self, attrs):
        data_types = attrs.get('data_types') or []
        filters = attrs.get('filters') or {}
        export_type = attrs.get('export_type')

        if not data_types and filters:
            include_map = {
                'include_subscriptions': 'subscriptions',
                'include_usage': 'usage',
                'include_costs': 'costs',
                'include_recommendations': 'recommendations',
                'include_users': 'users',
                'include_alerts': 'alerts',
                'include_audit_logs': 'audit_logs',
            }
            data_types = [
                key for flag, key in include_map.items()
                if filters.get(flag)
            ]

        if not data_types and export_type:
            type_to_data = {
                DataExport.ExportType.SUBSCRIPTIONS: ['subscriptions'],
                DataExport.ExportType.USAGE: ['usage'],
                DataExport.ExportType.COSTS: ['costs'],
                DataExport.ExportType.RECOMMENDATIONS: ['recommendations'],
                DataExport.ExportType.SAVINGS: ['costs', 'recommendations'],
                DataExport.ExportType.FULL: [
                    'subscriptions', 'usage', 'costs', 'users',
                    'recommendations', 'alerts', 'audit_logs',
                ],
                DataExport.ExportType.CUSTOM: ['subscriptions'],
            }
            data_types = type_to_data.get(export_type, ['subscriptions'])

        if not data_types:
            data_types = ['subscriptions']

        attrs['data_types'] = data_types
        attrs['filters'] = filters
        return attrs


class ImportJobSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    filename = serializers.CharField(source='source_file_name', read_only=True)
    error_count = serializers.IntegerField(source='failed_rows', read_only=True)
    errors = serializers.JSONField(source='processing_errors', read_only=True)
    field_mapping = serializers.JSONField(source='column_mapping', read_only=True)
    class Meta:
        model = ImportJob
        fields = ['id', 'import_type', 'filename', 'status', 'status_display', 'total_rows', 'processed_rows', 'successful_rows', 'failed_rows', 'error_count', 'errors', 'field_mapping', 'started_at', 'completed_at', 'created_at']
        read_only_fields = fields

class ImportJobCreateSerializer(serializers.Serializer):
    file = serializers.FileField()
    # Other import types are not exposed until they have safe, tested processors.
    import_type = serializers.ChoiceField(choices=[('subscriptions', 'Subscriptions')])
    mapping = serializers.DictField(child=serializers.CharField(), required=False)
    def validate_file(self, value):
        import os
        if os.path.splitext(value.name)[1].lower() not in ['.csv', '.json'] or value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Use a CSV or JSON file smaller than 5 MB.')
        return value


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
