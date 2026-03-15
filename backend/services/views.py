"""
Services views for Subscription Waste Manager
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count, F, Q
from django.db.models.functions import TruncMonth
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from services.models import (
    SoftwareVendor, Subscription, SubscriptionUser,
    UsageEvent, UsageMetrics, CostRecord,
    RedundancyGroup, Recommendation, Alert, Workflow, WorkflowStep,
    SavingsReport, BudgetTarget, AutomationWorkflow, WorkflowExecution
)
from services.serializers import (
    SoftwareVendorSerializer,
    SubscriptionSerializer, SubscriptionCreateSerializer, SubscriptionListSerializer,
    SubscriptionUserSerializer,
    UsageEventSerializer, UsageMetricsSerializer, CostRecordSerializer,
    RedundancyGroupSerializer,
    RecommendationSerializer, RecommendationActionSerializer,
    AlertSerializer, AlertActionSerializer,
    WorkflowSerializer, WorkflowCreateSerializer, WorkflowActionSerializer,
    SavingsReportSerializer, BudgetTargetSerializer,
    DashboardSummarySerializer, AutomationWorkflowSerializer,
    WorkflowExecutionSerializer
)
from api.permissions import IsFinance, IsOrgMember


class SoftwareVendorViewSet(viewsets.ReadOnlyModelViewSet):
    """Software vendor viewset (read-only catalog)"""
    queryset = SoftwareVendor.objects.filter(is_verified=True)
    serializer_class = SoftwareVendorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['name', 'description']
    ordering_fields = ['name']
    pagination_class = None


class SubscriptionViewSet(viewsets.ModelViewSet):
    """Subscription management viewset"""
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'department', 'team', 'vendor', 'is_shadow_it', 'billing_cycle']
    search_fields = ['name', 'description', 'vendor__name']
    ordering_fields = ['name', 'cost_per_unit', 'renewal_date', 'created_at', 'utilization_rate']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SubscriptionCreateSerializer
        if self.action == 'list':
            return SubscriptionListSerializer
        return SubscriptionSerializer
    
    def get_queryset(self):
        queryset = Subscription.objects.filter(organization=self.request.user.organization)
        
        # Filter by user's department/team if not admin
        user = self.request.user
        if user.role and user.role.type == 'department_lead':
            queryset = queryset.filter(department=user.department)
        elif user.role and user.role.type == 'team_lead':
            queryset = queryset.filter(team=user.team)
        
        return queryset.select_related('vendor', 'owner', 'department', 'team')
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get subscription summary statistics"""
        queryset = self.get_queryset()
        active = queryset.filter(status='active')
        
        total_monthly = sum(s.monthly_cost for s in active)
        total_licenses = active.aggregate(total=Sum('total_licenses'))['total'] or 0
        used_licenses = active.aggregate(total=Sum('used_licenses'))['total'] or 0
        
        return Response({
            'total_subscriptions': queryset.count(),
            'active_subscriptions': active.count(),
            'inactive_subscriptions': queryset.filter(status='inactive').count(),
            'total_monthly_spend': total_monthly,
            'total_annual_spend': total_monthly * 12,
            'total_licenses': total_licenses,
            'used_licenses': used_licenses,
            'unused_licenses': total_licenses - used_licenses,
            'avg_utilization': round(
                (used_licenses / total_licenses * 100) if total_licenses > 0 else 0, 2
            ),
            'shadow_it_count': active.filter(is_shadow_it=True).count(),
        })
    
    @action(detail=False, methods=['get'])
    def upcoming_renewals(self, request):
        """Get subscriptions with upcoming renewals"""
        days = int(request.query_params.get('days', 30))
        threshold_date = timezone.now().date() + timezone.timedelta(days=days)
        
        subscriptions = self.get_queryset().filter(
            status='active',
            renewal_date__lte=threshold_date,
            renewal_date__gte=timezone.now().date()
        ).order_by('renewal_date')
        
        serializer = SubscriptionListSerializer(subscriptions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def low_utilization(self, request):
        """Get subscriptions with low utilization"""
        threshold = int(request.query_params.get('threshold', 30))
        
        subscriptions = self.get_queryset().filter(
            status='active',
            total_licenses__gt=0
        ).annotate(
            utilization=F('used_licenses') * 100.0 / F('total_licenses')
        ).filter(utilization__lt=threshold).order_by('utilization')
        
        serializer = SubscriptionListSerializer(subscriptions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get users assigned to this subscription"""
        subscription = self.get_object()
        users = subscription.subscription_users.select_related('user')
        serializer = SubscriptionUserSerializer(users, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def assign_user(self, request, pk=None):
        """Assign a user to this subscription"""
        subscription = self.get_object()
        user_id = request.data.get('user_id')
        license_type = request.data.get('license_type', '')
        
        from users.models import User
        try:
            user = User.objects.get(id=user_id, organization=request.user.organization)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if subscription.subscription_users.filter(user=user).exists():
            return Response({'error': 'User already assigned'}, status=status.HTTP_400_BAD_REQUEST)
        
        assignment = SubscriptionUser.objects.create(
            subscription=subscription,
            user=user,
            license_type=license_type
        )
        
        # Update used licenses count
        subscription.used_licenses = subscription.subscription_users.filter(status='active').count()
        subscription.save()
        
        serializer = SubscriptionUserSerializer(assignment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def remove_user(self, request, pk=None):
        """Remove a user from this subscription"""
        subscription = self.get_object()
        user_id = request.data.get('user_id')
        
        try:
            assignment = subscription.subscription_users.get(user_id=user_id)
            assignment.delete()
            
            # Update used licenses count
            subscription.used_licenses = subscription.subscription_users.filter(status='active').count()
            subscription.save()
            
            return Response({'message': 'User removed from subscription'})
        except SubscriptionUser.DoesNotExist:
            return Response({'error': 'User not assigned to this subscription'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def usage_history(self, request, pk=None):
        """Get usage history for this subscription"""
        subscription = self.get_object()
        period = request.query_params.get('period', 'monthly')
        
        metrics = subscription.usage_metrics.filter(period=period).order_by('-period_start')[:12]
        serializer = UsageMetricsSerializer(metrics, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def cost_history(self, request, pk=None):
        """Get cost history for this subscription"""
        subscription = self.get_object()
        
        records = subscription.cost_records.order_by('-period_start')[:24]
        serializer = CostRecordSerializer(records, many=True)
        return Response(serializer.data)


class UsageEventViewSet(viewsets.ModelViewSet):
    """Usage event viewset"""
    serializer_class = UsageEventSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['subscription', 'user', 'event_type']
    ordering_fields = ['timestamp']
    
    def get_queryset(self):
        return UsageEvent.objects.filter(
            subscription__organization=self.request.user.organization
        ).select_related('subscription', 'user')


class UsageMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    """Usage metrics viewset (read-only)"""
    serializer_class = UsageMetricsSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['subscription', 'period']
    ordering_fields = ['period_start']
    
    def get_queryset(self):
        return UsageMetrics.objects.filter(
            subscription__organization=self.request.user.organization
        ).select_related('subscription')


class CostRecordViewSet(viewsets.ModelViewSet):
    """Cost record viewset"""
    serializer_class = CostRecordSerializer
    permission_classes = [IsAuthenticated, IsFinance]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['subscription', 'record_type']
    search_fields = ['invoice_number']
    ordering_fields = ['period_start', 'amount']
    
    def get_queryset(self):
        return CostRecord.objects.filter(
            organization=self.request.user.organization
        ).select_related('subscription')
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class RedundancyGroupViewSet(viewsets.ModelViewSet):
    """Redundancy group viewset"""
    serializer_class = RedundancyGroupSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'category']
    ordering_fields = ['potential_savings', 'created_at']
    
    def get_queryset(self):
        return RedundancyGroup.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related('members', 'members__subscription')
    
    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss a redundancy detection"""
        group = self.get_object()
        group.status = 'dismissed'
        group.resolved_at = timezone.now()
        group.resolved_by = request.user
        group.save()
        return Response({'message': 'Redundancy dismissed'})
    
    @action(detail=True, methods=['post'])
    def start_consolidation(self, request, pk=None):
        """Start consolidation process"""
        group = self.get_object()
        group.status = 'consolidating'
        group.save()
        
        # Create workflow for consolidation
        Workflow.objects.create(
            organization=request.user.organization,
            workflow_type='consolidation',
            title=f"Consolidate: {group.name}",
            description=group.recommended_action,
            request_data={'redundancy_group_id': str(group.id)},
            requested_by=request.user,
            status='pending'
        )
        
        return Response({'message': 'Consolidation workflow started'})


class RecommendationViewSet(viewsets.ModelViewSet):
    """Recommendation viewset"""
    serializer_class = RecommendationSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'type', 'priority', 'subscription']
    search_fields = ['title', 'description']
    ordering_fields = ['estimated_savings', 'priority', 'created_at']
    
    def get_queryset(self):
        return Recommendation.objects.filter(
            organization=self.request.user.organization
        ).select_related('subscription', 'reviewed_by')
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get recommendation summary"""
        queryset = self.get_queryset()
        pending = queryset.filter(status='pending')
        
        total_potential_savings = pending.aggregate(
            total=Sum('estimated_savings')
        )['total'] or 0
        
        by_type = pending.values('type').annotate(
            count=Count('id'),
            savings=Sum('estimated_savings')
        )
        
        by_priority = pending.values('priority').annotate(
            count=Count('id')
        )
        
        return Response({
            'total_pending': pending.count(),
            'total_potential_savings': total_potential_savings,
            'by_type': list(by_type),
            'by_priority': list(by_priority),
        })
    
    @action(detail=True, methods=['post'])
    def take_action(self, request, pk=None):
        """Take action on a recommendation"""
        recommendation = self.get_object()
        serializer = RecommendationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        action = serializer.validated_data['action']
        notes = serializer.validated_data.get('notes', '')
        
        if action == 'approve':
            recommendation.status = 'approved'
            # Create workflow if needed
            if recommendation.type in ['cancel', 'downgrade', 'reduce_licenses', 'consolidate']:
                Workflow.objects.create(
                    organization=request.user.organization,
                    subscription=recommendation.subscription,
                    recommendation=recommendation,
                    workflow_type=self._get_workflow_type(recommendation.type),
                    title=recommendation.title,
                    description=recommendation.description,
                    request_data={'recommendation_id': str(recommendation.id)},
                    requested_by=request.user,
                    status='pending'
                )
        elif action == 'reject':
            recommendation.status = 'rejected'
        elif action == 'defer':
            recommendation.expires_at = serializer.validated_data.get('defer_until')
        
        recommendation.reviewed_by = request.user
        recommendation.reviewed_at = timezone.now()
        recommendation.review_notes = notes
        recommendation.save()
        
        return Response(RecommendationSerializer(recommendation).data)
    
    def _get_workflow_type(self, rec_type):
        mapping = {
            'cancel': 'cancellation',
            'downgrade': 'license_change',
            'reduce_licenses': 'license_change',
            'consolidate': 'consolidation',
            'reassign': 'reassignment',
        }
        return mapping.get(rec_type, 'license_change')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        recommendation = self.get_object()
        recommendation.status = 'approved'
        recommendation.reviewed_by = request.user
        recommendation.reviewed_at = timezone.now()
        recommendation.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

        if recommendation.type in ['cancel', 'downgrade', 'remove_licenses', 'consolidate']:
            Workflow.objects.create(
                organization=request.user.organization,
                subscription=recommendation.subscription,
                recommendation=recommendation,
                workflow_type=self._get_workflow_type(recommendation.type),
                title=recommendation.title,
                description=recommendation.description,
                request_data={'recommendation_id': str(recommendation.id)},
                requested_by=request.user,
                status='pending'
            )

        return Response(self.get_serializer(recommendation).data)

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        recommendation = self.get_object()
        reason = request.data.get('reason', '')

        recommendation.status = 'rejected'
        recommendation.reviewed_by = request.user
        recommendation.reviewed_at = timezone.now()
        recommendation.review_notes = reason
        recommendation.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'
        ])

        return Response(self.get_serializer(recommendation).data)

    @action(detail=True, methods=['post'])
    def implement(self, request, pk=None):
        recommendation = self.get_object()
        recommendation.status = 'completed'
        recommendation.reviewed_by = request.user
        recommendation.reviewed_at = timezone.now()
        recommendation.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])
        return Response(self.get_serializer(recommendation).data)

    @action(detail=False, methods=['get'], url_path='quick-wins')
    def quick_wins(self, request):
        limit = int(request.query_params.get('limit', 5))
        queryset = self.get_queryset().filter(status='pending').order_by('-estimated_savings')[:limit]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='savings-summary')
    def savings_summary(self, request):
        qs = self.get_queryset()

        total_potential = qs.filter(status='pending').aggregate(total=Sum('estimated_savings'))['total'] or 0
        implemented = qs.filter(status='implemented').aggregate(total=Sum('estimated_savings'))['total'] or 0
        by_type = qs.filter(status='pending').values('type').annotate(
            count=Count('id'),
            savings=Sum('estimated_savings')
        ).order_by('-savings')

        return Response({
            'total_potential': total_potential,
            'implemented': implemented,
            'by_type': list(by_type),
        })

    @action(detail=False, methods=['post'])
    def generate(self, request):
        from services.tasks import generate_ai_recommendations

        task = generate_ai_recommendations.delay(str(request.user.organization.id))
        return Response({'task_id': task.id, 'message': 'Recommendation generation started'})


class AutomationWorkflowViewSet(viewsets.ModelViewSet):
    """Automation workflow viewset"""
    serializer_class = AutomationWorkflowSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'trigger', 'action']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'last_run_at', 'run_count']

    def get_queryset(self):
        return AutomationWorkflow.objects.filter(
            organization=self.request.user.organization
        ).select_related('created_by')

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        workflow = self.get_object()
        workflow.is_active = not workflow.is_active
        workflow.save(update_fields=['is_active', 'updated_at'])
        return Response(self.get_serializer(workflow).data)

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        from services.tasks import execute_automation_workflow

        workflow = self.get_object()
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            status=WorkflowExecution.Status.RUNNING,
            trigger_reason='manual',
            total_steps=1,
        )
        execute_automation_workflow.delay(str(workflow.id), str(execution.id))
        return Response(WorkflowExecutionSerializer(execution).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def executions(self, request, pk=None):
        workflow = self.get_object()
        executions = workflow.executions.order_by('-started_at')
        serializer = WorkflowExecutionSerializer(executions, many=True)
        return Response(serializer.data)


class WorkflowExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """Workflow execution history viewset"""
    serializer_class = WorkflowExecutionSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'workflow']
    ordering_fields = ['started_at', 'completed_at', 'created_at']

    def get_queryset(self):
        return WorkflowExecution.objects.filter(
            workflow__organization=self.request.user.organization
        ).select_related('workflow')


class AlertViewSet(viewsets.ModelViewSet):
    """Alert viewset"""
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'severity', 'alert_type', 'subscription']
    ordering_fields = ['created_at', 'severity']
    
    def get_queryset(self):
        return Alert.objects.filter(
            organization=self.request.user.organization
        ).select_related('subscription', 'acknowledged_by')
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active alerts only"""
        alerts = self.get_queryset().filter(status='active').order_by('-severity', '-created_at')
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def take_action(self, request, pk=None):
        """Take action on an alert"""
        alert = self.get_object()
        serializer = AlertActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        action = serializer.validated_data['action']
        
        if action == 'acknowledge':
            alert.status = 'acknowledged'
            alert.acknowledged_by = request.user
            alert.acknowledged_at = timezone.now()
        elif action == 'snooze':
            alert.status = 'snoozed'
            alert.snoozed_until = serializer.validated_data.get('snooze_until')
        elif action == 'resolve':
            alert.status = 'resolved'
            alert.resolved_at = timezone.now()
        elif action == 'dismiss':
            alert.status = 'dismissed'
        
        alert.save()
        
        return Response(AlertSerializer(alert).data)
    
    @action(detail=False, methods=['get'])
    def counts(self, request):
        """Get alert counts by status and severity"""
        queryset = self.get_queryset()
        
        by_status = queryset.values('status').annotate(count=Count('id'))
        by_severity = queryset.filter(status='active').values('severity').annotate(count=Count('id'))
        
        return Response({
            'by_status': {item['status']: item['count'] for item in by_status},
            'by_severity': {item['severity']: item['count'] for item in by_severity},
            'total_active': queryset.filter(status='active').count(),
        })


class WorkflowViewSet(viewsets.ModelViewSet):
    """Workflow viewset"""
    permission_classes = [IsAuthenticated, IsOrgMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'workflow_type', 'subscription']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'submitted_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return WorkflowCreateSerializer
        return WorkflowSerializer
    
    def get_queryset(self):
        queryset = Workflow.objects.filter(
            organization=self.request.user.organization
        ).select_related('subscription', 'requested_by', 'current_approver')
        
        # Filter to show only relevant workflows based on role
        if self.request.query_params.get('my_approvals'):
            queryset = queryset.filter(current_approver=self.request.user, status='pending')
        
        return queryset.prefetch_related('steps')
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get workflows requested by current user"""
        workflows = self.get_queryset().filter(requested_by=request.user)
        serializer = self.get_serializer(workflows, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get workflows pending current user's approval"""
        workflows = self.get_queryset().filter(
            current_approver=request.user,
            status='pending'
        )
        serializer = self.get_serializer(workflows, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit workflow for approval"""
        workflow = self.get_object()
        
        if workflow.status != 'draft':
            return Response(
                {'error': 'Only draft workflows can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        workflow.status = 'pending'
        workflow.submitted_at = timezone.now()
        
        # Set first approver (typically admin or finance)
        from users.models import Role
        admin = workflow.organization.users.filter(
            role__type__in=[Role.RoleType.ADMIN, Role.RoleType.FINANCE],
            is_active=True
        ).first()
        
        if admin:
            workflow.current_approver = admin
        
        workflow.save()
        
        return Response(WorkflowSerializer(workflow).data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a workflow"""
        workflow = self.get_object()
        serializer = WorkflowActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if workflow.current_approver != request.user:
            return Response(
                {'error': 'You are not the current approver'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        action = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')
        
        if action == 'approve':
            workflow.status = 'approved'
            workflow.completed_at = timezone.now()
            
            # Mark related recommendation as completed
            if workflow.recommendation:
                workflow.recommendation.status = 'completed'
                workflow.recommendation.save()
                
        elif action == 'reject':
            workflow.status = 'rejected'
            workflow.completed_at = timezone.now()
            
            if workflow.recommendation:
                workflow.recommendation.status = 'rejected'
                workflow.recommendation.save()
        
        workflow.save()
        
        # Create workflow step record
        WorkflowStep.objects.create(
            workflow=workflow,
            step_order=workflow.steps.count() + 1,
            name='Final Approval',
            status='approved' if action == 'approve' else 'rejected',
            approver=request.user,
            approved_at=timezone.now(),
            comments=comments
        )
        
        return Response(WorkflowSerializer(workflow).data)


class SavingsReportViewSet(viewsets.ReadOnlyModelViewSet):
    """Savings report viewset (read-only)"""
    serializer_class = SavingsReportSerializer
    permission_classes = [IsAuthenticated, IsFinance]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['period']
    ordering_fields = ['period_start']
    
    def get_queryset(self):
        return SavingsReport.objects.filter(
            organization=self.request.user.organization
        ).select_related('generated_by')
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Trigger generation of a new savings report"""
        from services.tasks import generate_savings_report_task
        
        period = request.data.get('period', 'monthly')
        
        # Trigger async task
        generate_savings_report_task.delay(
            str(request.user.organization.id),
            period,
            str(request.user.id)
        )
        
        return Response({'message': 'Report generation started'})


class BudgetTargetViewSet(viewsets.ModelViewSet):
    """Budget target viewset"""
    serializer_class = BudgetTargetSerializer
    permission_classes = [IsAuthenticated, IsFinance]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['department', 'team', 'period']
    ordering_fields = ['effective_from', 'amount']
    
    def get_queryset(self):
        return BudgetTarget.objects.filter(
            organization=self.request.user.organization
        ).select_related('department', 'team')
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=False, methods=['get'])
    def overview(self, request):
        """Get budget overview across all targets"""
        targets = self.get_queryset().filter(
            effective_from__lte=timezone.now().date()
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=timezone.now().date())
        )
        
        total_budget = targets.aggregate(total=Sum('amount'))['total'] or 0
        total_spend = targets.aggregate(total=Sum('current_spend'))['total'] or 0
        
        over_budget = targets.filter(current_spend__gt=F('amount')).count()
        warning = targets.filter(
            current_spend__gte=F('amount') * F('warning_threshold') / 100,
            current_spend__lt=F('amount')
        ).count()
        
        return Response({
            'total_budget': total_budget,
            'total_spend': total_spend,
            'remaining': total_budget - total_spend,
            'utilization_percentage': round(
                (total_spend / total_budget * 100) if total_budget > 0 else 0, 2
            ),
            'targets_count': targets.count(),
            'over_budget_count': over_budget,
            'warning_count': warning,
        })


class DashboardView(generics.GenericAPIView):
    """Dashboard data endpoint"""
    permission_classes = [IsAuthenticated, IsOrgMember]
    
    def get(self, request):
        org = request.user.organization
        
        # Get subscriptions
        subscriptions = Subscription.objects.filter(organization=org)
        active_subs = subscriptions.filter(status='active')
        
        # Calculate totals
        total_monthly = sum(s.monthly_cost for s in active_subs)
        total_licenses = active_subs.aggregate(total=Sum('total_licenses'))['total'] or 0
        used_licenses = active_subs.aggregate(total=Sum('used_licenses'))['total'] or 0
        
        # Get pending items
        pending_renewals = active_subs.filter(
            renewal_date__lte=timezone.now().date() + timezone.timedelta(days=30),
            renewal_date__gte=timezone.now().date()
        ).count()
        
        active_recommendations = Recommendation.objects.filter(
            organization=org, status='pending'
        ).count()
        
        potential_savings = Recommendation.objects.filter(
            organization=org, status='pending'
        ).aggregate(total=Sum('estimated_savings'))['total'] or 0
        
        pending_workflows = Workflow.objects.filter(
            organization=org, status='pending'
        ).count()
        
        unread_alerts = Alert.objects.filter(
            organization=org, status='active'
        ).count()
        
        data = {
            'total_subscriptions': subscriptions.count(),
            'active_subscriptions': active_subs.count(),
            'total_monthly_cost': total_monthly,
            'total_annual_cost': total_monthly * 12,
            'total_licenses': total_licenses,
            'used_licenses': used_licenses,
            'unused_licenses': total_licenses - used_licenses,
            'avg_utilization': round(
                (used_licenses / total_licenses * 100) if total_licenses > 0 else 0, 2
            ),
            'potential_savings': potential_savings,
            'upcoming_renewals': pending_renewals,
            'pending_recommendations': active_recommendations,
            'pending_workflows': pending_workflows,
            'unread_alerts': unread_alerts,
            'currency': org.default_currency,
        }
        
        serializer = DashboardSummarySerializer(data)
        return Response(serializer.data)


class SpendAnalyticsView(generics.GenericAPIView):
    """Spend analytics endpoint"""
    permission_classes = [IsAuthenticated, IsOrgMember]
    
    def get(self, request):
        org = request.user.organization
        active_subs = Subscription.objects.filter(organization=org, status='active')
        
        # Spend by category
        by_category = []
        total_spend = sum(s.monthly_cost for s in active_subs)
        
        categories = active_subs.values('vendor__category').annotate(
            count=Count('id')
        )
        
        for cat in categories:
            cat_subs = active_subs.filter(vendor__category=cat['vendor__category'])
            cat_spend = sum(s.monthly_cost for s in cat_subs)
            by_category.append({
                'category': cat['vendor__category'] or 'Uncategorized',
                'spend': cat_spend,
                'percentage': round((cat_spend / total_spend * 100) if total_spend > 0 else 0, 2),
                'subscription_count': cat['count'],
            })
        
        # Spend by department
        by_department = []
        departments = active_subs.exclude(department__isnull=True).values(
            'department__name'
        ).annotate(count=Count('id'))
        
        for dept in departments:
            dept_subs = active_subs.filter(department__name=dept['department__name'])
            dept_spend = sum(s.monthly_cost for s in dept_subs)
            by_department.append({
                'department': dept['department__name'],
                'spend': dept_spend,
                'percentage': round((dept_spend / total_spend * 100) if total_spend > 0 else 0, 2),
                'subscription_count': dept['count'],
            })
        
        # Top spending subscriptions
        top_subscriptions = sorted(active_subs, key=lambda s: s.monthly_cost, reverse=True)[:10]
        top_data = [{
            'id': s.id,
            'name': s.name,
            'vendor_name': s.vendor.name if s.vendor else 'Unknown',
            'monthly_cost': s.monthly_cost,
            'annual_cost': s.annual_cost,
            'utilization_rate': s.utilization_rate,
            'department': s.department.name if s.department else 'Unassigned',
        } for s in top_subscriptions]
        
        return Response({
            'total_monthly_spend': total_spend,
            'total_annual_spend': total_spend * 12,
            'by_category': by_category,
            'by_department': by_department,
            'top_subscriptions': top_data,
            'currency': org.default_currency,
        })


class SpendTrendView(generics.GenericAPIView):
    """Spend trend over time endpoint"""
    permission_classes = [IsAuthenticated, IsOrgMember]
    
    def get(self, request):
        org = request.user.organization
        months = int(request.query_params.get('months', 12))
        
        # Get cost records grouped by month
        from_date = timezone.now().date() - timezone.timedelta(days=months * 30)
        
        records = CostRecord.objects.filter(
            organization=org,
            period_start__gte=from_date
        ).annotate(
            month=TruncMonth('period_start')
        ).values('month').annotate(
            total=Sum('amount'),
            count=Count('subscription', distinct=True)
        ).order_by('month')
        
        trend_data = [{
            'period': r['month'].strftime('%Y-%m'),
            'date': r['month'],
            'spend': r['total'],
            'subscription_count': r['count'],
        } for r in records]
        
        return Response({
            'trend': trend_data,
            'currency': org.default_currency,
        })
