"""
API URL configuration for Subscription Waste Manager
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from services.views import (
    SoftwareVendorViewSet, SubscriptionViewSet,
    UsageEventViewSet, UsageMetricsViewSet, CostRecordViewSet,
    RedundancyGroupViewSet, RecommendationViewSet,
    AlertViewSet, WorkflowViewSet,
    SavingsReportViewSet, BudgetTargetViewSet,
    DashboardView, SpendAnalyticsView, SpendTrendView
)
from integrations.views import (
    IntegrationViewSet, BankAccountViewSet,
    BankTransactionViewSet, WebhookViewSet
)
from security.views import APIKeyViewSet
from backups.views import BackupViewSet, DataExportViewSet

# Create router
router = DefaultRouter()

# Services routes
router.register(r'vendors', SoftwareVendorViewSet, basename='vendor')
router.register(r'subscriptions', SubscriptionViewSet, basename='subscription')
router.register(r'usage-events', UsageEventViewSet, basename='usage-event')
router.register(r'usage-metrics', UsageMetricsViewSet, basename='usage-metric')
router.register(r'cost-records', CostRecordViewSet, basename='cost-record')
router.register(r'redundancies', RedundancyGroupViewSet, basename='redundancy')
router.register(r'recommendations', RecommendationViewSet, basename='recommendation')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'workflows', WorkflowViewSet, basename='workflow')
router.register(r'savings-reports', SavingsReportViewSet, basename='savings-report')
router.register(r'budgets', BudgetTargetViewSet, basename='budget')

# Integrations routes
router.register(r'integrations', IntegrationViewSet, basename='integration')
router.register(r'bank-accounts', BankAccountViewSet, basename='bank-account')
router.register(r'transactions', BankTransactionViewSet, basename='transaction')
router.register(r'webhooks', WebhookViewSet, basename='webhook')

# Security routes
router.register(r'api-keys', APIKeyViewSet, basename='api-key')

# Backup routes
router.register(r'backups', BackupViewSet, basename='backup')
router.register(r'exports', DataExportViewSet, basename='export')

urlpatterns = [
    # Router URLs
    path('', include(router.urls)),
    
    # Dashboard & Analytics
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('analytics/spend/', SpendAnalyticsView.as_view(), name='spend-analytics'),
    path('analytics/trend/', SpendTrendView.as_view(), name='spend-trend'),
]
