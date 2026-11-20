"""
Celery tasks for services app
"""

from celery import shared_task
from django.utils import timezone
from django.db.models import Sum, Avg, Count
from django.conf import settings
import logging
import openai

logger = logging.getLogger('swm')


@shared_task(bind=True, max_retries=3)
def track_usage_metrics(self, subscription_id):
    """Track and aggregate usage metrics for a subscription"""
    from services.models import Subscription, UsageEvent, UsageMetrics
    
    try:
        subscription = Subscription.objects.get(id=subscription_id)
        now = timezone.now()
        today = now.date()
        
        events = UsageEvent.objects.filter(
            subscription=subscription,
            timestamp__date=today
        )
        
        active_users = events.exclude(user__isnull=True).values('user').distinct().count()
        total_sessions = events.filter(event_type='login').count()
        durations = []
        for event in events.exclude(metadata={}):
            raw = (event.metadata or {}).get('duration_seconds')
            if raw is None:
                raw = (event.metadata or {}).get('duration_minutes')
                if raw is not None:
                    try:
                        durations.append(float(raw) * 60)
                    except (TypeError, ValueError):
                        pass
                continue
            try:
                durations.append(float(raw))
            except (TypeError, ValueError):
                pass
        avg_duration = (sum(durations) / len(durations)) if durations else 0
        total_duration_minutes = int(sum(durations) / 60) if durations else 0
        
        UsageMetrics.objects.update_or_create(
            subscription=subscription,
            period='daily',
            period_start=today,
            defaults={
                'period_end': today,
                'active_users': active_users,
                'total_users': subscription.used_licenses or active_users,
                'total_sessions': total_sessions,
                'total_duration_minutes': total_duration_minutes,
                'avg_session_duration': avg_duration,
                'feature_usage': {},
            }
        )
        
        logger.info(f"Updated usage metrics for {subscription.name}")
        
    except Subscription.DoesNotExist:
        logger.error(f"Subscription {subscription_id} not found")
    except Exception as e:
        logger.error(f"Error tracking usage: {e}")
        self.retry(countdown=300)


@shared_task
def aggregate_usage_metrics():
    """Aggregate daily metrics into weekly/monthly"""
    from services.models import Subscription, UsageMetrics
    
    now = timezone.now()
    
    # Weekly aggregation (on Sundays)
    if now.weekday() == 6:
        week_start = (now - timezone.timedelta(days=7)).date()
        week_end = now.date()
        
        for subscription in Subscription.objects.filter(status='active'):
            daily_metrics = UsageMetrics.objects.filter(
                subscription=subscription,
                period='daily',
                period_start__gte=week_start,
                period_start__lte=week_end
            )
            
            if daily_metrics.exists():
                aggregated = daily_metrics.aggregate(
                    total_sessions=Sum('total_sessions'),
                    total_duration=Sum('total_duration_minutes'),
                    avg_duration=Avg('avg_session_duration'),
                    active_users=Sum('active_users'),
                )
                
                UsageMetrics.objects.update_or_create(
                    subscription=subscription,
                    period='weekly',
                    period_start=week_start,
                    defaults={
                        'period_end': week_end,
                        'active_users': aggregated['active_users'] or 0,
                        'total_sessions': aggregated['total_sessions'] or 0,
                        'total_duration_minutes': aggregated['total_duration'] or 0,
                        'avg_session_duration': aggregated['avg_duration'] or 0,
                    },
                )
    
    # Monthly aggregation (on 1st of month)
    if now.day == 1:
        month_start = (now - timezone.timedelta(days=30)).replace(day=1).date()
        month_end = (now - timezone.timedelta(days=1)).date()
        
        for subscription in Subscription.objects.filter(status='active'):
            daily_metrics = UsageMetrics.objects.filter(
                subscription=subscription,
                period='daily',
                period_start__gte=month_start,
                period_start__lte=month_end
            )
            
            if daily_metrics.exists():
                aggregated = daily_metrics.aggregate(
                    total_sessions=Sum('total_sessions'),
                    total_duration=Sum('total_duration_minutes'),
                    avg_duration=Avg('avg_session_duration'),
                    active_users=Sum('active_users'),
                )
                
                UsageMetrics.objects.update_or_create(
                    subscription=subscription,
                    period='monthly',
                    period_start=month_start,
                    defaults={
                        'period_end': month_end,
                        'active_users': aggregated['active_users'] or 0,
                        'total_sessions': aggregated['total_sessions'] or 0,
                        'total_duration_minutes': aggregated['total_duration'] or 0,
                        'avg_session_duration': aggregated['avg_duration'] or 0,
                    },
                )
    
    logger.info("Completed usage metrics aggregation")


