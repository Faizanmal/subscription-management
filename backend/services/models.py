"""
Services models for Subscription Waste Manager
Includes Subscriptions, Usage Tracking, Recommendations, and Analytics
"""

import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from users.models import Organization, Department, Team, User


class SoftwareVendor(models.Model):
    """Master list of known software vendors/products"""
    
    class Category(models.TextChoices):
        PRODUCTIVITY = 'productivity', 'Productivity'
        COMMUNICATION = 'communication', 'Communication'
        DEVELOPMENT = 'development', 'Development'
        DESIGN = 'design', 'Design'
        MARKETING = 'marketing', 'Marketing'
        SALES = 'sales', 'Sales'
        HR = 'hr', 'HR & Recruiting'
        FINANCE = 'finance', 'Finance & Accounting'
        SECURITY = 'security', 'Security'
        ANALYTICS = 'analytics', 'Analytics'
        PROJECT_MGMT = 'project_mgmt', 'Project Management'
        CRM = 'crm', 'CRM'
        CLOUD = 'cloud', 'Cloud Infrastructure'
        DATABASE = 'database', 'Database'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    website = models.URLField(blank=True, null=True)
    logo = models.URLField(blank=True, null=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    
    # Feature tags for redundancy detection
    features = models.JSONField(default=list, blank=True)
    
    # Known domains for email detection
    billing_domains = models.JSONField(default=list, blank=True)
    
    # Average pricing info (for estimates)
    avg_price_per_user = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    is_verified = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'software_vendors'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Subscription(models.Model):
    """Software subscription tracked by the organization"""
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        CANCELLED = 'cancelled', 'Cancelled'
        TRIAL = 'trial', 'Trial'
        PENDING = 'pending', 'Pending'
        SUSPENDED = 'suspended', 'Suspended'
    
    class BillingCycle(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        SEMI_ANNUAL = 'semi_annual', 'Semi-Annual'
        ANNUAL = 'annual', 'Annual'
        CUSTOM = 'custom', 'Custom'
    
    class DiscoverySource(models.TextChoices):
        MANUAL = 'manual', 'Manual Entry'
        EMAIL = 'email', 'Email Scan'
        SSO = 'sso', 'SSO/Identity Provider'
        BANK_FEED = 'bank_feed', 'Bank/Card Feed'
        EXPENSE = 'expense', 'Expense System'
        INTEGRATION = 'integration', 'Third-Party Integration'
        AI = 'ai', 'AI Discovery'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='subscriptions')
    vendor = models.ForeignKey(SoftwareVendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='subscriptions')
    
    # Basic info
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    custom_category = models.CharField(max_length=100, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    discovery_source = models.CharField(max_length=20, choices=DiscoverySource.choices, default=DiscoverySource.MANUAL)
    is_shadow_it = models.BooleanField(default=False, help_text="Discovered outside official procurement")
    
    # Ownership
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_subscriptions')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='subscriptions')
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='subscriptions')
    
    # Cost
    cost_per_unit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')
    billing_cycle = models.CharField(max_length=20, choices=BillingCycle.choices, default=BillingCycle.MONTHLY)
    
    # Licenses
    total_licenses = models.IntegerField(default=0)
    used_licenses = models.IntegerField(default=0)
    
    # Contract dates
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    
    # Contract details
    contract_id = models.CharField(max_length=255, blank=True, null=True)
    contract_document = models.FileField(upload_to='contracts/', blank=True, null=True)
    terms = models.JSONField(default=dict, blank=True)
    
    # External references
    external_id = models.CharField(max_length=255, blank=True, null=True)
    login_url = models.URLField(blank=True, null=True)
    admin_url = models.URLField(blank=True, null=True)
    
    # Metadata
    tags = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'subscriptions'
        ordering = ['name']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['renewal_date']),
            models.Index(fields=['department']),
        ]
    
    def __str__(self):
        return f"{self.organization.name} - {self.name}"
    
    @property
    def monthly_cost(self):
        """Calculate monthly cost regardless of billing cycle"""
        multipliers = {
            'monthly': 1,
            'quarterly': Decimal('0.333333'),
            'semi_annual': Decimal('0.166667'),
            'annual': Decimal('0.083333'),
            'custom': 1,
        }
        return self.cost_per_unit * self.total_licenses * multipliers.get(self.billing_cycle, 1)
    
    @property
    def annual_cost(self):
        """Calculate annual cost"""
        return self.monthly_cost * 12
    
    @property
    def unused_licenses(self):
        return max(0, self.total_licenses - self.used_licenses)
    
    @property
    def utilization_rate(self):
        if self.total_licenses == 0:
            return 0
        return (self.used_licenses / self.total_licenses) * 100
    
    @property
    def days_until_renewal(self):
        if not self.renewal_date:
            return None
        delta = self.renewal_date - timezone.now().date()
        return delta.days


