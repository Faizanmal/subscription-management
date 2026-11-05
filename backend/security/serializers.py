"""
Serializers for security app
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from security.models import (
    APIKey, SecuritySetting, MFADevice,
    LoginAttempt, Session, DataAccessLog
)


class APIKeySerializer(serializers.ModelSerializer):
    """API Key serializer"""
    
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)
    last_used_at = serializers.DateTimeField(source='last_used', read_only=True)
    usage_count = serializers.IntegerField(source='total_requests', read_only=True)
    rate_limit = serializers.IntegerField(source='rate_limit_per_hour', read_only=True)
    
    class Meta:
        model = APIKey
        fields = [
            'id', 'organization', 'name', 'key_prefix',
            'scope', 'scope_display', 'allowed_ips', 'rate_limit',
            'rate_limit_per_hour', 'expires_at', 'last_used', 'last_used_at',
            'total_requests', 'usage_count', 'is_active',
            'created_by', 'created_at'
        ]
        read_only_fields = [
            'organization', 'key_prefix', 'last_used', 'total_requests',
            'created_by', 'created_at',
        ]


class APIKeyCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating API keys"""
    
    key = serializers.CharField(read_only=True) 
    class Meta:
        model = APIKey
        fields = [
            'id', 'name', 'scope', 'allowed_ips',
            'rate_limit_per_hour', 'expires_at', 'key'
        ]
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['organization'] = request.user.organization
        validated_data['created_by'] = request.user
        
        api_key, raw_key = APIKey.generate_key(**validated_data)
        
        # Attach raw key to instance for response
        api_key._raw_key = raw_key
        return api_key
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Include raw key only on creation
        if hasattr(instance, '_raw_key'):
            data['key'] = instance._raw_key
        return data


class SecuritySettingSerializer(serializers.ModelSerializer):
    """Security settings serializer"""
    
    class Meta:
        model = SecuritySetting
        fields = [
            'id', 'organization', 'require_mfa', 'mfa_methods',
            'min_password_length', 'require_uppercase',
            'require_lowercase', 'require_numbers',
            'require_special_chars', 'password_expiry_days',
            'session_timeout_minutes', 'max_concurrent_sessions',
            'allowed_ips', 'blocked_ips',
            'max_login_attempts', 'lockout_duration_minutes',
            'updated_at',
        ]
        read_only_fields = ['organization', 'updated_at']


class MFADeviceSerializer(serializers.ModelSerializer):
    """MFA device serializer"""
    
    type = serializers.CharField(source='device_type', read_only=True)
    type_display = serializers.CharField(source='get_device_type_display', read_only=True)
    last_used_at = serializers.DateTimeField(source='last_used', read_only=True)
    
    class Meta:
        model = MFADevice
        fields = [
            'id', 'user', 'device_type', 'type', 'type_display', 'name',
            'phone_number', 'is_verified', 'is_primary',
            'last_used', 'last_used_at', 'created_at'
        ]
        read_only_fields = ['user', 'is_verified', 'last_used', 'created_at']


class MFADeviceSetupSerializer(serializers.Serializer):
    """Serializer for MFA device setup"""
    
    type = serializers.ChoiceField(choices=MFADevice.DeviceType.choices)
    phone_number = serializers.CharField(required=False)
    name = serializers.CharField(required=False, default='My Device')


class MFAVerifySerializer(serializers.Serializer):
    """Serializer for MFA verification"""
    
    device_id = serializers.UUIDField()
    code = serializers.CharField(max_length=8)


class LoginAttemptSerializer(serializers.ModelSerializer):
    """Login attempt serializer"""
    
    success = serializers.BooleanField(source='successful', read_only=True)
    created_at = serializers.DateTimeField(source='timestamp', read_only=True)
    
    class Meta:
        model = LoginAttempt
        fields = [
            'id', 'email', 'ip_address', 'user_agent',
            'successful', 'success', 'failure_reason', 'timestamp', 'created_at'
        ]
        read_only_fields = fields


class SessionSerializer(serializers.ModelSerializer):
    """User session serializer"""
    
    is_current = serializers.SerializerMethodField()
    last_activity_at = serializers.DateTimeField(source='last_activity', read_only=True)
    device_type = serializers.SerializerMethodField()
    
    class Meta:
        model = Session
        fields = [
            'id', 'user', 'ip_address', 'user_agent',
            'device_info', 'device_type', 'is_active',
            'created_at', 'last_activity', 'last_activity_at', 'expires_at',
            'is_current'
        ]
        read_only_fields = [
            'id', 'user', 'ip_address', 'user_agent', 'device_info',
            'is_active', 'created_at', 'last_activity', 'expires_at',
        ]
    
    def get_is_current(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'session_id'):
            return str(obj.id) == str(request.session_id)
        return False

    def get_device_type(self, obj):
        if isinstance(obj.device_info, dict):
            return obj.device_info.get('type') or obj.device_info.get('device') or ''
        return ''


class DataAccessLogSerializer(serializers.ModelSerializer):
    """Data access log serializer"""
    
    action = serializers.CharField(source='access_type', read_only=True)
    action_display = serializers.CharField(source='get_access_type_display', read_only=True)
    resource_details = serializers.JSONField(source='details', read_only=True)
    created_at = serializers.DateTimeField(source='timestamp', read_only=True)
    
    class Meta:
        model = DataAccessLog
        fields = [
            'id', 'user', 'access_type', 'action', 'action_display',
            'resource_type', 'resource_id', 'details', 'resource_details',
            'ip_address', 'user_agent', 'timestamp', 'created_at'
        ]
        read_only_fields = fields


# Password validators

class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change"""
    
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match'
            })
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request"""
    
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation"""
    
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    confirm_password = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match'
            })
        return attrs
