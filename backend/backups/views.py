"""
Views for backups app
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.http import FileResponse
import os

from backups.models import BackupSchedule, Backup, DataExport, ImportJob
from backups.serializers import (
    BackupScheduleSerializer, BackupSerializer, BackupCreateSerializer,
    DataExportSerializer, DataExportCreateSerializer,
    ImportJobSerializer, ImportJobCreateSerializer,
    BackupRestoreSerializer
)
from api.permissions import IsAdmin


class BackupScheduleViewSet(viewsets.ModelViewSet):
    """ViewSet for backup schedules"""
    
    serializer_class = BackupScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return BackupSchedule.objects.filter(
            organization=self.request.user.organization
        )
    
    def perform_create(self, serializer):
        schedule = serializer.save(organization=self.request.user.organization)
        from backups.tasks import calculate_next_run
        schedule.next_backup = calculate_next_run(schedule)
        schedule.save(update_fields=['next_backup'])
    
    def perform_update(self, serializer):
        schedule = serializer.save()
        from backups.tasks import calculate_next_run
        schedule.next_backup = calculate_next_run(schedule) if schedule.is_active else None
        schedule.save(update_fields=['next_backup'])

    @action(detail=True, methods=['post'])
    def run_now(self, request, pk=None):
        """Trigger immediate backup"""
        schedule = self.get_object()
        
        # Create backup record
        backup = Backup.objects.create(
            schedule=schedule, organization=request.user.organization, name=f'Workspace snapshot {timezone.now().isoformat()}', triggered_by='manual', triggered_by_user=request.user,
            status='pending',
            started_at=timezone.now()
        )
        
        # Trigger async backup task
        from backups.tasks import run_backup
        run_backup.delay(str(backup.id))
        
        return Response({
            'message': 'Backup started',
            'backup_id': str(backup.id)
        })


class BackupViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for backups"""
    
    serializer_class = BackupSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return Backup.objects.filter(
            organization=self.request.user.organization
        ).select_related('schedule').order_by('-created_at')
    
    @action(detail=False, methods=['post'])
    def create_manual(self, request):
        """Create a manual backup"""
        serializer = BackupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get or create a manual backup schedule
        schedule, _ = BackupSchedule.objects.get_or_create(
            organization=request.user.organization,
            name='Manual Backups',
            defaults={
                'frequency': 'daily', 'schedule_time': '02:00',
                'is_active': False,
                'retention_days': 30
            }
        )
        
        backup = Backup.objects.create(
            schedule=schedule, organization=request.user.organization, name=f'Workspace snapshot {timezone.now().isoformat()}', triggered_by='manual', triggered_by_user=request.user,
            status='pending',
            started_at=timezone.now(),

        )
        
        # Trigger async backup task
        from backups.tasks import run_backup
        run_backup.delay(str(backup.id))
        
        return Response({
            'message': 'Manual backup started',
            'backup_id': str(backup.id)
        })
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download backup file"""
        backup = self.get_object()
        
        if backup.status != 'completed':
            return Response(
                {'error': 'Backup is not complete'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not backup.file_path or not os.path.exists(backup.file_path):
            return Response(
                {'error': 'Backup file not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Log the download
        from security.models import DataAccessLog
        DataAccessLog.objects.create(
            user=request.user,
            organization=request.user.organization,
            access_type='export',
            resource_type='Backup',
            resource_id=str(backup.id),
            details={'file_path': backup.file_path},
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return FileResponse(
            open(backup.file_path, 'rb'),
            as_attachment=True,
            filename=os.path.basename(backup.file_path)
        )
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore from backup"""
        backup = self.get_object()
        
        serializer = BackupRestoreSerializer(data={
            'backup_id': pk,
            **request.data
        })
        serializer.is_valid(raise_exception=True)
        
        if backup.status != 'completed':
            return Response(
                {'error': 'Cannot restore from incomplete backup'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if backup.restore_status in ['pending', 'running']:
            return Response({'error': 'A restore is already in progress.'}, status=409)
        backup.restore_status = 'pending'
        backup.restore_error = ''
        backup.save(update_fields=['restore_status', 'restore_error'])
        # Trigger async restore task
        from backups.tasks import restore_backup
        result = restore_backup.delay(
            str(backup.id),
            serializer.validated_data.get('restore_options', {})
        )
        
        return Response({
            'message': 'Restore initiated',
            'task_id': result.id
        })
    
    @action(detail=True, methods=['delete'])
    def delete_backup(self, request, pk=None):
        """Delete a backup"""
        backup = self.get_object()
        
        # Delete file if exists
        if backup.file_path and os.path.exists(backup.file_path):
            os.remove(backup.file_path)
        
        backup.delete()
        
        return Response({'message': 'Backup deleted'})


class DataExportViewSet(viewsets.ModelViewSet):
    """ViewSet for data exports"""
    
    serializer_class = DataExportSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return DataExport.objects.filter(
            organization=self.request.user.organization
        ).select_related('requested_by').order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        serializer = DataExportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data_types = data.get('data_types') or ['subscriptions']

        filters = dict(data.get('filters') or {})
        if data.get('date_from'):
            filters['date_from'] = str(data['date_from'])
        if data.get('date_to'):
            filters['date_to'] = str(data['date_to'])

        type_map = {
            'subscriptions': DataExport.ExportType.SUBSCRIPTIONS,
            'usage': DataExport.ExportType.USAGE,
            'costs': DataExport.ExportType.COSTS,
            'recommendations': DataExport.ExportType.RECOMMENDATIONS,
        }
        if data.get('export_type'):
            export_type = data['export_type']
        elif len(data_types) == 1:
            export_type = type_map.get(data_types[0], DataExport.ExportType.CUSTOM)
        elif set(data_types) >= {
            'subscriptions', 'usage', 'costs', 'users', 'recommendations', 'alerts', 'audit_logs'
        }:
            export_type = DataExport.ExportType.FULL
        else:
            export_type = DataExport.ExportType.CUSTOM
        
        export = DataExport.objects.create(
            organization=request.user.organization,
            requested_by=request.user,
            export_type=export_type,
            format=data['format'],
            data_types=data_types,
            filters=filters,
            date_from=data.get('date_from'),
            date_to=data.get('date_to'),
            status=DataExport.Status.PENDING,
        )
        
        # Trigger async export task
        from backups.tasks import run_data_export
        run_data_export.delay(str(export.id))
        
        response_serializer = DataExportSerializer(export)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download export file"""
        export = self.get_object()
        
        if export.status != DataExport.Status.COMPLETED:
            return Response(
                {'error': 'Export is not complete'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if export.download_expires_at and export.download_expires_at < timezone.now():
            return Response(
                {'error': 'Export has expired'},
                status=status.HTTP_410_GONE
            )
        
        if not export.file_path or not os.path.exists(export.file_path):
            return Response(
                {'error': 'Export file not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update download count
        export.download_count += 1
        export.save(update_fields=['download_count'])
        
        # Log the download
        from security.models import DataAccessLog
        DataAccessLog.objects.create(
            user=request.user,
            organization=request.user.organization,
            access_type='export',
            resource_type='DataExport',
            resource_id=str(export.id),
            details={'format': export.format},
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Set content type based on format
        content_types = {
            'csv': 'text/csv',
            'json': 'application/json',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf',
        }
        content_type = content_types.get(export.format, 'application/octet-stream')
        
        response = FileResponse(
            open(export.file_path, 'rb'),
            as_attachment=True,
            filename=os.path.basename(export.file_path),
            content_type=content_type
        )
        
        return response


class ImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ImportJobSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get_queryset(self):
        return ImportJob.objects.filter(organization=self.request.user.organization).order_by('-created_at')
    def create(self, request, *args, **kwargs):
        serializer = ImportJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data['file']
        job = ImportJob.objects.create(organization=request.user.organization, initiated_by=request.user, source_file=uploaded, source_file_name=uploaded.name, file_size=uploaded.size, import_type=serializer.validated_data['import_type'], column_mapping=serializer.validated_data.get('mapping', {}), can_rollback=False)
        from backups.tasks import run_import_job
        run_import_job.delay(str(job.pk))
        job.refresh_from_db()
        return Response(ImportJobSerializer(job).data, status=status.HTTP_201_CREATED)


class DataRetentionView(APIView):
    """Data retention policy management"""
    
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        """Get current data retention settings"""
        org = request.user.organization
        
        # Get retention settings from organization or defaults
        retention = {
            'usage_data_days': getattr(org, 'retention_usage_days', 365),
            'audit_logs_days': getattr(org, 'retention_audit_days', 365),
            'backups_days': 90,
            'exports_days': 7,
            'notifications_days': 30
        }
        
        # Get current data counts
        from services.models import UsageEvent
        from users.models import AuditLog
        
        stats = {
            'usage_events_count': UsageEvent.objects.filter(
                subscription__organization=org
            ).count(),
            'audit_logs_count': AuditLog.objects.filter(
                organization=org
            ).count(),
            'backups_count': Backup.objects.filter(
                schedule__organization=org
            ).count(),
            'exports_count': DataExport.objects.filter(
                organization=org
            ).count()
        }
        
        return Response({
            'retention': retention,
            'stats': stats
        })
    
    def put(self, request):
        """Update data retention settings"""
        org = request.user.organization
        
        # Update retention settings
        if 'usage_data_days' in request.data:
            org.retention_usage_days = request.data['usage_data_days']
        if 'audit_logs_days' in request.data:
            org.retention_audit_days = request.data['audit_logs_days']
        
        org.save()
        
        return Response({'message': 'Retention settings updated'})
    
    def post(self, request):
        """Trigger data cleanup based on retention policy"""
        from backups.tasks import cleanup_old_data
        result = cleanup_old_data.delay(str(request.user.organization.id))
        
        return Response({
            'message': 'Cleanup initiated',
            'task_id': result.id
        })