class SubscriptionUser(models.Model):
    """Users assigned to a subscription"""
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        PENDING = 'pending', 'Pending Activation'
        SUSPENDED = 'suspended', 'Suspended'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='subscription_users')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='subscription_assignments')
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    external_user_id = models.CharField(max_length=255, blank=True, null=True)
    external_email = models.EmailField(blank=True, null=True)
    
    # License type (if subscription has tiers)
    license_type = models.CharField(max_length=100, blank=True, null=True)
    
    assigned_at = models.DateTimeField(default=timezone.now)
    last_used = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'subscription_users'
        unique_together = ['subscription', 'user']
        ordering = ['-last_used']
    
    def __str__(self):
        return f"{self.subscription.name} - {self.user.email}"


class UsageEvent(models.Model):
    """Individual usage events for tracking"""
    
    class EventType(models.TextChoices):
        LOGIN = 'login', 'Login'
        LOGOUT = 'logout', 'Logout'
        FEATURE_USE = 'feature_use', 'Feature Use'
        API_CALL = 'api_call', 'API Call'
        EXPORT = 'export', 'Export'
        IMPORT = 'import', 'Import'
        CREATE = 'create', 'Create'
        UPDATE = 'update', 'Update'
        DELETE = 'delete', 'Delete'
        VIEW = 'view', 'View'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='usage_events')
    subscription_user = models.ForeignKey(SubscriptionUser, on_delete=models.CASCADE, related_name='usage_events', null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='usage_events')
    
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    feature = models.CharField(max_length=255, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    
    class Meta:
        db_table = 'usage_events'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['subscription', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
        ]


class UsageMetrics(models.Model):
    """Aggregated usage metrics per subscription per period"""
    
    class Period(models.TextChoices):
        DAILY = 'daily', 'Daily'
        WEEKLY = 'weekly', 'Weekly'
        MONTHLY = 'monthly', 'Monthly'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='usage_metrics')
    
    period = models.CharField(max_length=10, choices=Period.choices)
    period_start = models.DateField()
    period_end = models.DateField()
    
    # User metrics
    active_users = models.IntegerField(default=0)
    total_users = models.IntegerField(default=0)
    new_users = models.IntegerField(default=0)
    churned_users = models.IntegerField(default=0)
    
    # Session metrics
    total_sessions = models.IntegerField(default=0)
    total_duration_minutes = models.IntegerField(default=0)
    avg_session_duration = models.FloatField(default=0)
    
    # Feature metrics
    feature_usage = models.JSONField(default=dict, blank=True)
    
    # Engagement score (0-100)
    engagement_score = models.FloatField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'usage_metrics'
        unique_together = ['subscription', 'period', 'period_start']
        ordering = ['-period_start']