@shared_task
def discover_subscriptions():
    """Discover new subscriptions from integrations"""
    from integrations.models import Integration
    from integrations.tasks import sync_integration
    from users.plans import FEATURE_DISCOVERY_SYNC, has_feature
    
    integrations = Integration.objects.filter(
        status=Integration.Status.CONNECTED,
        sync_enabled=True,
        type__in=['google_workspace', 'microsoft_365', 'plaid', 'okta', 'azure_ad'],
    ).select_related('organization')
    
    triggered = 0
    for integration in integrations:
        if not has_feature(integration.organization, FEATURE_DISCOVERY_SYNC):
            continue
        sync_integration.delay(str(integration.id))
        triggered += 1
    
    logger.info(f"Triggered discovery for {triggered} integrations")


@shared_task
def detect_redundancies():
    """Detect redundant subscriptions"""
    from services.models import Subscription, RedundancyGroup, RedundancyGroupMember
    from users.models import Organization
    
    for org in Organization.objects.all():
        subscriptions = Subscription.objects.filter(
            organization=org,
            status='active'
        ).select_related('vendor')
        
        category_groups = {}
        for sub in subscriptions:
            category = sub.vendor.category if sub.vendor else 'other'
            category_groups.setdefault(category, []).append(sub)
        
        for category, subs in category_groups.items():
            if len(subs) < 2:
                continue
            
            for i, sub1 in enumerate(subs):
                for sub2 in subs[i + 1:]:
                    overlap_score = calculate_overlap_score(sub1, sub2)
                    
                    if overlap_score > 0.5:
                        group, created = RedundancyGroup.objects.get_or_create(
                            organization=org,
                            name=f"{category.title()} Tools Overlap",
                            defaults={
                                'description': (
                                    f"Multiple {category} tools with overlapping functionality"
                                ),
                                'category': category,
                                'overlap_score': overlap_score * 100,
                            },
                        )
                        
                        for member_sub in (sub1, sub2):
                            RedundancyGroupMember.objects.get_or_create(
                                group=group,
                                subscription=member_sub,
                            )
                        
                        if not created:
                            group.overlap_score = max(group.overlap_score, overlap_score * 100)
                            group.save(update_fields=['overlap_score', 'updated_at'])
        
        logger.info(f"Completed redundancy detection for {org.name}")


def calculate_overlap_score(sub1, sub2):
    """Calculate overlap score between two subscriptions"""
    score = 0
    
    if sub1.vendor and sub2.vendor:
        if sub1.vendor.category == sub2.vendor.category:
            score += 0.3
    
    users1 = set(sub1.subscription_users.values_list('user_id', flat=True))
    users2 = set(sub2.subscription_users.values_list('user_id', flat=True))
    
    if users1 and users2:
        overlap = len(users1 & users2) / max(len(users1 | users2), 1)
        score += overlap * 0.4
    
    equivalents = {
        'slack': ['microsoft_teams', 'discord'],
        'zoom': ['google_meet', 'microsoft_teams'],
        'jira': ['asana', 'monday', 'trello'],
        'google_workspace': ['microsoft_365'],
    }
    
    name1 = sub1.name.lower().replace(' ', '_')
    name2 = sub2.name.lower().replace(' ', '_')
    
    for tool, alts in equivalents.items():
        if tool in name1 and any(alt in name2 for alt in alts):
            score += 0.3
        if tool in name2 and any(alt in name1 for alt in alts):
            score += 0.3
    
    return min(score, 1.0)


