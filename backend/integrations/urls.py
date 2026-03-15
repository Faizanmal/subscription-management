"""
URLs for integrations app
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from integrations.views import (
    IntegrationViewSet, BankAccountViewSet, BankTransactionViewSet,
    WebhookViewSet, SSOConnectionViewSet, SlackNotificationViewSet,
    EmailScanConfigViewSet, GoogleOAuthSetupView, GoogleOAuthCallbackView,
    MicrosoftOAuthSetupView, MicrosoftOAuthCallbackView
)

router = DefaultRouter()
router.register(r'', IntegrationViewSet, basename='integration')
router.register(r'bank-accounts', BankAccountViewSet, basename='bank-account')
router.register(r'transactions', BankTransactionViewSet, basename='transaction')
router.register(r'webhooks', WebhookViewSet, basename='webhook')
router.register(r'sso', SSOConnectionViewSet, basename='sso')
router.register(r'slack', SlackNotificationViewSet, basename='slack')
router.register(r'email-scan', EmailScanConfigViewSet, basename='email-scan')

urlpatterns = [
    # OAuth setup
    path('google/setup/', GoogleOAuthSetupView.as_view(), name='google-oauth-setup'),
    path('google/callback/', GoogleOAuthCallbackView.as_view(), name='google-oauth-callback'),
    path('microsoft/setup/', MicrosoftOAuthSetupView.as_view(), name='microsoft-oauth-setup'),
    path('microsoft/callback/', MicrosoftOAuthCallbackView.as_view(), name='microsoft-oauth-callback'),
    
    # Router URLs
    path('', include(router.urls)),
]