class CostRecord(models.Model):
    """Historical cost records for subscriptions"""
    
    class RecordType(models.TextChoices):
        INVOICE = 'invoice', 'Invoice'
        PAYMENT = 'payment', 'Payment'
        REFUND = 'refund', 'Refund'
        CREDIT = 'credit', 'Credit'
        ADJUSTMENT = 'adjustment', 'Adjustment'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='cost_records')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='cost_records')
    
    record_type = models.CharField(max_length=20, choices=RecordType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    
    # Date range this covers
    period_start = models.DateField()
    period_end = models.DateField()
    
    # Payment details
    invoice_number = models.CharField(max_length=255, blank=True, null=True)
    invoice_url = models.URLField(blank=True, null=True)
    payment_method = models.CharField(max_length=100, blank=True, null=True)
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Source
    source = models.CharField(max_length=100, blank=True, null=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)
    
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'cost_records'
        ordering = ['-period_start']
        indexes = [
            models.Index(fields=['organization', 'period_start']),
            models.Index(fields=['subscription', 'period_start']),
        ]


class RedundancyGroup(models.Model):
    """Groups of subscriptions with overlapping functionality"""
    
    class Status(models.TextChoices):
        DETECTED = 'detected', 'Detected'
        REVIEWING = 'reviewing', 'Under Review'
        DISMISSED = 'dismissed', 'Dismissed'
        CONSOLIDATING = 'consolidating', 'Consolidating'
        RESOLVED = 'resolved', 'Resolved'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='redundancy_groups')
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DETECTED)
    
    # AI analysis
    overlap_score = models.FloatField(default=0, help_text="0-100 overlap percentage")
    overlapping_features = models.JSONField(default=list, blank=True)
    potential_savings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')
    
    # Recommendation
    recommended_action = models.TextField(blank=True)
    recommended_tool = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True, blank=True, related_name='recommended_for_consolidation')
    
    resolved_at = models.DateTimeField(blank=True, null=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_redundancies')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'redundancy_groups'
        ordering = ['-potential_savings']
    
    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class RedundancyGroupMember(models.Model):
    """Subscriptions that are part of a redundancy group"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(RedundancyGroup, on_delete=models.CASCADE, related_name='members')
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='redundancy_memberships')
    
    # Analysis
    is_primary = models.BooleanField(default=False, help_text="Recommended to keep")
    usage_score = models.FloatField(default=0)
    cost_effectiveness_score = models.FloatField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'redundancy_group_members'
        unique_together = ['group', 'subscription']


class Recommendation(models.Model):
    """AI-generated recommendations for cost optimization"""
    
    class Type(models.TextChoices):
        CANCEL = 'cancel', 'Cancel Subscription'
        DOWNGRADE = 'downgrade', 'Downgrade Plan'
        REDUCE_LICENSES = 'reduce_licenses', 'Reduce Licenses'
        CONSOLIDATE = 'consolidate', 'Consolidate Tools'
        REASSIGN = 'reassign', 'Reassign Licenses'
        RENEGOTIATE = 'renegotiate', 'Renegotiate Contract'
        SWITCH = 'switch', 'Switch Provider'
        UPGRADE = 'upgrade', 'Upgrade Plan'
        OTHER = 'other', 'Other'
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        EXPIRED = 'expired', 'Expired'
    
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='recommendations')
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='recommendations', null=True, blank=True)
    redundancy_group = models.ForeignKey(RedundancyGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name='recommendations')
    
    type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    
    # Content
    title = models.CharField(max_length=255)
    description = models.TextField()
    detailed_analysis = models.TextField(blank=True)
    
    # Financial impact
    estimated_savings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    savings_period = models.CharField(max_length=20, default='annual')
    currency = models.CharField(max_length=3, default='USD')
    confidence_score = models.FloatField(default=0, help_text="AI confidence 0-100")
    
    # Action details
    action_items = models.JSONField(default=list, blank=True)
    implementation_steps = models.JSONField(default=list, blank=True)
    risks = models.JSONField(default=list, blank=True)
    
    # Metadata
    ai_model_version = models.CharField(max_length=100, blank=True)
    data_points_used = models.JSONField(default=dict, blank=True)
    
    # Workflow
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_recommendations')
    reviewed_at = models.DateTimeField(blank=True, null=True)
    review_notes = models.TextField(blank=True)
    
    expires_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'recommendations'
        ordering = ['-estimated_savings', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['subscription', 'status']),
        ]
    
    def __str__(self):
        return f"{self.title}"


class Alert(models.Model):
    """System alerts for renewals, budget overages, etc."""
    
    class AlertType(models.TextChoices):
        RENEWAL = 'renewal', 'Upcoming Renewal'
        BUDGET_WARNING = 'budget_warning', 'Budget Warning'
        BUDGET_EXCEEDED = 'budget_exceeded', 'Budget Exceeded'
        UNUSED_LICENSE = 'unused_license', 'Unused Licenses'
        LOW_USAGE = 'low_usage', 'Low Usage'
        CONTRACT_EXPIRY = 'contract_expiry', 'Contract Expiring'
        PRICE_INCREASE = 'price_increase', 'Price Increase Detected'
        NEW_SUBSCRIPTION = 'new_subscription', 'New Subscription Discovered'
        REDUNDANCY = 'redundancy', 'Redundancy Detected'
        SECURITY = 'security', 'Security Alert'
        INTEGRATION = 'integration', 'Integration Issue'
        CUSTOM = 'custom', 'Custom Alert'
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
        SNOOZED = 'snoozed', 'Snoozed'
        RESOLVED = 'resolved', 'Resolved'
        DISMISSED = 'dismissed', 'Dismissed'
    
    class Severity(models.TextChoices):
        INFO = 'info', 'Info'
        WARNING = 'warning', 'Warning'
        ERROR = 'error', 'Error'
        CRITICAL = 'critical', 'Critical'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='alerts')
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    
    alert_type = models.CharField(max_length=20, choices=AlertType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.WARNING)
    
    title = models.CharField(max_length=255)
    message = models.TextField()
    action_required = models.BooleanField(default=False)
    action_url = models.URLField(blank=True, null=True)
    
    # Financial context
    financial_impact = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    
    # Trigger details
    trigger_date = models.DateField(null=True, blank=True)
    trigger_threshold = models.CharField(max_length=255, blank=True)
    
    metadata = models.JSONField(default=dict, blank=True)
    
    # Workflow
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_alerts')
    acknowledged_at = models.DateTimeField(blank=True, null=True)
    
    snoozed_until = models.DateTimeField(blank=True, null=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'alerts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status', 'severity']),
            models.Index(fields=['subscription', 'status']),
        ]
    
    def __str__(self):
        return f"{self.title}"


class Workflow(models.Model):
    """Approval workflows for subscription changes"""
    
    class WorkflowType(models.TextChoices):
        CANCELLATION = 'cancellation', 'Cancellation Request'
        LICENSE_CHANGE = 'license_change', 'License Change'
        NEW_SUBSCRIPTION = 'new_subscription', 'New Subscription'
        RENEWAL = 'renewal', 'Renewal Decision'
        BUDGET_APPROVAL = 'budget_approval', 'Budget Approval'
        REASSIGNMENT = 'reassignment', 'License Reassignment'
        CONSOLIDATION = 'consolidation', 'Tool Consolidation'
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CANCELLED = 'cancelled', 'Cancelled'
        COMPLETED = 'completed', 'Completed'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='workflows')
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='workflows', null=True, blank=True)
    recommendation = models.ForeignKey(Recommendation, on_delete=models.SET_NULL, null=True, blank=True, related_name='workflows')
    
    workflow_type = models.CharField(max_length=20, choices=WorkflowType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    justification = models.TextField(blank=True)
    
    # Request details
    request_data = models.JSONField(default=dict, blank=True)
    
    # Financial impact
    financial_impact = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    
    # Workflow tracking
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='requested_workflows')
    current_approver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_workflows')
    
    submitted_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'workflows'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['current_approver', 'status']),
        ]
    
    def __str__(self):
        return f"{self.title}"


class WorkflowStep(models.Model):
    """Individual steps in a workflow"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        SKIPPED = 'skipped', 'Skipped'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='steps')
    
    step_order = models.IntegerField()
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    approver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='workflow_steps')
    approved_at = models.DateTimeField(blank=True, null=True)
    comments = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'workflow_steps'
        ordering = ['workflow', 'step_order']
        unique_together = ['workflow', 'step_order']


