"""
Serializers for security app
"""

from rest_framework import serializers
from security.models import (
    APIKey, SecuritySetting, MFADevice,
    LoginAttempt, Session, DataAccessLog
)


class APIKeySerializer(serializers.ModelSerializer):
    """API Key serializer"""
    
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)
    key = serializers.CharField(read_only=True)
    
    class Meta:
        model = APIKey
        fields = [
            'id', 'organization', 'name', 'key', 'key_prefix',
            'scope', 'scope_display', 'allowed_ips', 'rate_limit',
            'expires_at', 'last_used_at', 'usage_count', 'is_active',
            'created_by', 'created_at'
        ]
        read_only_fields = ['organization', 'key', 'key_prefix', 'last_used_at', 'usage_count', 'created_by', 'created_at']


class APIKeyCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating API keys"""
    
    key = serializers.CharField(read_only=True)
    
    class Meta:
        model = APIKey
        fields = [
            'id', 'name', 'scope', 'allowed_ips', 'rate_limit',
            'expires_at', 'key'
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
            'id', 'organization', 'require_mfa', 'allowed_mfa_methods',
            'password_min_length', 'password_require_uppercase',
            'password_require_lowercase', 'password_require_number',
            'password_require_special', 'password_expiry_days',
            'session_timeout_minutes', 'max_sessions_per_user',
            'ip_whitelist', 'ip_blacklist', 'require_ip_whitelist',
            'failed_login_lockout_attempts', 'failed_login_lockout_duration_minutes',
            'updated_at', 'updated_by'
        ]
        read_only_fields = ['organization', 'updated_at', 'updated_by']


class MFADeviceSerializer(serializers.ModelSerializer):
    """MFA device serializer"""
    
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = MFADevice
        fields = [
            'id', 'user', 'type', 'type_display', 'name',
            'phone_number', 'is_verified', 'is_primary',
            'last_used_at', 'created_at'
        ]
        read_only_fields = ['user', 'is_verified', 'last_used_at', 'created_at']
        extra_kwargs = {
            'secret_key': {'write_only': True}
        }


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
    
    class Meta:
        model = LoginAttempt
        fields = [
            'id', 'email', 'ip_address', 'user_agent',
            'success', 'failure_reason', 'created_at'
        ]
        read_only_fields = ['__all__']


class SessionSerializer(serializers.ModelSerializer):
    """User session serializer"""
    
    is_current = serializers.SerializerMethodField()
    
    class Meta:
        model = Session
        fields = [
            'id', 'user', 'ip_address', 'user_agent',
            'device_type', 'location', 'is_active',
            'created_at', 'last_activity_at', 'expires_at',
            'is_current'
        ]
        read_only_fields = ['__all__']
    
    def get_is_current(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'session_id'):
            return str(obj.id) == str(request.session_id)
        return False


class DataAccessLogSerializer(serializers.ModelSerializer):
    """Data access log serializer"""
    
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = DataAccessLog
        fields = [
            'id', 'user', 'action', 'action_display',
            'resource_type', 'resource_id', 'resource_details',
            'ip_address', 'user_agent', 'created_at'
        ]
        read_only_fields = ['__all__']


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
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match'
            })
        return attrs
