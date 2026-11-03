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
    """Check for upcoming renewals and create alerts"""
    from services.models import Subscription, Alert
    from users.models import Notification
    
    now = timezone.now()
    alert_thresholds = [90, 60, 30, 14, 7]
    
    for days in alert_thresholds:
        threshold_date = (now + timezone.timedelta(days=days)).date()
        
        subscriptions = Subscription.objects.filter(
            status='active',
            renewal_date=threshold_date,
        ).select_related('organization', 'owner')
        
        for subscription in subscriptions:
            existing = Alert.objects.filter(
                subscription=subscription,
                alert_type=Alert.AlertType.RENEWAL,
                created_at__gte=now - timezone.timedelta(days=1),
            ).exists()
            
            if existing:
                continue
            
            severity = (
                Alert.Severity.ERROR if days <= 14 else Alert.Severity.WARNING
            )
            alert = Alert.objects.create(
                organization=subscription.organization,
                subscription=subscription,
                alert_type=Alert.AlertType.RENEWAL,
                severity=severity,
                title=f"Renewal in {days} days",
                message=(
                    f"{subscription.name} will renew on "
                    f"{subscription.renewal_date.strftime('%B %d, %Y')} "
                    f"for ${subscription.monthly_cost}/month"
                ),
                action_required=True,
                action_url=f"/subscriptions/{subscription.id}",
            )
            
            if subscription.owner:
                Notification.objects.create(
                    user=subscription.owner,
                    organization=subscription.organization,
                    type=Notification.NotificationType.RENEWAL,
                    priority=(
                        Notification.Priority.HIGH
                        if days <= 14
                        else Notification.Priority.MEDIUM
                    ),
                    title=alert.title,
                    message=alert.message,
                    action_url=alert.action_url,
                )
    
    logger.info("Completed renewal alerts check")


@shared_task
def generate_cost_report():
    """Generate monthly cost reports"""
    from decimal import Decimal
    from calendar import monthrange
    from services.models import Subscription, CostRecord, SavingsReport, Recommendation
    from users.models import Organization
    
    now = timezone.now()
    month_start = now.replace(day=1).date()
    last_day = monthrange(month_start.year, month_start.month)[1]
    month_end = month_start.replace(day=last_day)
    
    for org in Organization.objects.all():
        subscriptions = list(
            Subscription.objects.filter(organization=org, status='active')
        )
        
        total_cost = Decimal('0')
        for subscription in subscriptions:
            amount = subscription.monthly_cost or Decimal('0')
            total_cost += amount
            CostRecord.objects.get_or_create(
                subscription=subscription,
                organization=org,
                period_start=month_start,
                record_type=CostRecord.RecordType.INVOICE,
                defaults={
                    'period_end': month_end,
                    'amount': amount,
                    'currency': subscription.currency or 'USD',
                    'source': 'cost_report',
                },
            )
        
        implemented = Recommendation.objects.filter(
            organization=org,
            status=Recommendation.Status.COMPLETED,
            reviewed_at__month=now.month,
            reviewed_at__year=now.year,
        )
        savings = implemented.aggregate(total=Sum('estimated_savings'))['total'] or Decimal('0')
        
        SavingsReport.objects.update_or_create(
            organization=org,
            period=SavingsReport.Period.MONTHLY,
            period_start=month_start,
            defaults={
                'period_end': month_end,
                'total_spend': total_cost,
                'optimized_spend': max(total_cost - savings, Decimal('0')),
                'total_savings': savings,
                'subscriptions_analyzed': len(subscriptions),
                'recommendations_implemented': implemented.count(),
            },
        )
        
        logger.info(f"Generated cost report for {org.name}")


def _notify_workflow_users(workflow, config):
    from users.models import Notification, User

    org = workflow.organization
    user_ids = config.get('user_ids') or config.get('assignee_ids') or []
    title = config.get('title') or f'Workflow: {workflow.name}'
    message = config.get('message') or config.get('description') or workflow.description or 'Workflow notification'
    if user_ids:
        users = User.objects.filter(organization=org, id__in=user_ids)
    elif workflow.created_by_id:
        users = User.objects.filter(id=workflow.created_by_id)
    else:
        users = User.objects.none()

    notified = 0
    for user in users:
        Notification.objects.create(
            user=user,
            organization=org,
            type=Notification.NotificationType.WORKFLOW,
            title=title,
            message=message,
            action_url=config.get('action_url') or f'/workflows/{workflow.id}',
        )
        notified += 1
    return {'notified_users': notified}


