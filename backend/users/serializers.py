"""
User serializers for Subscription Waste Manager
"""

from rest_framework import serializers
from api.serializers import OrganizationModelSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenObtainSerializer, TokenRefreshSerializer
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from users.models import (
    User, Organization, Department, Team, Role,
    UserInvitation, AuditLog, Notification
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with additional claims"""

    otp = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        from django.contrib.auth.models import update_last_login
        from django.db import transaction
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.settings import api_settings
        import pyotp

        # Authenticate the password before issuing any tokens.
        data = TokenObtainSerializer.validate(self, attrs)
        with transaction.atomic():
            devices = list(self.user.mfa_devices.select_for_update().filter(device_type='totp', is_verified=True))
            if devices:
                now = timezone.now()
                step_start = int(now.timestamp()) // 30 * 30
                for device in devices:
                    if (not device.last_used or device.last_used.timestamp() < step_start) and pyotp.TOTP(device.secret).verify(attrs.get('otp', ''), for_time=now.timestamp()):
                        device.last_used = now
                        device.save(update_fields=['last_used'])
                        break
                else:
                    raise AuthenticationFailed('Enter a valid, unused authenticator code.', code='mfa_required')
            refresh = self.get_token(self.user)
            refresh['mfa'] = bool(devices)
            data['refresh'] = str(refresh)
            data['access'] = str(refresh.access_token)
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)
        return data
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['email'] = user.email
        token['full_name'] = user.full_name
        if user.organization:
            token['org_id'] = str(user.organization.id)
            token['org_name'] = user.organization.name
        if user.role:
            token['role'] = user.role.type
        
        return token


class SecureTokenRefreshSerializer(TokenRefreshSerializer):
    """Apply password-revocation and MFA rules before rotating a refresh token."""

    def validate(self, attrs):
        from users.authentication import MFAJWTAuthentication
        refresh = self.token_class(attrs['refresh'])
        MFAJWTAuthentication().get_user(refresh)
        return super().validate(attrs)


class OrganizationSerializer(OrganizationModelSerializer):
    """Organization serializer"""
    
    user_count = serializers.SerializerMethodField()
    subscription_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'domain', 'logo', 'plan',
            'default_currency', 'trial_ends_at', 'is_on_trial',
            'is_enterprise', 'settings', 'user_count', 'subscription_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'slug', 'plan', 'trial_ends_at', 'is_on_trial', 'is_enterprise', 'created_at', 'updated_at',
        ]
    
    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()
    
    def get_subscription_count(self, obj):
        return obj.subscriptions.filter(status='active').count()

    def update(self, instance, validated_data):
        incoming_settings = validated_data.pop('settings', None)
        if incoming_settings is not None:
            merged = dict(instance.settings or {})
            merged.update(incoming_settings)
            validated_data['settings'] = merged
        return super().update(instance, validated_data)


class OrganizationCreateSerializer(OrganizationModelSerializer):
    """Serializer for creating organizations"""
    
    class Meta:
        model = Organization
        fields = ['name', 'domain', 'default_currency']
    
    def create(self, validated_data):
        from django.utils.text import slugify
        
        name = validated_data['name']
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        
        while Organization.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        validated_data['slug'] = slug
        validated_data['trial_ends_at'] = timezone.now() + timezone.timedelta(days=14)
        
        return super().create(validated_data)


class DepartmentSerializer(OrganizationModelSerializer):
    """Department serializer"""
    
    user_count = serializers.SerializerMethodField()
    subscription_count = serializers.SerializerMethodField()
    current_spend = serializers.SerializerMethodField()
    
    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'budget', 'budget_period',
            'parent', 'user_count', 'subscription_count', 'current_spend',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()
    
    def get_subscription_count(self, obj):
        return obj.subscriptions.filter(status='active').count()
    
    def get_current_spend(self, obj):
        from django.db.models import Sum
        return obj.subscriptions.filter(status='active').aggregate(
            total=Sum('cost_per_unit')
        )['total'] or 0


class TeamSerializer(OrganizationModelSerializer):
    """Team serializer"""
    
    department_name = serializers.CharField(source='department.name', read_only=True)
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = [
            'id', 'name', 'department', 'department_name', 'budget',
            'user_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()


class RoleSerializer(OrganizationModelSerializer):
    """Role serializer"""
    
    class Meta:
        model = Role
        fields = [
            'id', 'name', 'type', 'description', 'permissions',
            'is_system_role', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_system_role', 'created_at', 'updated_at']


class UserSerializer(OrganizationModelSerializer):
    """User serializer"""
    
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    agreements_required = serializers.SerializerMethodField()

    def get_agreements_required(self, obj):
        from users.policies import agreements_required
        return agreements_required(obj)
    email_verified = serializers.SerializerMethodField()
    email_verification_required = serializers.SerializerMethodField()
    def get_email_verified(self, obj):
        return bool(obj.email_verified_at)
    def get_email_verification_required(self, obj):
        from users.verification import verification_required
        return bool(verification_required(obj))
    department_name = serializers.CharField(source='department.name', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_type = serializers.CharField(source='role.type', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'avatar', 'phone', 'job_title',
            'organization', 'organization_name',
            'department', 'department_name',
            'team', 'team_name',
            'role', 'role_name', 'role_type',
            'is_active', 'is_verified', 'email_verified', 'email_verification_required', 'is_admin', 'is_finance', 'agreements_required',
            'timezone', 'language', 'notification_preferences',
            'last_activity', 'date_joined', 'updated_at'
        ]
        read_only_fields = [
            'id', 'is_verified', 'is_admin', 'is_finance',
            'last_activity', 'date_joined', 'updated_at'
        ]


class UserCreateSerializer(OrganizationModelSerializer):
    """Serializer for creating users"""
    
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'phone', 'job_title'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': "Passwords don't match"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class UserUpdateSerializer(OrganizationModelSerializer):
    """Serializer for updating users"""
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'avatar', 'phone', 'job_title',
            'department', 'team', 'role',
            'timezone', 'language', 'notification_preferences'
        ]


class ProfileUpdateSerializer(OrganizationModelSerializer):
    """Self-service profile changes cannot modify authorization or membership."""

    def validate_avatar(self, value):
        if value is None:
            return value
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError('Choose an image smaller than 2 MB.')
        image_format = getattr(value, 'image', None)
        image_format = getattr(image_format, 'format', '')
        extensions = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp'}
        if image_format not in extensions:
            raise serializers.ValidationError('Use a PNG, JPEG, or WebP image.')
        import uuid
        value.name = f'{uuid.uuid4().hex}.{extensions[image_format]}'
        return value

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'avatar', 'phone', 'job_title',
            'timezone', 'language', 'notification_preferences',
        ]


class UserInvitationSerializer(OrganizationModelSerializer):
    """User invitation serializer"""
    
    invited_by_name = serializers.CharField(source='invited_by.full_name', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    
    class Meta:
        model = UserInvitation
        fields = [
            'id', 'email', 'role', 'role_name', 'department', 'team',
            'invited_by', 'invited_by_name', 'status', 'expires_at',
            'is_expired', 'created_at'
        ]
        read_only_fields = ['id', 'invited_by', 'status', 'expires_at', 'is_expired', 'created_at']


class UserInvitationCreateSerializer(OrganizationModelSerializer):
    """Serializer for creating user invitations"""
    
    class Meta:
        model = UserInvitation
        fields = ['email', 'role', 'department', 'team']
    
    def validate_email(self, value):
        organization = self.context['request'].user.organization
        if User.objects.filter(email=value, organization=organization).exists():
            raise serializers.ValidationError("User with this email already exists in your organization")
        if UserInvitation.objects.filter(
            email=value,
            organization=organization,
            status='pending'
        ).exists():
            raise serializers.ValidationError("Pending invitation already exists for this email")
        return value
    
    def create(self, validated_data):
        import secrets
        from django.utils import timezone
        
        validated_data['organization'] = self.context['request'].user.organization
        validated_data['invited_by'] = self.context['request'].user
        validated_data['token'] = secrets.token_urlsafe(32)
        validated_data['expires_at'] = timezone.now() + timezone.timedelta(days=7)
        
        return super().create(validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password"""
    
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': "Passwords don't match"})
        return attrs
    
    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value


class AuditLogSerializer(OrganizationModelSerializer):
    """Audit log serializer"""
    
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'action', 'resource_type', 'resource_id',
            'old_values', 'new_values', 'metadata',
            'ip_address', 'created_at'
        ]
        read_only_fields = '__all__'


class NotificationSerializer(OrganizationModelSerializer):
    """Notification serializer"""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'priority', 'title', 'message',
            'action_url', 'metadata', 'is_read', 'read_at', 'created_at'
        ]
        read_only_fields = ['id', 'type', 'priority', 'title', 'message', 'action_url', 'metadata', 'created_at']
