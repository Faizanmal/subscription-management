"""
URLs for security app
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from security.views import (
    APIKeyViewSet, SecuritySettingViewSet, MFADeviceViewSet,
    LoginAttemptViewSet, SessionViewSet, DataAccessLogViewSet,
    PasswordResetRequestView, PasswordResetConfirmView,
    SecurityDashboardView
)

router = DefaultRouter()
router.register(r'api-keys', APIKeyViewSet, basename='api-key')
router.register(r'settings', SecuritySettingViewSet, basename='security-setting')
router.register(r'mfa', MFADeviceViewSet, basename='mfa-device')
router.register(r'login-attempts', LoginAttemptViewSet, basename='login-attempt')
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'access-logs', DataAccessLogViewSet, basename='access-log')

urlpatterns = [
    # Password reset
    path('password/reset/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Dashboard
    path('dashboard/', SecurityDashboardView.as_view(), name='security-dashboard'),
    
    # Router URLs
    path('', include(router.urls)),
]
