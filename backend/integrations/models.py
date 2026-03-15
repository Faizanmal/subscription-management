"""
Integration models for Subscription Waste Manager
Handles connections to external systems like SSO, Slack, Bank feeds, etc.
"""

import uuid
from django.db import models
from django.conf import settings
from users.models import Organization, User
from cryptography.fernet import Fernet


class EncryptedFieldMixin:
    """Mixin for encrypting sensitive data"""
    
    @staticmethod
    def encrypt_value(value):
        if not value:
            return value
        key = settings.ENCRYPTION_KEY
        if not key:
            return value
        f = Fernet(key.encode() if isinstance(key, str) else key)
        return f.encrypt(value.encode()).decode()
    
    @staticmethod
    def decrypt_value(value):
        if not value:
            return value
        key = settings.ENCRYPTION_KEY
        if not key:
            return value
        f = Fernet(key.encode() if isinstance(key, str) else key)
        return f.decrypt(value.encode()).decode()


class Integration(models.Model):
    """External service integrations"""
    
    class IntegrationType(models.TextChoices):
        # Identity & SSO
        GOOGLE_WORKSPACE = 'google_workspace', 'Google Workspace'
        MICROSOFT_365 = 'microsoft_365', 'Microsoft 365'
        OKTA = 'okta', 'Okta'
        AZURE_AD = 'azure_ad', 'Azure Active Directory'
        ONELOGIN = 'onelogin', 'OneLogin'
        JUMPCLOUD = 'jumpcloud', 'JumpCloud'
        
        # Communication
        SLACK = 'slack', 'Slack'
        TEAMS = 'teams', 'Microsoft Teams'
        
        # Finance & Expense
        QUICKBOOKS = 'quickbooks', 'QuickBooks'
        XERO = 'xero', 'Xero'
        EXPENSIFY = 'expensify', 'Expensify'
        CONCUR = 'concur', 'SAP Concur'
        BREX = 'brex', 'Brex'
        RAMP = 'ramp', 'Ramp'
        
        # Bank & Card
        PLAID = 'plaid', 'Plaid (Bank Feeds)'
        STRIPE = 'stripe', 'Stripe'
        
        # HR & Payroll
        WORKDAY = 'workday', 'Workday'
        BAMBOOHR = 'bamboohr', 'BambooHR'
        GUSTO = 'gusto', 'Gusto'
        RIPPLING = 'rippling', 'Rippling'
        
        # Other
        WEBHOOK = 'webhook', 'Custom Webhook'
        API = 'api', 'Custom API'
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Setup'
        CONNECTED = 'connected', 'Connected'
        DISCONNECTED = 'disconnected', 'Disconnected'
        ERROR = 'error', 'Error'
        EXPIRED = 'expired', 'Token Expired'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='integrations')
    
    type = models.CharField(max_length=30, choices=IntegrationType.choices)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Connection details (encrypted)
    credentials = models.JSONField(default=dict, blank=True)  # Encrypted OAuth tokens, API keys
    config = models.JSONField(default=dict, blank=True)  # Non-sensitive configuration
    
    # Sync settings
    sync_enabled = models.BooleanField(default=True)
    sync_interval_minutes = models.IntegerField(default=60)
    last_sync = models.DateTimeField(blank=True, null=True)
    last_sync_status = models.CharField(max_length=255, blank=True)
    last_sync_error = models.TextField(blank=True)
    
    # What to sync
    sync_subscriptions = models.BooleanField(default=True)
    sync_users = models.BooleanField(default=False)
    sync_transactions = models.BooleanField(default=False)
    sync_usage = models.BooleanField(default=False)
    
    # Metadata
    external_id = models.CharField(max_length=255, blank=True, null=True)
    webhook_url = models.URLField(blank=True, null=True)
    webhook_secret = models.CharField(max_length=255, blank=True, null=True)
    
    connected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='connected_integrations')
    connected_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'integrations'
        ordering = ['name']
        unique_together = ['organization', 'type', 'name']
    
    def __str__(self):
        return f"{self.organization.name} - {self.name}"
    
    def set_credential(self, key, value):
        """Encrypt and store a credential"""
        encrypted = EncryptedFieldMixin.encrypt_value(value)
        self.credentials[key] = encrypted
    
    def get_credential(self, key):
        """Get and decrypt a credential"""
        encrypted = self.credentials.get(key)
        return EncryptedFieldMixin.decrypt_value(encrypted) if encrypted else None


