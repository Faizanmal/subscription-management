"""
Serializers for the integrations app
"""

from rest_framework import serializers
from integrations.models import (
    Integration, IntegrationSync, EmailScanConfig,
    BankAccount, BankTransaction, SSOConnection,
    SlackNotification, Webhook, WebhookDelivery
)


class IntegrationSerializer(serializers.ModelSerializer):
    """Integration serializer"""
    
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Integration
        fields = [
            'id', 'organization', 'name', 'type', 'type_display',
            'status', 'status_display', 'config', 'credentials_encrypted',
            'last_sync_at', 'sync_frequency', 'error_message',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['organization', 'last_sync_at', 'error_message', 'created_at', 'updated_at']
        extra_kwargs = {
            'credentials_encrypted': {'write_only': True}
        }


class IntegrationSyncSerializer(serializers.ModelSerializer):
    """Integration sync log serializer"""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = IntegrationSync
        fields = [
            'id', 'integration', 'status', 'status_display',
            'started_at', 'completed_at', 'items_synced',
            'errors', 'sync_data'
        ]
        read_only_fields = ['__all__']


class EmailScanConfigSerializer(serializers.ModelSerializer):
    """Email scan configuration serializer"""
    
    class Meta:
        model = EmailScanConfig
        fields = [
            'id', 'integration', 'email_address', 'scan_folders',
            'sender_patterns', 'subject_patterns',
            'last_scan_at', 'is_active'
        ]
        read_only_fields = ['last_scan_at']


class BankAccountSerializer(serializers.ModelSerializer):
    """Bank account serializer"""
    
    institution_name = serializers.SerializerMethodField()
    
    class Meta:
        model = BankAccount
        fields = [
            'id', 'integration', 'plaid_account_id', 'institution_id',
            'institution_name', 'name', 'official_name', 'type', 'subtype',
            'mask', 'current_balance', 'available_balance', 'iso_currency_code',
            'last_synced_at', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['plaid_account_id', 'last_synced_at', 'created_at', 'updated_at']
    
    def get_institution_name(self, obj):
        """Get institution name from integration"""
        if obj.integration and obj.integration.config:
            return obj.integration.config.get('institution_name', '')
        return ''


class BankTransactionSerializer(serializers.ModelSerializer):
    """Bank transaction serializer"""
    
    matched_subscription_name = serializers.SerializerMethodField()
    
    class Meta:
        model = BankTransaction
        fields = [
            'id', 'account', 'plaid_transaction_id', 'transaction_date',
            'posted_date', 'amount', 'iso_currency_code', 'merchant_name',
            'name', 'category', 'category_id', 'pending', 'payment_channel',
            'transaction_type', 'is_subscription_payment', 'matched_subscription',
            'matched_subscription_name', 'created_at'
        ]
        read_only_fields = ['plaid_transaction_id', 'created_at']
    
    def get_matched_subscription_name(self, obj):
        if obj.matched_subscription:
            return obj.matched_subscription.name
        return None


class SSOConnectionSerializer(serializers.ModelSerializer):
    """SSO connection serializer"""
    
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    
    class Meta:
        model = SSOConnection
        fields = [
            'id', 'organization', 'provider', 'provider_display',
            'domain', 'entity_id', 'metadata_url', 'certificate',
            'is_active', 'auto_provision_users',
            'default_role', 'default_department',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SlackNotificationSerializer(serializers.ModelSerializer):
    """Slack notification serializer"""
    
    class Meta:
        model = SlackNotification
        fields = [
            'id', 'organization', 'channel_name', 'channel_id',
            'webhook_url', 'notification_types', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'webhook_url': {'write_only': True}
        }


class WebhookSerializer(serializers.ModelSerializer):
    """Webhook serializer"""
    
    class Meta:
        model = Webhook
        fields = [
            'id', 'organization', 'name', 'url', 'secret',
            'events', 'is_active', 'last_triggered_at',
            'failure_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['last_triggered_at', 'failure_count', 'created_at', 'updated_at']
        extra_kwargs = {
            'secret': {'write_only': True}
        }


class WebhookDeliverySerializer(serializers.ModelSerializer):
    """Webhook delivery log serializer"""
    
    class Meta:
        model = WebhookDelivery
        fields = [
            'id', 'webhook', 'event_type', 'payload',
            'response_status', 'response_body', 'duration_ms',
            'success', 'attempt_count', 'created_at'
        ]
        read_only_fields = ['__all__']


# Connection request serializers

class PlaidLinkTokenSerializer(serializers.Serializer):
    """Serializer for Plaid link token request"""
    
    client_user_id = serializers.CharField(read_only=True)
    link_token = serializers.CharField(read_only=True)
    expiration = serializers.DateTimeField(read_only=True)


class PlaidExchangeTokenSerializer(serializers.Serializer):
    """Serializer for exchanging Plaid public token"""
    
    public_token = serializers.CharField(required=True)


class GoogleOAuthSerializer(serializers.Serializer):
    """Serializer for Google OAuth setup"""
    
    auth_url = serializers.URLField(read_only=True)


class GoogleOAuthCallbackSerializer(serializers.Serializer):
    """Serializer for Google OAuth callback"""
    
    code = serializers.CharField(required=True)
    state = serializers.CharField(required=True)


class MicrosoftOAuthSerializer(serializers.Serializer):
    """Serializer for Microsoft OAuth setup"""
    
    auth_url = serializers.URLField(read_only=True)


class MicrosoftOAuthCallbackSerializer(serializers.Serializer):
    """Serializer for Microsoft OAuth callback"""
    
    code = serializers.CharField(required=True)
    state = serializers.CharField(required=True)


class SlackIntegrationSerializer(serializers.Serializer):
    """Serializer for Slack integration setup"""
    
    webhook_url = serializers.URLField(required=True)
    channel = serializers.CharField(required=True)
    notification_types = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=['alerts', 'recommendations', 'renewals']
    )


class IntegrationTestSerializer(serializers.Serializer):
    """Serializer for testing integration"""
    
    integration_id = serializers.UUIDField(required=True)
    test_result = serializers.DictField(read_only=True)


class IntegrationSyncRequestSerializer(serializers.Serializer):
    """Serializer for triggering integration sync"""
    
    integration_id = serializers.UUIDField(required=True)
    full_sync = serializers.BooleanField(default=False)