@shared_task
def generate_ai_recommendations(organization_id=None):
    """Generate AI-powered recommendations"""
    from services.models import Subscription, Recommendation
    from users.models import Organization
    from users.plans import FEATURE_AI_RECOMMENDATIONS, has_feature

    client = None
    if getattr(settings, 'OPENAI_API_KEY', None):
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

    orgs = Organization.objects.all()
    if organization_id:
        orgs = orgs.filter(id=organization_id)
    org_queryset = [org for org in orgs if has_feature(org, FEATURE_AI_RECOMMENDATIONS)]
    if not org_queryset:
        logger.info('Skipping AI recommendations — no entitled organizations')
        return

    for org in org_queryset:
        subscriptions = Subscription.objects.filter(
            organization=org,
            status='active'
        ).select_related('vendor')
        
        for subscription in subscriptions:
            try:
                if client is not None:
                    recommendation = analyze_subscription_with_ai(client, subscription)
                else:
                    recommendation = None
                
                if recommendation:
                    Recommendation.objects.create(
                        organization=org,
                        subscription=subscription,
                        type=recommendation['type'],
                        title=recommendation['title'],
                        description=recommendation['description'],
                        estimated_savings=recommendation.get('savings', 0),
                        priority=recommendation.get('priority', 'medium'),
                        confidence_score=float(recommendation.get('confidence', 0.8)) * 100,
                    )
                    
            except Exception as e:
                logger.error(f"AI recommendation error for {subscription.name}: {e}")
        
        logger.info(f"Generated AI recommendations for {org.name}")


