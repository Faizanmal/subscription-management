"""
User URL configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView

from users.views import (
    CustomTokenObtainPairView, RegisterView, RegisterWithOrganizationView,
    AcceptInvitationView, MeView, ChangePasswordView,
    OrganizationViewSet, DepartmentViewSet, TeamViewSet,
    RoleViewSet, UserViewSet, UserInvitationViewSet,
    AuditLogViewSet, NotificationViewSet
)

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'teams', TeamViewSet, basename='team')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'users', UserViewSet, basename='user')
router.register(r'invitations', UserInvitationViewSet, basename='invitation')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    # JWT Token endpoints
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/blacklist/', TokenBlacklistView.as_view(), name='token_blacklist'),
    
    # Registration
    path('register/', RegisterView.as_view(), name='register'),
    path('register/organization/', RegisterWithOrganizationView.as_view(), name='register_organization'),
    path('invite/accept/', AcceptInvitationView.as_view(), name='accept_invitation'),
    
    # Current user
    path('me/', MeView.as_view(), name='me'),
    path('me/password/', ChangePasswordView.as_view(), name='change_password'),
    
    # Router URLs
    path('', include(router.urls)),
]