class SavingsReport(models.Model):
    """Historical savings reports"""
    
    class Period(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        ANNUAL = 'annual', 'Annual'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='savings_reports')
    
    period = models.CharField(max_length=20, choices=Period.choices)
    period_start = models.DateField()
    period_end = models.DateField()
    
    # Totals
    total_spend = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    optimized_spend = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_savings = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')
    
    # Breakdown
    savings_by_type = models.JSONField(default=dict, blank=True)
    savings_by_department = models.JSONField(default=dict, blank=True)
    savings_by_action = models.JSONField(default=dict, blank=True)
    
    # Metrics
    subscriptions_analyzed = models.IntegerField(default=0)
    recommendations_generated = models.IntegerField(default=0)
    recommendations_implemented = models.IntegerField(default=0)
    
    # Report file
    report_file = models.FileField(upload_to='reports/', blank=True, null=True)
    
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        db_table = 'savings_reports'
        ordering = ['-period_start']
        unique_together = ['organization', 'period', 'period_start']


class BudgetTarget(models.Model):
    """Budget targets for departments/teams"""
    
    class Period(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        ANNUAL = 'annual', 'Annual'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='budget_targets')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True, related_name='budget_targets')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name='budget_targets')
    
    period = models.CharField(max_length=20, choices=Period.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    
    # Alert thresholds (percentages)
    warning_threshold = models.IntegerField(default=80)
    critical_threshold = models.IntegerField(default=100)
    
    # Tracking
    current_spend = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'budget_targets'
        ordering = ['-effective_from']


class AutomationWorkflow(models.Model):
    """Automation workflows with triggers and actions"""

    class Trigger(models.TextChoices):
        RENEWAL_APPROACHING = 'renewal_approaching', 'Renewal Approaching'
        LOW_USAGE = 'low_usage', 'Low Usage'
        BUDGET_EXCEEDED = 'budget_exceeded', 'Budget Exceeded'
        NEW_SUBSCRIPTION = 'new_subscription', 'New Subscription'
        RECOMMENDATION_CREATED = 'recommendation_created', 'Recommendation Created'
        SCHEDULED = 'scheduled', 'Scheduled'
        THRESHOLD = 'threshold', 'Threshold'

    class Action(models.TextChoices):
        SEND_EMAIL = 'send_email', 'Send Email'
        SEND_SLACK = 'send_slack', 'Send Slack'
        CREATE_TASK = 'create_task', 'Create Task'
        UPDATE_SUBSCRIPTION = 'update_subscription', 'Update Subscription'
        CREATE_APPROVAL = 'create_approval', 'Create Approval'
        WEBHOOK = 'webhook', 'Webhook'
        NOTIFY = 'notify', 'Notify'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='automation_workflows'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    trigger = models.CharField(max_length=40, choices=Trigger.choices)
    trigger_config = models.JSONField(default=dict, blank=True)
    conditions = models.JSONField(default=dict, blank=True)
    action = models.CharField(max_length=40, choices=Action.choices)
    action_config = models.JSONField(default=dict, blank=True)

    is_active = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    run_count = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_automation_workflows'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'automation_workflows'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'is_active']),
            models.Index(fields=['organization', 'trigger']),
        ]

    def __str__(self):
        return f"{self.name} ({self.trigger} → {self.action})"


class WorkflowExecution(models.Model):
    """Execution log for automation workflows"""

    class Status(models.TextChoices):
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        AutomationWorkflow, on_delete=models.CASCADE, related_name='executions'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    trigger_reason = models.CharField(max_length=500, blank=True)
    steps_completed = models.IntegerField(default=0)
    total_steps = models.IntegerField(default=1)
    error_message = models.TextField(blank=True)
    output_data = models.JSONField(default=dict, blank=True)

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workflow_executions'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['workflow', 'status']),
            models.Index(fields=['workflow', 'started_at']),
        ]

    def __str__(self):
        return f"Execution {self.id} of {self.workflow.name} ({self.status})"
