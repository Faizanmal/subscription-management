"""
Services serializers for Subscription Waste Manager
"""

from datetime import date, datetime
from decimal import Decimal

from rest_framework import serializers
from api.serializers import OrganizationModelSerializer
from services.models import (
    SoftwareVendor, Subscription, SubscriptionUser,
    UsageEvent, UsageMetrics, CostRecord,
    RedundancyGroup, RedundancyGroupMember,
    Recommendation, Alert, Workflow, WorkflowStep,
    SavingsReport, BudgetTarget,
    AutomationWorkflow, WorkflowExecution,
)


BILLING_CYCLE_ALIASES = {
    'one_time': 'custom',
    'usage_based': 'custom',
}


def coerce_date(value):
    """Accept YYYY-MM-DD or ISO datetimes from the frontend date picker."""
    if value in (None, ''):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and 'T' in value:
        return value.split('T')[0]
    return value


class SubscriptionWriteMixin:
    """Map frontend field names onto the Subscription model."""

    def to_internal_value(self, data):
        payload = data.copy() if hasattr(data, 'copy') else dict(data)
        payload = dict(payload)

        if not payload.get('vendor') and payload.get('vendor_id'):
            payload['vendor'] = payload['vendor_id']
        if not payload.get('owner') and payload.get('owner_id'):
            payload['owner'] = payload['owner_id']
        if payload.get('used_licenses') in (None, '') and payload.get('assigned_licenses') not in (None, ''):
            payload['used_licenses'] = payload['assigned_licenses']

        for key in ('start_date', 'end_date', 'renewal_date'):
            if payload.get(key):
                payload[key] = coerce_date(payload[key])

        cycle = payload.get('billing_cycle')
        if cycle in BILLING_CYCLE_ALIASES:
            payload['billing_cycle'] = BILLING_CYCLE_ALIASES[cycle]

        monthly = payload.get('monthly_cost')
        if monthly not in (None, ''):
            licenses = payload.get('total_licenses')
            try:
                licenses = int(licenses) if licenses not in (None, '') else None
            except (TypeError, ValueError):
                licenses = None
            if licenses is None and getattr(self, 'instance', None):
                licenses = self.instance.total_licenses
            licenses = licenses or 1
            payload['cost_per_unit'] = (
                Decimal(str(monthly)) / Decimal(licenses)
            ).quantize(Decimal('0.01'))

        return super().to_internal_value(payload)


class SoftwareVendorSerializer(OrganizationModelSerializer):
    """Software vendor serializer"""
    
    class Meta:
        model = SoftwareVendor
        fields = [
            'id', 'name', 'slug', 'description', 'website', 'logo',
            'category', 'features', 'avg_price_per_user', 'is_verified',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'slug', 'is_verified', 'created_at', 'updated_at']


