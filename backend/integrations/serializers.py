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
    """Integration serializer aligned to the Integration model."""

    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    last_sync_at = serializers.DateTimeField(source='last_sync', read_only=True)
    error_message = serializers.CharField(source='last_sync_error', read_only=True)

    class Meta:
        model = Integration
        fields = [
            'id', 'organization', 'name', 'type', 'type_display',
            'status', 'status_display', 'config',
            'last_sync', 'last_sync_at', 'last_sync_status', 'last_sync_error',
            'error_message', 'sync_enabled', 'sync_interval_minutes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'organization', 'last_sync', 'last_sync_status', 'last_sync_error',
            'created_at', 'updated_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        config = dict(data.get('config') or {})
        for key in ('webhook_url', 'api_token', 'client_secret'):
            if key in config and config[key]:
                config[key] = True
        data['config'] = config
        return data


class IntegrationSyncSerializer(serializers.ModelSerializer):
    """Integration sync log serializer"""

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items_synced = serializers.IntegerField(source='records_processed', read_only=True)
    errors = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationSync
        fields = [
            'id', 'integration', 'status', 'status_display',
            'started_at', 'completed_at', 'items_synced',
            'records_processed', 'records_created', 'records_updated',
            'records_failed', 'errors', 'error_message', 'sync_data',
        ]
        read_only_fields = fields

    def get_errors(self, obj):
        return [obj.error_message] if obj.error_message else []


class EmailScanConfigSerializer(serializers.ModelSerializer):
    """Email scan configuration serializer"""

    last_scan_at = serializers.DateTimeField(source='last_scan', read_only=True)
    is_active = serializers.BooleanField(source='enabled', required=False)

    class Meta:
        model = EmailScanConfig
        fields = [
            'id', 'organization', 'integration',
            'enabled', 'is_active',
            'scan_invoices', 'scan_receipts', 'scan_welcome_emails',
            'mailboxes', 'sender_patterns', 'subject_patterns',
            'scan_from_date', 'last_scan', 'last_scan_at', 'last_scan_result',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['organization', 'last_scan', 'last_scan_result', 'created_at', 'updated_at']


class BankAccountSerializer(serializers.ModelSerializer):
    """Bank account serializer"""

    institution = serializers.CharField(source='institution_name', read_only=True)
    last_synced_at = serializers.DateTimeField(source='last_sync', read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            'id', 'organization', 'integration', 'plaid_account_id',
            'institution_name', 'institution', 'name', 'account_type',
            'mask', 'is_active', 'status', 'auto_categorize',
            'last_sync', 'last_synced_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'organization', 'plaid_account_id', 'last_sync', 'created_at', 'updated_at',
        ]

    def get_status(self, obj):
        return 'active' if obj.is_active else 'disabled'


class BankTransactionSerializer(serializers.ModelSerializer):
    """Bank transaction serializer"""

    matched_subscription = serializers.UUIDField(source='subscription_id', read_only=True)
    matched_subscription_name = serializers.SerializerMethodField()
    is_subscription_payment = serializers.BooleanField(source='is_subscription_related', read_only=True)
    iso_currency_code = serializers.CharField(source='currency', read_only=True)
    name = serializers.CharField(source='description', read_only=True)

    class Meta:
        model = BankTransaction
        fields = [
            'id', 'organization', 'bank_account', 'transaction_date',
            'amount', 'currency', 'iso_currency_code', 'merchant_name',
            'description', 'name', 'category',
            'is_subscription_related', 'is_subscription_payment',
            'is_matched', 'matched_subscription', 'matched_subscription_name',
            'created_at',
        ]
        read_only_fields = fields

    def get_matched_subscription_name(self, obj):
        if obj.subscription:
            return obj.subscription.name
        return None


class SSOConnectionSerializer(serializers.ModelSerializer):
    """Discovered SSO app connections"""

    class Meta:
        model = SSOConnection
        fields = [
            'id', 'organization', 'integration', 'subscription',
            'app_name', 'app_id', 'app_type',
            'assigned_users', 'active_users', 'last_login',
            'is_active', 'last_sync', 'created_at', 'updated_at',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at']


class SlackNotificationSerializer(serializers.ModelSerializer):
    """Slack notification serializer"""

    class Meta:
        model = SlackNotification
        fields = [
            'id', 'organization', 'integration',
            'channel_name', 'channel_id', 'notification_type',
            'min_severity', 'min_savings', 'departments',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at']


class WebhookSerializer(serializers.ModelSerializer):
    """Webhook serializer"""

    last_triggered_at = serializers.DateTimeField(source='last_triggered', read_only=True)
    failure_count = serializers.IntegerField(source='failed_deliveries', read_only=True)

    class Meta:
        model = Webhook
        fields = [
            'id', 'organization', 'name', 'url', 'secret',
            'events', 'is_active', 'last_triggered', 'last_triggered_at',
            'failure_count', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'organization', 'last_triggered', 'failed_deliveries',
            'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'secret': {'write_only': True, 'required': False},
            'name': {'required': False, 'allow_blank': True},
        }


class WebhookDeliverySerializer(serializers.ModelSerializer):
    """Webhook delivery log serializer"""

    success = serializers.SerializerMethodField()
    attempt_count = serializers.IntegerField(source='attempts', read_only=True)

    class Meta:
        model = WebhookDelivery
        fields = [
            'id', 'webhook', 'event_type', 'payload',
            'status', 'response_status', 'response_body',
            'success', 'attempt_count', 'created_at', 'delivered_at',
        ]
        read_only_fields = fields

    def get_success(self, obj):
        return obj.status == WebhookDelivery.Status.SUCCESS


class PlaidLinkTokenSerializer(serializers.Serializer):
    """Serializer for Plaid link token request"""

    client_user_id = serializers.CharField(read_only=True)
    link_token = serializers.CharField(read_only=True)
    expiration = serializers.DateTimeField(read_only=True)


class PlaidExchangeTokenSerializer(serializers.Serializer):
    """Serializer for exchanging Plaid public token"""

    public_token = serializers.CharField(required=True)


class GoogleOAuthCallbackSerializer(serializers.Serializer):
    """Serializer for Google OAuth callback"""

    code = serializers.CharField(required=True)
    state = serializers.CharField(required=True)


class MicrosoftOAuthCallbackSerializer(serializers.Serializer):
    """Serializer for Microsoft OAuth callback"""

    code = serializers.CharField(required=True)
    state = serializers.CharField(required=True)
