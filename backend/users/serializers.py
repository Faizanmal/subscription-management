"""
User serializers for Subscription Waste Manager
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from users.models import (
    User, Organization, Department, Team, Role,
    UserInvitation, AuditLog, Notification
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with additional claims"""
    
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


class OrganizationSerializer(serializers.ModelSerializer):
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
        read_only_fields = ['id', 'slug', 'is_on_trial', 'is_enterprise', 'created_at', 'updated_at']
    
    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()
    
    def get_subscription_count(self, obj):
        return obj.subscriptions.filter(status='active').count()


class OrganizationCreateSerializer(serializers.ModelSerializer):
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


class DepartmentSerializer(serializers.ModelSerializer):
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


class TeamSerializer(serializers.ModelSerializer):
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


class RoleSerializer(serializers.ModelSerializer):
    """Role serializer"""
    
    class Meta:
        model = Role
        fields = [
            'id', 'name', 'type', 'description', 'permissions',
            'is_system_role', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_system_role', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    
    organization_name = serializers.CharField(source='organization.name', read_only=True)
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
            'is_active', 'is_verified', 'is_admin', 'is_finance',
            'timezone', 'language', 'notification_preferences',
            'last_activity', 'date_joined', 'updated_at'
        ]
        read_only_fields = [
            'id', 'is_verified', 'is_admin', 'is_finance',
            'last_activity', 'date_joined', 'updated_at'
        ]


class UserCreateSerializer(serializers.ModelSerializer):
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


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users"""
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'avatar', 'phone', 'job_title',
            'department', 'team', 'role',
            'timezone', 'language', 'notification_preferences'
        ]


class UserInvitationSerializer(serializers.ModelSerializer):
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


class UserInvitationCreateSerializer(serializers.ModelSerializer):
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


class AuditLogSerializer(serializers.ModelSerializer):
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


class NotificationSerializer(serializers.ModelSerializer):
    """Notification serializer"""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'priority', 'title', 'message',
            'action_url', 'metadata', 'is_read', 'read_at', 'created_at'
        ]
        read_only_fields = ['id', 'type', 'priority', 'title', 'message', 'action_url', 'metadata', 'created_at']