class SubscriptionSerializer(SubscriptionWriteMixin, OrganizationModelSerializer):
    """Subscription serializer"""
    
    vendor_id = serializers.UUIDField(read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, allow_null=True)
    vendor_logo = serializers.CharField(source='vendor.logo', read_only=True, allow_null=True, allow_blank=True)
    owner_id = serializers.UUIDField(read_only=True, allow_null=True)
    owner_name = serializers.CharField(source='owner.full_name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    team_name = serializers.CharField(source='team.name', read_only=True, allow_null=True)
    monthly_cost = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    annual_cost = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    assigned_licenses = serializers.IntegerField(source='used_licenses', read_only=True)
    unused_licenses = serializers.IntegerField(read_only=True)
    utilization_rate = serializers.FloatField(read_only=True)
    days_until_renewal = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Subscription
        fields = [
            'id', 'name', 'description', 'vendor', 'vendor_id', 'vendor_name', 'vendor_logo',
            'status', 'discovery_source', 'is_shadow_it', 'custom_category',
            'owner', 'owner_id', 'owner_name', 'department', 'department_name', 'team', 'team_name',
            'cost_per_unit', 'currency', 'billing_cycle',
            'monthly_cost', 'annual_cost',
            'total_licenses', 'used_licenses', 'assigned_licenses', 'unused_licenses',
            'utilization_rate',
            'start_date', 'end_date', 'renewal_date', 'auto_renew', 'days_until_renewal',
            'contract_id', 'contract_document', 'terms',
            'external_id', 'login_url', 'admin_url',
            'tags', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SubscriptionCreateSerializer(SubscriptionWriteMixin, OrganizationModelSerializer):
    """Serializer for creating subscriptions"""
    
    class Meta:
        model = Subscription
        fields = [
            'name', 'description', 'vendor', 'custom_category', 'status',
            'owner', 'department', 'team',
            'cost_per_unit', 'currency', 'billing_cycle',
            'total_licenses', 'used_licenses',
            'start_date', 'end_date', 'renewal_date', 'auto_renew',
            'contract_id', 'contract_document', 'terms',
            'login_url', 'admin_url', 'tags', 'notes'
        ]
    
    def create(self, validated_data):
        validated_data['organization'] = self.context['request'].user.organization
        validated_data['discovery_source'] = 'manual'
        return super().create(validated_data)

    def to_representation(self, instance):
        return SubscriptionSerializer(instance, context=self.context).data


class SubscriptionListSerializer(OrganizationModelSerializer):
    """Lightweight subscription serializer for lists"""
    
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, allow_null=True)
    vendor_logo = serializers.CharField(source='vendor.logo', read_only=True, allow_null=True, allow_blank=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    monthly_cost = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    assigned_licenses = serializers.IntegerField(source='used_licenses', read_only=True)
    utilization_rate = serializers.FloatField(read_only=True)
    days_until_renewal = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Subscription
        fields = [
            'id', 'name', 'vendor_name', 'vendor_logo', 'status',
            'department_name', 'monthly_cost', 'currency',
            'total_licenses', 'used_licenses', 'assigned_licenses', 'utilization_rate',
            'renewal_date', 'days_until_renewal', 'is_shadow_it'
        ]


class SubscriptionUserSerializer(OrganizationModelSerializer):
    """Subscription user assignment serializer"""
    
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)
    
    class Meta:
        model = SubscriptionUser
        fields = [
            'id', 'subscription', 'subscription_name',
            'user', 'user_email', 'user_name',
            'status', 'external_user_id', 'external_email', 'license_type',
            'assigned_at', 'last_used', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'created_at', 'updated_at']


class UsageEventSerializer(OrganizationModelSerializer):
    """Usage event serializer"""
    
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = UsageEvent
        fields = [
            'id', 'subscription', 'subscription_user', 'user', 'user_email',
            'event_type', 'feature', 'metadata', 'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']


class UsageMetricsSerializer(OrganizationModelSerializer):
    """Usage metrics serializer"""
    
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)
    
    class Meta:
        model = UsageMetrics
        fields = [
            'id', 'subscription', 'subscription_name',
            'period', 'period_start', 'period_end',
            'active_users', 'total_users', 'new_users', 'churned_users',
            'total_sessions', 'total_duration_minutes', 'avg_session_duration',
            'feature_usage', 'engagement_score',
            'created_at', 'updated_at'
        ]
        read_only_fields = '__all__'


class CostRecordSerializer(OrganizationModelSerializer):
    """Cost record serializer"""
    
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)
    
    class Meta:
        model = CostRecord
        fields = [
            'id', 'subscription', 'subscription_name',
            'record_type', 'amount', 'currency',
            'period_start', 'period_end',
            'invoice_number', 'invoice_url', 'payment_method', 'transaction_id',
            'source', 'notes', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class RedundancyGroupMemberSerializer(OrganizationModelSerializer):
    """Redundancy group member serializer"""
    
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)
    subscription_cost = serializers.DecimalField(
        source='subscription.monthly_cost', max_digits=12, decimal_places=2, read_only=True
    )
    
    class Meta:
        model = RedundancyGroupMember
        fields = [
            'id', 'subscription', 'subscription_name', 'subscription_cost',
            'is_primary', 'usage_score', 'cost_effectiveness_score'
        ]