class IntegrationSync(models.Model):
    """Log of integration sync operations"""
    
    class Status(models.TextChoices):
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        PARTIAL = 'partial', 'Partial Success'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='syncs')
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    
    # Metrics
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    records_processed = models.IntegerField(default=0)
    records_created = models.IntegerField(default=0)
    records_updated = models.IntegerField(default=0)
    records_failed = models.IntegerField(default=0)
    
    error_message = models.TextField(blank=True)
    error_details = models.JSONField(default=dict, blank=True)
    
    # What was synced
    sync_type = models.CharField(max_length=100, blank=True)
    sync_data = models.JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'integration_syncs'
        ordering = ['-started_at']


class EmailScanConfig(models.Model):
    """Configuration for email-based subscription discovery"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='email_scan_configs')
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='email_configs')
    
    # Scan settings
    enabled = models.BooleanField(default=True)
    scan_invoices = models.BooleanField(default=True)
    scan_receipts = models.BooleanField(default=True)
    scan_welcome_emails = models.BooleanField(default=True)
    
    # Mailboxes to scan
    mailboxes = models.JSONField(default=list, blank=True)  # List of email addresses
    
    # Patterns to look for
    sender_patterns = models.JSONField(default=list, blank=True)
    subject_patterns = models.JSONField(default=list, blank=True)
    
    # Date range
    scan_from_date = models.DateField(blank=True, null=True)
    
    last_scan = models.DateTimeField(blank=True, null=True)
    last_scan_result = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'email_scan_configs'


class BankAccount(models.Model):
    """Connected bank/card accounts via Plaid"""
    
    class AccountType(models.TextChoices):
        CHECKING = 'checking', 'Checking'
        SAVINGS = 'savings', 'Savings'
        CREDIT_CARD = 'credit_card', 'Credit Card'
        DEBIT_CARD = 'debit_card', 'Debit Card'
        CORPORATE_CARD = 'corporate_card', 'Corporate Card'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='bank_accounts')
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='bank_accounts')
    
    # Account info
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    name = models.CharField(max_length=255)
    mask = models.CharField(max_length=10, blank=True)  # Last 4 digits
    institution_name = models.CharField(max_length=255, blank=True)
    
    # External IDs (encrypted)
    plaid_account_id = models.CharField(max_length=255, blank=True, null=True)
    plaid_item_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Scan settings
    auto_categorize = models.BooleanField(default=True)
    
    last_sync = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'bank_accounts'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.institution_name} - {self.name} (****{self.mask})"


class BankTransaction(models.Model):
    """Transactions from connected bank accounts"""
    
    class Category(models.TextChoices):
        SOFTWARE = 'software', 'Software Subscription'
        SAAS = 'saas', 'SaaS'
        CLOUD = 'cloud', 'Cloud Services'
        COMMUNICATION = 'communication', 'Communication'
        OTHER = 'other', 'Other'
        UNCATEGORIZED = 'uncategorized', 'Uncategorized'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='bank_transactions')
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='transactions')
    subscription = models.ForeignKey('services.Subscription', on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_transactions')
    
    # Transaction details
    transaction_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    
    merchant_name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    
    # Categorization
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.UNCATEGORIZED)
    is_subscription_related = models.BooleanField(default=False)
    
    # Matching
    is_matched = models.BooleanField(default=False)
    match_confidence = models.FloatField(default=0)
    matched_by = models.CharField(max_length=50, blank=True)  # 'ai', 'rule', 'manual'
    
    # External reference
    external_id = models.CharField(max_length=255, unique=True)
    raw_data = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'bank_transactions'
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['organization', 'transaction_date']),
            models.Index(fields=['merchant_name']),
        ]


class SSOConnection(models.Model):
    """SSO/Identity provider app connections"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='sso_connections')
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='sso_connections')
    subscription = models.ForeignKey('services.Subscription', on_delete=models.SET_NULL, null=True, blank=True, related_name='sso_connections')
    
    # App info from SSO provider
    app_name = models.CharField(max_length=255)
    app_id = models.CharField(max_length=255, blank=True)
    app_type = models.CharField(max_length=100, blank=True)
    
    # Stats
    assigned_users = models.IntegerField(default=0)
    active_users = models.IntegerField(default=0)
    last_login = models.DateTimeField(blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    last_sync = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sso_connections'
        ordering = ['app_name']
    
    def __str__(self):
        return f"{self.app_name}"


class SlackNotification(models.Model):
    """Slack notification configuration"""
    
    class NotificationType(models.TextChoices):
        ALL = 'all', 'All Notifications'
        ALERTS = 'alerts', 'Alerts Only'
        RENEWALS = 'renewals', 'Renewals Only'
        RECOMMENDATIONS = 'recommendations', 'Recommendations'
        WORKFLOWS = 'workflows', 'Workflow Updates'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='slack_notifications')
    integration = models.ForeignKey(Integration, on_delete=models.CASCADE, related_name='slack_notifications')
    
    channel_id = models.CharField(max_length=255)
    channel_name = models.CharField(max_length=255)
    
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices, default=NotificationType.ALL)
    
    # Filters
    min_severity = models.CharField(max_length=20, default='warning')
    min_savings = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    departments = models.JSONField(default=list, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'slack_notifications'


class Webhook(models.Model):
    """Custom webhooks for external integrations"""
    
    class EventType(models.TextChoices):
        SUBSCRIPTION_CREATED = 'subscription.created', 'Subscription Created'
        SUBSCRIPTION_UPDATED = 'subscription.updated', 'Subscription Updated'
        SUBSCRIPTION_CANCELLED = 'subscription.cancelled', 'Subscription Cancelled'
        RECOMMENDATION_CREATED = 'recommendation.created', 'Recommendation Created'
        ALERT_CREATED = 'alert.created', 'Alert Created'
        WORKFLOW_APPROVED = 'workflow.approved', 'Workflow Approved'
        WORKFLOW_REJECTED = 'workflow.rejected', 'Workflow Rejected'
        USAGE_THRESHOLD = 'usage.threshold', 'Usage Threshold'
        COST_THRESHOLD = 'cost.threshold', 'Cost Threshold'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='webhooks')
    
    name = models.CharField(max_length=255)
    url = models.URLField()
    secret = models.CharField(max_length=255)
    
    events = models.JSONField(default=list)  # List of EventType values
    
    is_active = models.BooleanField(default=True)
    
    # Retry settings
    max_retries = models.IntegerField(default=3)
    retry_interval_seconds = models.IntegerField(default=60)
    
    # Stats
    total_deliveries = models.IntegerField(default=0)
    successful_deliveries = models.IntegerField(default=0)
    failed_deliveries = models.IntegerField(default=0)
    
    last_triggered = models.DateTimeField(blank=True, null=True)
    last_success = models.DateTimeField(blank=True, null=True)
    last_failure = models.DateTimeField(blank=True, null=True)
    last_error = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'webhooks'
        ordering = ['name']


class WebhookDelivery(models.Model):
    """Log of webhook deliveries"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        RETRYING = 'retrying', 'Retrying'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name='deliveries')
    
    event_type = models.CharField(max_length=50)
    payload = models.JSONField(default=dict)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    response_status = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    
    attempts = models.IntegerField(default=0)
    next_retry = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = 'webhook_deliveries'
        ordering = ['-created_at']
