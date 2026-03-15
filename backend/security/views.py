"""
Views for security app
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
import pyotp
import qrcode
import io
import base64

from security.models import (
    APIKey, SecuritySetting, MFADevice,
    LoginAttempt, Session, DataAccessLog
)
from security.serializers import (
    APIKeySerializer, APIKeyCreateSerializer,
    SecuritySettingSerializer, MFADeviceSerializer,
    MFADeviceSetupSerializer, MFAVerifySerializer,
    LoginAttemptSerializer, SessionSerializer,
    DataAccessLogSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer
)
from api.permissions import IsAdmin


class APIKeyViewSet(viewsets.ModelViewSet):
    """ViewSet for managing API keys"""
    
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return APIKeyCreateSerializer
        return APIKeySerializer
    
    def get_queryset(self):
        return APIKey.objects.filter(
            organization=self.request.user.organization
        ).select_related('created_by')
    
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke an API key"""
        api_key = self.get_object()
        api_key.is_active = False
        api_key.save()
        
        # Log the action
        DataAccessLog.objects.create(
            user=request.user,
            action='delete',
            resource_type='APIKey',
            resource_id=str(api_key.id),
            resource_details={'name': api_key.name},
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response({'message': 'API key revoked successfully'})
    
    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """Regenerate an API key"""
        old_key = self.get_object()
        
        # Create new key with same settings
        new_key, raw_key = APIKey.generate_key(
            organization=old_key.organization,
            name=f"{old_key.name} (regenerated)",
            scope=old_key.scope,
            allowed_ips=old_key.allowed_ips,
            rate_limit=old_key.rate_limit,
            expires_at=old_key.expires_at,
            created_by=request.user
        )
        
        # Revoke old key
        old_key.is_active = False
        old_key.save()
        
        return Response({
            'message': 'API key regenerated',
            'id': str(new_key.id),
            'key': raw_key
        })


class SecuritySettingViewSet(viewsets.ModelViewSet):
    """ViewSet for security settings"""
    
    serializer_class = SecuritySettingSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return SecuritySetting.objects.filter(
            organization=self.request.user.organization
        )
    
    def get_object(self):
        """Get or create security settings for organization"""
        obj, created = SecuritySetting.objects.get_or_create(
            organization=self.request.user.organization,
            defaults={'updated_by': self.request.user}
        )
        return obj
    
    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class MFADeviceViewSet(viewsets.ModelViewSet):
    """ViewSet for MFA devices"""
    
    serializer_class = MFADeviceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return MFADevice.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def setup(self, request):
        """Setup a new MFA device"""
        serializer = MFADeviceSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        mfa_type = serializer.validated_data['type']
        
        if mfa_type == MFADevice.MFAType.TOTP:
            # Generate TOTP secret
            secret = pyotp.random_base32()
            totp = pyotp.TOTP(secret)
            
            # Create QR code
            provisioning_uri = totp.provisioning_uri(
                name=request.user.email,
                issuer_name="Subscription Waste Manager"
            )
            
            qr = qrcode.make(provisioning_uri)
            buffer = io.BytesIO()
            qr.save(buffer, format='PNG')
            qr_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            # Create unverified device
            device = MFADevice.objects.create(
                user=request.user,
                type=MFADevice.MFAType.TOTP,
                name=serializer.validated_data.get('name', 'Authenticator App'),
                secret_key=secret,
                is_verified=False
            )
            
            return Response({
                'device_id': str(device.id),
                'secret': secret,
                'qr_code': f"data:image/png;base64,{qr_base64}",
                'provisioning_uri': provisioning_uri
            })
        
        elif mfa_type == MFADevice.MFAType.SMS:
            phone_number = serializer.validated_data.get('phone_number')
            if not phone_number:
                return Response(
                    {'error': 'Phone number required for SMS MFA'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            device = MFADevice.objects.create(
                user=request.user,
                type=MFADevice.MFAType.SMS,
                name=serializer.validated_data.get('name', 'SMS'),
                phone_number=phone_number,
                is_verified=False
            )
            
            # Send verification code
            from security.tasks import send_mfa_code
            send_mfa_code.delay(str(device.id))
            
            return Response({
                'device_id': str(device.id),
                'message': 'Verification code sent to your phone'
            })
        
        elif mfa_type == MFADevice.MFAType.EMAIL:
            device = MFADevice.objects.create(
                user=request.user,
                type=MFADevice.MFAType.EMAIL,
                name=serializer.validated_data.get('name', 'Email'),
                is_verified=False
            )
            
            # Send verification code
            from security.tasks import send_mfa_code
            send_mfa_code.delay(str(device.id))
            
            return Response({
                'device_id': str(device.id),
                'message': f'Verification code sent to {request.user.email}'
            })
        
        return Response(
            {'error': 'Unsupported MFA type'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify MFA device with code"""
        device = self.get_object()
        
        serializer = MFAVerifySerializer(data={
            'device_id': pk,
            'code': request.data.get('code')
        })
        serializer.is_valid(raise_exception=True)
        
        code = serializer.validated_data['code']
        
        if device.type == MFADevice.MFAType.TOTP:
            totp = pyotp.TOTP(device.secret_key)
            if not totp.verify(code):
                return Response(
                    {'error': 'Invalid verification code'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Verify stored code for SMS/Email
            from django.core.cache import cache
            stored_code = cache.get(f'mfa_code_{device.id}')
            if code != stored_code:
                return Response(
                    {'error': 'Invalid verification code'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            cache.delete(f'mfa_code_{device.id}')
        
        device.is_verified = True
        device.last_used_at = timezone.now()
        
        # Make primary if first device
        if not MFADevice.objects.filter(user=request.user, is_primary=True).exists():
            device.is_primary = True
        
        device.save()
        
        return Response({
            'message': 'MFA device verified successfully',
            'is_primary': device.is_primary
        })
    
    @action(detail=True, methods=['post'])
    def make_primary(self, request, pk=None):
        """Make device primary"""
        device = self.get_object()
        
        if not device.is_verified:
            return Response(
                {'error': 'Device must be verified first'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Remove primary from other devices
        MFADevice.objects.filter(
            user=request.user,
            is_primary=True
        ).update(is_primary=False)
        
        device.is_primary = True
        device.save()
        
        return Response({'message': 'Device set as primary'})


class LoginAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing login attempts"""
    
    serializer_class = LoginAttemptSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        queryset = LoginAttempt.objects.filter(
            user__organization=self.request.user.organization
        ).select_related('user').order_by('-created_at')
        
        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by success
        success = self.request.query_params.get('success')
        if success is not None:
            queryset = queryset.filter(success=success.lower() == 'true')
        
        return queryset[:500]


class SessionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing and managing sessions"""
    
    serializer_class = SessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Users can see their own sessions
        # Admins can see all org sessions
        if (self.request.user.role and 
            self.request.user.role.type == 'admin'):
            return Session.objects.filter(
                user__organization=self.request.user.organization,
                is_active=True
            ).select_related('user').order_by('-last_activity_at')
        
        return Session.objects.filter(
            user=self.request.user,
            is_active=True
        ).order_by('-last_activity_at')
    
    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """Terminate a session"""
        session = self.get_object()
        
        # Users can only terminate their own sessions
        if (session.user != request.user and
            not (request.user.role and request.user.role.type == 'admin')):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        session.is_active = False
        session.save()
        
        # Blacklist associated JWT token if stored
        # This would require storing the token reference
        
        return Response({'message': 'Session terminated'})
    
    @action(detail=False, methods=['post'])
    def terminate_all(self, request):
        """Terminate all sessions except current"""
        current_session_id = getattr(request, 'session_id', None)
        
        sessions = Session.objects.filter(
            user=request.user,
            is_active=True
        )
        
        if current_session_id:
            sessions = sessions.exclude(id=current_session_id)
        
        count = sessions.update(is_active=False)
        
        return Response({
            'message': f'Terminated {count} sessions'
        })


class DataAccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing data access logs"""
    
    serializer_class = DataAccessLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        queryset = DataAccessLog.objects.filter(
            user__organization=self.request.user.organization
        ).select_related('user').order_by('-created_at')
        
        # Filter options
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        resource_type = self.request.query_params.get('resource_type')
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        
        return queryset[:1000]


class PasswordResetRequestView(APIView):
    """Request password reset"""
    
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        
        from users.models import User
        try:
            user = User.objects.get(email=email)
            
            # Generate reset token
            from django.contrib.auth.tokens import default_token_generator
            token = default_token_generator.make_token(user)
            
            # Send reset email
            from security.tasks import send_password_reset_email
            send_password_reset_email.delay(str(user.id), token)
            
        except User.DoesNotExist:
            pass  # Don't reveal if user exists
        
        return Response({
            'message': 'If an account exists with this email, a reset link has been sent'
        })


class PasswordResetConfirmView(APIView):
    """Confirm password reset"""
    
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        
        # Token format: user_id:token
        try:
            user_id, actual_token = token.split(':', 1)
        except ValueError:
            return Response(
                {'error': 'Invalid reset token'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from users.models import User
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid reset token'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify token
        from django.contrib.auth.tokens import default_token_generator
        if not default_token_generator.check_token(user, actual_token):
            return Response(
                {'error': 'Invalid or expired reset token'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update password
        user.set_password(new_password)
        user.save()
        
        # Log the action
        DataAccessLog.objects.create(
            user=user,
            action='update',
            resource_type='User',
            resource_id=str(user.id),
            resource_details={'action': 'password_reset'},
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Invalidate all sessions
        Session.objects.filter(user=user).update(is_active=False)
        
        return Response({'message': 'Password reset successfully'})


class SecurityDashboardView(APIView):
    """Security dashboard overview"""
    
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        org = request.user.organization
        now = timezone.now()
        last_30_days = now - timezone.timedelta(days=30)
        last_24_hours = now - timezone.timedelta(hours=24)
        
        # Get settings
        settings, _ = SecuritySetting.objects.get_or_create(
            organization=org,
            defaults={'updated_by': request.user}
        )
        
        # Get stats
        from users.models import User
        
        stats = {
            'mfa_enabled_users': User.objects.filter(
                organization=org,
                is_active=True,
                mfa_devices__is_verified=True
            ).distinct().count(),
            'total_users': User.objects.filter(
                organization=org,
                is_active=True
            ).count(),
            'active_sessions': Session.objects.filter(
                user__organization=org,
                is_active=True,
                expires_at__gt=now
            ).count(),
            'failed_logins_24h': LoginAttempt.objects.filter(
                user__organization=org,
                successful=False,
                timestamp__gte=last_24_hours
            ).count(),
            'recent_login_attempts_24h': LoginAttempt.objects.filter(
                user__organization=org,
                timestamp__gte=last_24_hours
            ).count(),
            'api_keys_active': APIKey.objects.filter(
                organization=org,
                is_active=True
            ).count(),
            'data_exports_30d': DataAccessLog.objects.filter(
                organization=org,
                access_type='export',
                timestamp__gte=last_30_days
            ).count(),
            'suspicious_activities_24h': (
                LoginAttempt.objects.filter(
                    user__organization=org,
                    successful=False,
                    timestamp__gte=last_24_hours,
                ).count()
                + DataAccessLog.objects.filter(
                    organization=org,
                    access_type__in=['export', 'download', 'share'],
                    timestamp__gte=last_24_hours,
                ).count()
            ),
        }
        
        # Calculate MFA adoption percentage
        if stats['total_users'] > 0:
            stats['mfa_adoption_percent'] = round(
                stats['mfa_enabled_users'] / stats['total_users'] * 100
            )
        else:
            stats['mfa_adoption_percent'] = 0
        
        # Security recommendations
        recommendations = []
        
        if not settings.require_mfa and stats['mfa_adoption_percent'] < 100:
            recommendations.append({
                'type': 'warning',
                'message': 'Consider requiring MFA for all users'
            })
        
        if settings.min_password_length < 12:
            recommendations.append({
                'type': 'info',
                'message': 'Consider increasing minimum password length to 12 characters'
            })
        
        if stats['failed_logins_24h'] > 50:
            recommendations.append({
                'type': 'alert',
                'message': 'High number of failed login attempts detected'
            })
        
        return Response({
            # Flat shape used by frontend services.ts
            'mfa_adoption': stats['mfa_adoption_percent'],
            'active_sessions': stats['active_sessions'],
            'recent_login_attempts': stats['recent_login_attempts_24h'],
            'api_key_count': stats['api_keys_active'],
            'suspicious_activities': stats['suspicious_activities_24h'],

            # Detailed payload for dashboard expansion
            'stats': stats,
            'settings': SecuritySettingSerializer(settings).data,
            'recommendations': recommendations,
        })
