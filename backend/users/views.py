"""
User views for Subscription Waste Manager
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from users.models import (
    User, Organization, Department, Team, Role,
    UserInvitation, AuditLog, Notification
)
from users.serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    OrganizationSerializer, OrganizationCreateSerializer,
    DepartmentSerializer, TeamSerializer, RoleSerializer,
    UserInvitationSerializer, UserInvitationCreateSerializer,
    ChangePasswordSerializer, AuditLogSerializer, NotificationSerializer
)
from api.permissions import IsAdmin


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token view with additional user claims"""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """User registration endpoint"""
    serializer_class = UserCreateSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class RegisterWithOrganizationView(generics.CreateAPIView):
    """Register user and create organization"""
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        # Create user
        user_data = {
            'email': request.data.get('email'),
            'password': request.data.get('password'),
            'password_confirm': request.data.get('password_confirm'),
            'first_name': request.data.get('first_name', ''),
            'last_name': request.data.get('last_name', ''),
        }
        user_serializer = UserCreateSerializer(data=user_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()
        
        # Create organization
        org_data = {
            'name': request.data.get('organization_name'),
            'domain': request.data.get('domain', ''),
            'default_currency': request.data.get('currency', 'USD'),
        }
        org_serializer = OrganizationCreateSerializer(data=org_data)
        org_serializer.is_valid(raise_exception=True)
        organization = org_serializer.save()
        
        # Create admin role
        admin_role = Role.objects.create(
            organization=organization,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True,
            permissions={'full_access': True}
        )
        
        # Create other default roles
        for role_type, role_name in [
            (Role.RoleType.FINANCE, 'Finance'),
            (Role.RoleType.DEPARTMENT_LEAD, 'Department Lead'),
            (Role.RoleType.MEMBER, 'Member'),
            (Role.RoleType.VIEWER, 'Viewer'),
        ]:
            Role.objects.create(
                organization=organization,
                name=role_name,
                type=role_type,
                is_system_role=True
            )
        
        # Assign user to organization as admin
        user.organization = organization
        user.role = admin_role
        user.is_verified = True
        user.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'organization': OrganizationSerializer(organization).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class AcceptInvitationView(generics.CreateAPIView):
    """Accept user invitation and create account"""
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        token = request.data.get('token')
        
        try:
            invitation = UserInvitation.objects.get(token=token, status='pending')
        except UserInvitation.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired invitation'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if invitation.is_expired:
            invitation.status = 'expired'
            invitation.save()
            return Response(
                {'error': 'Invitation has expired'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user
        user_data = {
            'email': invitation.email,
            'password': request.data.get('password'),
            'password_confirm': request.data.get('password_confirm'),
            'first_name': request.data.get('first_name', ''),
            'last_name': request.data.get('last_name', ''),
        }
        serializer = UserCreateSerializer(data=user_data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Assign to organization
        user.organization = invitation.organization
        user.role = invitation.role
        user.department = invitation.department
        user.team = invitation.team
        user.is_verified = True
        user.save()
        
        # Update invitation
        invitation.status = 'accepted'
        invitation.accepted_at = timezone.now()
        invitation.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class MeView(generics.RetrieveUpdateAPIView):
    """Current user profile endpoint"""
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'PUT' or self.request.method == 'PATCH':
            return UserUpdateSerializer
        return UserSerializer
    
    def get_object(self):
        return self.request.user
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        
        return Response({'message': 'Password changed successfully'})


class ChangePasswordView(generics.GenericAPIView):
    """Change password endpoint"""
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer
    
    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        
        return Response({'message': 'Password changed successfully'})


class OrganizationViewSet(viewsets.ModelViewSet):
    """Organization management viewset"""
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return Organization.objects.filter(id=self.request.user.organization_id)
    
    def get_object(self):
        return self.request.user.organization
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current organization"""
        serializer = self.get_serializer(request.user.organization)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get organization statistics"""
        org = request.user.organization
        
        return Response({
            'users': org.users.filter(is_active=True).count(),
            'departments': org.departments.count(),
            'teams': org.teams.count(),
            'subscriptions': org.subscriptions.filter(status='active').count(),
            'integrations': org.integrations.filter(status='connected').count(),
        })


class DepartmentViewSet(viewsets.ModelViewSet):
    """Department management viewset"""
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'created_at']
    
    def get_queryset(self):
        return Department.objects.filter(organization=self.request.user.organization)
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class TeamViewSet(viewsets.ModelViewSet):
    """Team management viewset"""
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['department']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    
    def get_queryset(self):
        return Team.objects.filter(organization=self.request.user.organization)
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class RoleViewSet(viewsets.ModelViewSet):
    """Role management viewset"""
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return Role.objects.filter(organization=self.request.user.organization)
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system_role:
            return Response(
                {'error': 'Cannot delete system roles'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class UserViewSet(viewsets.ModelViewSet):
    """User management viewset"""
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['department', 'team', 'role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering_fields = ['email', 'date_joined', 'last_activity']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_queryset(self):
        return User.objects.filter(organization=self.request.user.organization)
    
    def perform_create(self, serializer):
        user = serializer.save()
        user.organization = self.request.user.organization
        user.save()
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user"""
        user = self.get_object()
        if user == request.user:
            return Response(
                {'error': 'Cannot deactivate yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.is_active = False
        user.save()
        return Response({'message': 'User deactivated'})
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user"""
        user = self.get_object()
        user.is_active = True
        user.save()
        return Response({'message': 'User activated'})


class UserInvitationViewSet(viewsets.ModelViewSet):
    """User invitation viewset"""
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status']
    search_fields = ['email']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserInvitationCreateSerializer
        return UserInvitationSerializer
    
    def get_queryset(self):
        return UserInvitation.objects.filter(organization=self.request.user.organization)
    
    def perform_create(self, serializer):
        invitation = serializer.save()
        
        # Send invitation email
        invite_url = f"{settings.FRONTEND_URL}/invite/{invitation.token}"
        send_mail(
            subject=f"You've been invited to join {invitation.organization.name} on SWM",
            message=f"""
            Hello,
            
            {invitation.invited_by.full_name} has invited you to join {invitation.organization.name} 
            on Subscription Waste Manager.
            
            Click the link below to accept the invitation:
            {invite_url}
            
            This invitation expires on {invitation.expires_at.strftime('%B %d, %Y')}.
            
            Best regards,
            The SWM Team
            """,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            fail_silently=True,
        )
    
    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        """Resend invitation email"""
        invitation = self.get_object()
        
        if invitation.status != 'pending':
            return Response(
                {'error': 'Can only resend pending invitations'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extend expiration
        invitation.expires_at = timezone.now() + timezone.timedelta(days=7)
        invitation.save()
        
        # Resend email
        invite_url = f"{settings.FRONTEND_URL}/invite/{invitation.token}"
        send_mail(
            subject=f"Reminder: You've been invited to join {invitation.organization.name}",
            message=f"""
            Hello,
            
            This is a reminder that {invitation.invited_by.full_name} has invited you to join 
            {invitation.organization.name} on Subscription Waste Manager.
            
            Click the link below to accept the invitation:
            {invite_url}
            
            This invitation expires on {invitation.expires_at.strftime('%B %d, %Y')}.
            
            Best regards,
            The SWM Team
            """,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            fail_silently=True,
        )
        
        return Response({'message': 'Invitation resent'})
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel invitation"""
        invitation = self.get_object()
        
        if invitation.status != 'pending':
            return Response(
                {'error': 'Can only cancel pending invitations'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invitation.status = 'cancelled'
        invitation.save()
        
        return Response({'message': 'Invitation cancelled'})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit log viewset (read-only)"""
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['user', 'action', 'resource_type']
    search_fields = ['action', 'resource_type', 'resource_id']
    ordering_fields = ['created_at']
    
    def get_queryset(self):
        return AuditLog.objects.filter(organization=self.request.user.organization)


class NotificationViewSet(viewsets.ModelViewSet):
    """Notification viewset"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['type', 'is_read']
    ordering_fields = ['created_at']
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        self.get_queryset().filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({'message': 'All notifications marked as read'})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark notification as read"""
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        return Response({'message': 'Notification marked as read'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get unread notification count"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})