class RedundancyGroupSerializer(OrganizationModelSerializer):
    """Redundancy group serializer"""
    
    members = RedundancyGroupMemberSerializer(many=True, read_only=True)
    recommended_tool_name = serializers.CharField(
        source='recommended_tool.name', read_only=True
    )
    
    class Meta:
        model = RedundancyGroup
        fields = [
            'id', 'name', 'description', 'category', 'status',
            'overlap_score', 'overlapping_features', 'potential_savings', 'currency',
            'recommended_action', 'recommended_tool', 'recommended_tool_name',
            'members', 'resolved_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RecommendationSerializer(OrganizationModelSerializer):
    """Recommendation serializer"""
    
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)
    
    class Meta:
        model = Recommendation
        fields = [
            'id', 'subscription', 'subscription_name', 'redundancy_group',
            'type', 'status', 'priority',
            'title', 'description', 'detailed_analysis',
            'estimated_savings', 'savings_period', 'currency', 'confidence_score',
            'action_items', 'implementation_steps', 'risks',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes',
            'expires_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RecommendationActionSerializer(serializers.Serializer):
    """Serializer for recommendation actions"""
    
    action = serializers.ChoiceField(choices=['approve', 'reject', 'defer'])
    notes = serializers.CharField(required=False, allow_blank=True)
    defer_until = serializers.DateTimeField(required=False)


class AlertSerializer(OrganizationModelSerializer):
    """Alert serializer"""
    
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)
    acknowledged_by_name = serializers.CharField(
        source='acknowledged_by.full_name', read_only=True
    )
    
    class Meta:
        model = Alert
        fields = [
            'id', 'subscription', 'subscription_name',
            'alert_type', 'status', 'severity',
            'title', 'message', 'action_required', 'action_url',
            'financial_impact', 'currency',
            'trigger_date', 'trigger_threshold', 'metadata',
            'acknowledged_by', 'acknowledged_by_name', 'acknowledged_at',
            'snoozed_until', 'resolved_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AlertActionSerializer(serializers.Serializer):
    """Serializer for alert actions"""
    
    action = serializers.ChoiceField(choices=['acknowledge', 'snooze', 'resolve', 'dismiss'])
    snooze_until = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class WorkflowStepSerializer(OrganizationModelSerializer):
    """Workflow step serializer"""
    
    approver_name = serializers.CharField(source='approver.full_name', read_only=True)
    approver_email = serializers.CharField(source='approver.email', read_only=True)
    
    class Meta:
        model = WorkflowStep
        fields = [
            'id', 'step_order', 'name', 'description',
            'status', 'approver', 'approver_name', 'approver_email',
            'approved_at', 'comments'
        ]


class WorkflowSerializer(OrganizationModelSerializer):
    """Workflow serializer"""
    
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    current_approver_name = serializers.CharField(
        source='current_approver.full_name', read_only=True
    )
    steps = WorkflowStepSerializer(many=True, read_only=True)
    
    class Meta:
        model = Workflow
        fields = [
            'id', 'subscription', 'subscription_name', 'recommendation',
            'workflow_type', 'status',
            'title', 'description', 'justification',
            'request_data', 'financial_impact', 'currency',
            'requested_by', 'requested_by_name',
            'current_approver', 'current_approver_name',
            'steps', 'submitted_at', 'completed_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'requested_by', 'created_at', 'updated_at']


class WorkflowCreateSerializer(OrganizationModelSerializer):
    """Serializer for creating workflows"""
    
    class Meta:
        model = Workflow
        fields = [
            'subscription', 'recommendation', 'workflow_type',
            'title', 'description', 'justification', 'request_data'
        ]
    
    def create(self, validated_data):
        validated_data['organization'] = self.context['request'].user.organization
        validated_data['requested_by'] = self.context['request'].user
        return super().create(validated_data)


class WorkflowActionSerializer(serializers.Serializer):
    """Serializer for workflow approval actions"""
    
    action = serializers.ChoiceField(choices=['approve', 'reject', 'cancel'])
    comments = serializers.CharField(required=False, allow_blank=True)


class SavingsReportSerializer(OrganizationModelSerializer):
    """Savings report serializer"""
    
    generated_by_name = serializers.CharField(
        source='generated_by.full_name', read_only=True
    )
    
    class Meta:
        model = SavingsReport
        fields = [
            'id', 'period', 'period_start', 'period_end',
            'total_spend', 'optimized_spend', 'total_savings', 'currency',
            'savings_by_type', 'savings_by_department', 'savings_by_action',
            'subscriptions_analyzed', 'recommendations_generated', 'recommendations_implemented',
            'report_file', 'generated_at', 'generated_by', 'generated_by_name'
        ]
        read_only_fields = '__all__'


class BudgetTargetSerializer(OrganizationModelSerializer):
    """Budget target serializer"""
    
    department_name = serializers.CharField(source='department.name', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    utilization_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = BudgetTarget
        fields = [
            'id', 'department', 'department_name', 'team', 'team_name',
            'period', 'amount', 'currency',
            'warning_threshold', 'critical_threshold',
            'current_spend', 'utilization_percentage',
            'effective_from', 'effective_to',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'current_spend', 'created_at', 'updated_at']
    
    def get_utilization_percentage(self, obj):
        if obj.amount == 0:
            return 0
        return round((obj.current_spend / obj.amount) * 100, 2)


# Dashboard & Analytics Serializers

class DashboardSummarySerializer(serializers.Serializer):
    """Dashboard summary data"""
    # Field names match the frontend DashboardStats type
    total_subscriptions = serializers.IntegerField()
    active_subscriptions = serializers.IntegerField()
    total_monthly_cost = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_annual_cost = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_licenses = serializers.IntegerField()
    used_licenses = serializers.IntegerField()
    unused_licenses = serializers.IntegerField()
    avg_utilization = serializers.FloatField()
    potential_savings = serializers.DecimalField(max_digits=14, decimal_places=2)
    upcoming_renewals = serializers.IntegerField()
    pending_recommendations = serializers.IntegerField()
    pending_workflows = serializers.IntegerField()
    unread_alerts = serializers.IntegerField()
    currency = serializers.CharField()


class SpendByCategorySerializer(serializers.Serializer):
    """Spend by category breakdown"""
    
    category = serializers.CharField()
    spend = serializers.DecimalField(max_digits=14, decimal_places=2)
    percentage = serializers.FloatField()
    subscription_count = serializers.IntegerField()


class SpendTrendSerializer(serializers.Serializer):
    """Spend trend data point"""
    
    period = serializers.CharField()
    date = serializers.DateField()
    spend = serializers.DecimalField(max_digits=14, decimal_places=2)
    subscription_count = serializers.IntegerField()


class TopSpendingSubscriptionSerializer(serializers.Serializer):
    """Top spending subscription data"""
    
    id = serializers.UUIDField()
    name = serializers.CharField()
    vendor_name = serializers.CharField()
    monthly_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    annual_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    utilization_rate = serializers.FloatField()
    department = serializers.CharField()


class AutomationWorkflowSerializer(OrganizationModelSerializer):
    """Serializer for automation workflows"""
    created_by_name = serializers.SerializerMethodField()
    trigger_type = serializers.CharField(source='trigger')

    class Meta:
        model = AutomationWorkflow
        fields = [
            'id', 'organization_id', 'name', 'description',
            'trigger', 'trigger_type', 'trigger_config', 'conditions',
            'action', 'action_config',
            'is_active', 'last_run_at', 'run_count',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization_id', 'last_run_at', 'run_count', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
        return None


class WorkflowExecutionSerializer(OrganizationModelSerializer):
    """Serializer for workflow execution logs"""
    workflow_id = serializers.UUIDField(source='workflow.id', read_only=True)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)

    class Meta:
        model = WorkflowExecution
        fields = [
            'id', 'workflow_id', 'workflow_name',
            'status', 'trigger_reason',
            'steps_completed', 'total_steps',
            'error_message', 'output_data',
            'started_at', 'completed_at', 'created_at',
        ]
        read_only_fields = ['id', 'workflow_id', 'workflow_name', 'started_at', 'created_at']