def analyze_subscription_with_ai(client, subscription):
    """Use OpenAI to analyze subscription and generate recommendations"""
    
    # Build context
    context = {
        'name': subscription.name,
        'category': subscription.vendor.category if subscription.vendor else 'unknown',
        'monthly_cost': float(subscription.monthly_cost or 0),
        'total_licenses': subscription.total_licenses,
        'used_licenses': subscription.used_licenses,
        'utilization_rate': subscription.utilization_rate,
        'last_usage': str(subscription.last_usage_at) if subscription.last_usage_at else 'never',
        'renewal_date': str(subscription.renewal_date) if subscription.renewal_date else None
    }
    
    prompt = f"""
    Analyze this SaaS subscription and provide a recommendation:
    
    Subscription: {context['name']}
    Category: {context['category']}
    Monthly Cost: ${context['monthly_cost']}
    Total Licenses: {context['total_licenses']}
    Used Licenses: {context['used_licenses']}
    Utilization Rate: {context['utilization_rate']}%
    Last Usage: {context['last_usage']}
    Renewal Date: {context['renewal_date']}
    
    Provide a JSON response with:
    - type: one of 'downgrade', 'cancel', 'renegotiate', 'consolidate', 'optimize'
    - title: short recommendation title
    - description: detailed explanation
    - savings: estimated monthly savings in USD
    - priority: 'low', 'medium', or 'high'
    - confidence: confidence score 0-1
    
    Only respond if there's a meaningful recommendation. Return null if no action needed.
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a SaaS cost optimization expert."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        import json
        result = json.loads(response.choices[0].message.content)
        
        if result and result.get('type'):
            return result
        
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
    
    return None


@shared_task
def check_renewal_alerts():
    from services.renewals import create_due_reminders
    return create_due_reminders()


@shared_task
def generate_cost_report():
    from services.reporting import build_savings_report
    from users.models import Organization
    for org in Organization.objects.all():
        build_savings_report(org.pk)


@shared_task
def sync_vendor_catalog():
    """Sync software vendor catalog"""
    from services.models import SoftwareVendor
    
    # This would typically pull from an external API
    # For now, we'll use a static list of common SaaS tools
    
    vendors = [
        {'name': 'Slack', 'category': 'communication', 'website': 'https://slack.com'},
        {'name': 'Zoom', 'category': 'communication', 'website': 'https://zoom.us'},
        {'name': 'Salesforce', 'category': 'crm', 'website': 'https://salesforce.com'},
        {'name': 'HubSpot', 'category': 'marketing', 'website': 'https://hubspot.com'},
        {'name': 'Jira', 'category': 'project_mgmt', 'website': 'https://atlassian.com/jira'},
        {'name': 'GitHub', 'category': 'development', 'website': 'https://github.com'},
        {'name': 'AWS', 'category': 'cloud', 'website': 'https://aws.amazon.com'},
        {'name': 'Google Workspace', 'category': 'productivity', 'website': 'https://workspace.google.com'},
        {'name': 'Microsoft 365', 'category': 'productivity', 'website': 'https://microsoft.com/microsoft-365'},
        {'name': 'Notion', 'category': 'productivity', 'website': 'https://notion.so'},
    ]
    
    from django.utils.text import slugify

    for vendor_data in vendors:
        SoftwareVendor.objects.update_or_create(
            name=vendor_data['name'],
            defaults={
                'slug': slugify(vendor_data['name']),
                'category': vendor_data['category'],
                'website': vendor_data['website'],
                'is_verified': True,
            }
        )
    
    logger.info(f"Synced {len(vendors)} vendors")


@shared_task(bind=True, max_retries=3)
def execute_automation_workflow(self, workflow_id, execution_id=None):
    """Execute an automation workflow and persist execution result."""
    from services.models import AutomationWorkflow, WorkflowExecution

    execution = None
    try:
        workflow = AutomationWorkflow.objects.select_related('organization', 'created_by').get(id=workflow_id)
        if execution_id:
            execution = WorkflowExecution.objects.get(id=execution_id, workflow=workflow)
        else:
            execution = WorkflowExecution.objects.create(
                workflow=workflow,
                status=WorkflowExecution.Status.RUNNING,
                trigger_reason='system',
                total_steps=1,
            )

        result = _dispatch_automation_action(workflow, workflow.action_config or {})
        output = {
            'action': workflow.action,
            'trigger': workflow.trigger,
            'result': result,
        }

        execution.steps_completed = execution.total_steps
        execution.status = WorkflowExecution.Status.COMPLETED
        execution.output_data = output
        execution.completed_at = timezone.now()
        execution.error_message = ''
        execution.save(update_fields=[
            'steps_completed', 'status', 'output_data', 'completed_at', 'error_message',
        ])

        workflow.last_run_at = timezone.now()
        workflow.run_count += 1
        workflow.save(update_fields=['last_run_at', 'run_count', 'updated_at'])

        return {'execution_id': str(execution.id), 'status': execution.status, 'result': result}
    except Exception as e:
        logger.error(f"Failed to execute automation workflow {workflow_id}: {e}")
        if execution is not None:
            execution.status = WorkflowExecution.Status.FAILED
            execution.error_message = str(e)
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error_message', 'completed_at'])
        elif execution_id:
            WorkflowExecution.objects.filter(id=execution_id).update(
                status=WorkflowExecution.Status.FAILED,
                error_message=str(e),
                completed_at=timezone.now(),
            )
        # Do not retry config/validation failures
        if isinstance(e, ValueError):
            return {'status': 'failed', 'error': str(e)}
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=2)
def generate_savings_report_task(self, organization_id, period='monthly', generated_by_id=None):
    """Generate a savings report for an organization."""
    from services.reporting import build_savings_report
    try:
        return build_savings_report(organization_id, period, generated_by_id)
    except Exception as exc:
        logger.error('Savings report generation failed for organization %s', organization_id)
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