def _dispatch_automation_action(workflow, config):
    """Run one AutomationWorkflow action; return output dict or raise."""
    from services.models import AutomationWorkflow, Subscription, Workflow

    action = workflow.action
    org = workflow.organization
    config = config or {}

    if action in (AutomationWorkflow.Action.NOTIFY, AutomationWorkflow.Action.CREATE_TASK):
        if action == AutomationWorkflow.Action.CREATE_TASK and not config.get('title'):
            config = {
                **config,
                'title': f'Task: {workflow.name}',
            }
        return _notify_workflow_users(workflow, config)

    if action == AutomationWorkflow.Action.SEND_EMAIL:
        from django.core.mail import send_mail

        recipients = config.get('recipients') or config.get('to') or []
        if isinstance(recipients, str):
            recipients = [recipients]
        if not recipients:
            raise ValueError('send_email requires recipients')
        send_mail(
            config.get('subject') or f'[SWM] {workflow.name}',
            config.get('body') or config.get('message') or '',
            settings.DEFAULT_FROM_EMAIL,
            recipients,
            fail_silently=False,
        )
        return {'sent': True, 'recipients': len(recipients)}

    if action == AutomationWorkflow.Action.SEND_SLACK:
        import requests
        from integrations.models import Integration

        message = config.get('message') or config.get('text') or workflow.name
        slack = Integration.objects.filter(
            organization=org,
            type=Integration.IntegrationType.SLACK,
            status=Integration.Status.CONNECTED,
        ).first()
        if not slack:
            raise ValueError('No connected Slack integration')
        creds = slack.get_decrypted_credentials()
        webhook_url = creds.get('webhook_url') or (slack.config or {}).get('webhook_url')
        if not webhook_url:
            raise ValueError('No Slack webhook URL configured')
        channel = (
            config.get('channel')
            or (slack.config or {}).get('channel_name')
            or 'alerts'
        )
        response = requests.post(
            webhook_url,
            json={'text': message, 'channel': channel},
            timeout=10,
        )
        if response.status_code != 200:
            raise ValueError(f'Slack webhook error: {response.status_code}')
        return {'slack_sent': True}

    if action == AutomationWorkflow.Action.WEBHOOK:
        import requests

        url = config.get('url')
        if not url:
            raise ValueError('webhook requires url')
        response = requests.post(
            url,
            json=config.get('payload') or {'workflow_id': str(workflow.id), 'name': workflow.name},
            headers=config.get('headers') or {'Content-Type': 'application/json'},
            timeout=30,
        )
        response.raise_for_status()
        return {'status_code': response.status_code}

    if action == AutomationWorkflow.Action.UPDATE_SUBSCRIPTION:
        subscription_id = config.get('subscription_id')
        if not subscription_id:
            raise ValueError('update_subscription requires subscription_id')
        subscription = Subscription.objects.get(id=subscription_id, organization=org)
        updates = {}
        if 'status' in config:
            updates['status'] = config['status']
        if 'total_licenses' in config:
            updates['total_licenses'] = config['total_licenses']
        if 'auto_renew' in config:
            updates['auto_renew'] = config['auto_renew']
        if not updates:
            raise ValueError('update_subscription requires fields to change')
        for key, value in updates.items():
            setattr(subscription, key, value)
        subscription.save(update_fields=list(updates.keys()) + ['updated_at'])
        return {'updated': updates}

    if action == AutomationWorkflow.Action.CREATE_APPROVAL:
        subscription_id = config.get('subscription_id')
        subscription = None
        if subscription_id:
            subscription = Subscription.objects.filter(id=subscription_id, organization=org).first()
        workflow_type = config.get('workflow_type') or config.get('type') or Workflow.WorkflowType.LICENSE_CHANGE
        if workflow_type not in Workflow.WorkflowType.values:
            workflow_type = Workflow.WorkflowType.LICENSE_CHANGE
        approval = Workflow.objects.create(
            organization=org,
            subscription=subscription,
            title=config.get('title') or workflow.name,
            description=config.get('description') or workflow.description or workflow.name,
            workflow_type=workflow_type,
            status=Workflow.Status.PENDING,
            requested_by=workflow.created_by,
            submitted_at=timezone.now(),
            request_data=config.get('request_data') or {},
        )
        return {'approval_id': str(approval.id)}

    raise ValueError(f'Unsupported workflow action: {action}')


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
    from services.models import SavingsReport, Recommendation, Subscription
    from users.models import User

    try:
        now = timezone.now().date()
        if period == 'annual':
            period_start = now.replace(month=1, day=1)
        elif period == 'quarterly':
            start_month = ((now.month - 1) // 3) * 3 + 1
            period_start = now.replace(month=start_month, day=1)
        else:
            period_start = now.replace(day=1)
        period_end = now

        subscriptions = Subscription.objects.filter(organization_id=organization_id, status='active')
        recs = Recommendation.objects.filter(organization_id=organization_id)

        total_spend = subscriptions.aggregate(total=Sum('monthly_cost'))['total'] or 0
        implemented = recs.filter(status='completed').aggregate(total=Sum('estimated_savings'))['total'] or 0
        potential = recs.filter(status='pending').aggregate(total=Sum('estimated_savings'))['total'] or 0

        generated_by = None
        if generated_by_id:
            generated_by = User.objects.filter(id=generated_by_id).first()

        report, _ = SavingsReport.objects.update_or_create(
            organization_id=organization_id,
            period=period,
            period_start=period_start,
            defaults={
                'period_end': period_end,
                'total_spend': total_spend,
                'optimized_spend': max(total_spend - implemented, 0),
                'total_savings': implemented,
                'savings_by_type': list(
                    recs.filter(status='completed').values('type').annotate(total=Sum('estimated_savings'))
                ),
                'savings_by_department': {},
                'savings_by_action': {},
                'subscriptions_analyzed': subscriptions.count(),
                'recommendations_generated': recs.count(),
                'recommendations_implemented': recs.filter(status='completed').count(),
                'generated_by': generated_by,
            },
        )

        return {
            'report_id': str(report.id),
            'total_spend': float(total_spend),
            'implemented_savings': float(implemented),
            'potential_savings': float(potential),
        }
    except Exception as e:
        logger.error(f"Failed to generate savings report for organization {organization_id}: {e}")
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
