"""
URLs for integrations app
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from integrations.views import (
    IntegrationViewSet, BankAccountViewSet, BankTransactionViewSet,
    WebhookViewSet, SSOConnectionViewSet, SlackNotificationViewSet,
    EmailScanConfigViewSet, GoogleOAuthSetupView, GoogleOAuthCallbackView,
    MicrosoftOAuthSetupView, MicrosoftOAuthCallbackView,
    SlackConnectView, OktaConnectView, AzureADConnectView,
    TeamsConnectView, QuickBooksOAuthSetupView, QuickBooksOAuthCallbackView,
    XeroOAuthSetupView, XeroOAuthCallbackView,
    WorkdayOAuthSetupView, WorkdayOAuthCallbackView,
    BambooHROAuthSetupView, BambooHROAuthCallbackView,
    GustoOAuthSetupView, GustoOAuthCallbackView,
    RipplingOAuthSetupView, RipplingOAuthCallbackView,
    ConcurOAuthSetupView, ConcurOAuthCallbackView,
    ExpensifyOAuthSetupView, ExpensifyOAuthCallbackView,
    BrexOAuthSetupView, BrexOAuthCallbackView,
    RampOAuthSetupView, RampOAuthCallbackView,
    OneLoginOAuthSetupView, OneLoginOAuthCallbackView,
    JumpCloudOAuthSetupView, JumpCloudOAuthCallbackView,
)

router = DefaultRouter()
router.register(r'bank-accounts', BankAccountViewSet, basename='bank-account')
router.register(r'transactions', BankTransactionViewSet, basename='transaction')
router.register(r'webhooks', WebhookViewSet, basename='webhook')
router.register(r'sso', SSOConnectionViewSet, basename='sso')
router.register(r'slack', SlackNotificationViewSet, basename='slack')
router.register(r'email-scan', EmailScanConfigViewSet, basename='email-scan')
router.register(r'', IntegrationViewSet, basename='integration')

urlpatterns = [
    # OAuth setup
    path('google/setup/', GoogleOAuthSetupView.as_view(), name='google-oauth-setup'),
    path('google/callback/', GoogleOAuthCallbackView.as_view(), name='google-oauth-callback'),
    path('microsoft/setup/', MicrosoftOAuthSetupView.as_view(), name='microsoft-oauth-setup'),
    path('microsoft/callback/', MicrosoftOAuthCallbackView.as_view(), name='microsoft-oauth-callback'),
    path('slack/connect/', SlackConnectView.as_view(), name='slack-connect'),
    path('teams/connect/', TeamsConnectView.as_view(), name='teams-connect'),
    path('okta/connect/', OktaConnectView.as_view(), name='okta-connect'),
    path('azure-ad/connect/', AzureADConnectView.as_view(), name='azure-ad-connect'),
    path('quickbooks/setup/', QuickBooksOAuthSetupView.as_view(), name='quickbooks-oauth-setup'),
    path('quickbooks/callback/', QuickBooksOAuthCallbackView.as_view(), name='quickbooks-oauth-callback'),
    path('xero/setup/', XeroOAuthSetupView.as_view(), name='xero-oauth-setup'),
    path('xero/callback/', XeroOAuthCallbackView.as_view(), name='xero-oauth-callback'),
    path('workday/setup/', WorkdayOAuthSetupView.as_view(), name='workday-oauth-setup'),
    path('workday/callback/', WorkdayOAuthCallbackView.as_view(), name='workday-oauth-callback'),
    path('bamboohr/setup/', BambooHROAuthSetupView.as_view(), name='bamboohr-oauth-setup'),
    path('bamboohr/callback/', BambooHROAuthCallbackView.as_view(), name='bamboohr-oauth-callback'),
    path('gusto/setup/', GustoOAuthSetupView.as_view(), name='gusto-oauth-setup'),
    path('gusto/callback/', GustoOAuthCallbackView.as_view(), name='gusto-oauth-callback'),
    path('rippling/setup/', RipplingOAuthSetupView.as_view(), name='rippling-oauth-setup'),
    path('rippling/callback/', RipplingOAuthCallbackView.as_view(), name='rippling-oauth-callback'),
    path('concur/setup/', ConcurOAuthSetupView.as_view(), name='concur-oauth-setup'),
    path('concur/callback/', ConcurOAuthCallbackView.as_view(), name='concur-oauth-callback'),
    path('expensify/setup/', ExpensifyOAuthSetupView.as_view(), name='expensify-oauth-setup'),
    path('expensify/callback/', ExpensifyOAuthCallbackView.as_view(), name='expensify-oauth-callback'),
    path('brex/setup/', BrexOAuthSetupView.as_view(), name='brex-oauth-setup'),
    path('brex/callback/', BrexOAuthCallbackView.as_view(), name='brex-oauth-callback'),
    path('ramp/setup/', RampOAuthSetupView.as_view(), name='ramp-oauth-setup'),
    path('ramp/callback/', RampOAuthCallbackView.as_view(), name='ramp-oauth-callback'),
    path('onelogin/setup/', OneLoginOAuthSetupView.as_view(), name='onelogin-oauth-setup'),
    path('onelogin/callback/', OneLoginOAuthCallbackView.as_view(), name='onelogin-oauth-callback'),
    path('jumpcloud/setup/', JumpCloudOAuthSetupView.as_view(), name='jumpcloud-oauth-setup'),
    path('jumpcloud/callback/', JumpCloudOAuthCallbackView.as_view(), name='jumpcloud-oauth-callback'),
    # Router URLs
    path('', include(router.urls)),
]
