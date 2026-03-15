"""
URLs for backups app
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from backups.views import (
    BackupScheduleViewSet, BackupViewSet,
    DataExportViewSet, ImportJobViewSet,
    DataRetentionView
)

router = DefaultRouter()
router.register(r'schedules', BackupScheduleViewSet, basename='backup-schedule')
router.register(r'backups', BackupViewSet, basename='backup')
router.register(r'exports', DataExportViewSet, basename='export')
router.register(r'imports', ImportJobViewSet, basename='import')

urlpatterns = [
    # Data retention
    path('retention/', DataRetentionView.as_view(), name='data-retention'),
    
    # Router URLs
    path('', include(router.urls)),
]
