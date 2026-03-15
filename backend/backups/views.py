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
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=True, methods=['post'])
    def run_now(self, request, pk=None):
        """Trigger immediate backup"""
        schedule = self.get_object()
        
        # Create backup record
        backup = Backup.objects.create(
            schedule=schedule,
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
            schedule__organization=self.request.user.organization
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
                'frequency': 'manual',
                'is_active': False,
                'retention_days': 30
            }
        )
        
        backup = Backup.objects.create(
            schedule=schedule,
            status='pending',
            started_at=timezone.now(),
            metadata={
                'include_attachments': serializer.validated_data.get('include_attachments', True),
                'description': serializer.validated_data.get('description', ''),
                'triggered_by': str(request.user.id)
            }
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
            action='export',
            resource_type='Backup',
            resource_id=str(backup.id),
            resource_details={'file_path': backup.file_path},
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
        
        # Build filters from request
        filters = {}
        if serializer.validated_data.get('date_from'):
            filters['date_from'] = str(serializer.validated_data['date_from'])
        if serializer.validated_data.get('date_to'):
            filters['date_to'] = str(serializer.validated_data['date_to'])
        
        export = DataExport.objects.create(
            organization=request.user.organization,
            requested_by=request.user,
            format=serializer.validated_data['format'],
            data_types=serializer.validated_data.get('data_types', []),
            filters=filters,
            status='pending'
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
        
        if export.status != 'completed':
            return Response(
                {'error': 'Export is not complete'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if export.expires_at and export.expires_at < timezone.now():
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
        export.save()
        
        # Log the download
        from security.models import DataAccessLog
        DataAccessLog.objects.create(
            user=request.user,
            action='export',
            resource_type='DataExport',
            resource_id=str(export.id),
            resource_details={'format': export.format},
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Set content type based on format
        content_types = {
            'csv': 'text/csv',
            'json': 'application/json',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        }
        content_type = content_types.get(export.format, 'application/octet-stream')
        
        response = FileResponse(
            open(export.file_path, 'rb'),
            as_attachment=True,
            filename=os.path.basename(export.file_path),
            content_type=content_type
        )
        
        return response


class ImportJobViewSet(viewsets.ModelViewSet):
    """ViewSet for import jobs"""
    
    serializer_class = ImportJobSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return ImportJob.objects.filter(
            organization=self.request.user.organization
        ).select_related('uploaded_by').order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        serializer = ImportJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        uploaded_file = serializer.validated_data['file']
        
        # Save file temporarily
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(uploaded_file.name)[1]) as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)
            temp_path = f.name
        
        import_job = ImportJob.objects.create(
            organization=request.user.organization,
            uploaded_by=request.user,
            file_name=uploaded_file.name,
            file_size=uploaded_file.size,
            import_type=serializer.validated_data['import_type'],
            mapping=serializer.validated_data.get('mapping', {}),
            status='pending'
        )
        
        # Store temp path in metadata
        import_job.metadata = {'temp_path': temp_path}
        import_job.save()
        
        # Trigger async import task
        from backups.tasks import run_import_job
        run_import_job.delay(str(import_job.id))
        
        response_serializer = ImportJobSerializer(import_job)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Preview import data"""
        import_job = self.get_object()
        
        if import_job.status not in ['pending', 'validating']:
            return Response(
                {'error': 'Cannot preview after import has started'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse and return preview data
        from backups.utils import parse_import_file
        
        temp_path = import_job.metadata.get('temp_path') if import_job.metadata else None
        if not temp_path or not os.path.exists(temp_path):
            return Response(
                {'error': 'Import file not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            preview_data = parse_import_file(
                temp_path,
                import_job.import_type,
                limit=10
            )
            return Response(preview_data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start import job after preview/mapping"""
        import_job = self.get_object()
        
        if import_job.status != 'pending':
            return Response(
                {'error': 'Import already started'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update mapping if provided
        if 'mapping' in request.data:
            import_job.mapping = request.data['mapping']
            import_job.save()
        
        # Start import
        from backups.tasks import run_import_job
        run_import_job.delay(str(import_job.id))
        
        return Response({'message': 'Import started'})
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel import job"""
        import_job = self.get_object()
        
        if import_job.status not in ['pending', 'validating', 'processing']:
            return Response(
                {'error': 'Cannot cancel completed import'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        import_job.status = 'cancelled'
        import_job.save()
        
        # Clean up temp file
        if import_job.metadata and 'temp_path' in import_job.metadata:
            temp_path = import_job.metadata['temp_path']
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
        return Response({'message': 'Import cancelled'})


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
