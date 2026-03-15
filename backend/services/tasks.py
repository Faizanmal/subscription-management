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
        
        # Get today's events
        events = UsageEvent.objects.filter(
            subscription=subscription,
            timestamp__date=today
        )
        
        # Calculate metrics
        active_users = events.values('user').distinct().count()
        session_duration = events.aggregate(
            avg=Avg('duration_seconds')
        )['avg'] or 0
        
        # Create or update daily metrics
        metrics, created = UsageMetrics.objects.update_or_create(
            subscription=subscription,
            period_type='daily',
            period_start=today,
            defaults={
                'period_end': today,
                'active_users': active_users,
                'total_logins': events.filter(event_type='login').count(),
                'total_sessions': events.filter(event_type='session').count(),
                'avg_session_duration': session_duration,
                'feature_usage': {}
            }
        )
        
        # Update subscription's last usage date
        if active_users > 0:
            subscription.last_usage_at = now
            subscription.save(update_fields=['last_usage_at'])
        
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
                period_type='daily',
                period_start__gte=week_start,
                period_start__lte=week_end
            )
            
            if daily_metrics.exists():
                aggregated = daily_metrics.aggregate(
                    total_logins=Sum('total_logins'),
                    total_sessions=Sum('total_sessions'),
                    avg_duration=Avg('avg_session_duration'),
                    max_users=Count('active_users')
                )
                
                UsageMetrics.objects.create(
                    subscription=subscription,
                    period_type='weekly',
                    period_start=week_start,
                    period_end=week_end,
                    active_users=daily_metrics.aggregate(Sum('active_users'))['active_users__sum'] or 0,
                    total_logins=aggregated['total_logins'] or 0,
                    total_sessions=aggregated['total_sessions'] or 0,
                    avg_session_duration=aggregated['avg_duration'] or 0
                )
    
    # Monthly aggregation (on 1st of month)
    if now.day == 1:
        month_start = (now - timezone.timedelta(days=30)).replace(day=1).date()
        month_end = (now - timezone.timedelta(days=1)).date()
        
        for subscription in Subscription.objects.filter(status='active'):
            daily_metrics = UsageMetrics.objects.filter(
                subscription=subscription,
                period_type='daily',
                period_start__gte=month_start,
                period_start__lte=month_end
            )
            
            if daily_metrics.exists():
                aggregated = daily_metrics.aggregate(
                    total_logins=Sum('total_logins'),
                    total_sessions=Sum('total_sessions'),
                    avg_duration=Avg('avg_session_duration')
                )
                
                UsageMetrics.objects.create(
                    subscription=subscription,
                    period_type='monthly',
                    period_start=month_start,
                    period_end=month_end,
                    active_users=daily_metrics.values('active_users').distinct().count(),
                    total_logins=aggregated['total_logins'] or 0,
                    total_sessions=aggregated['total_sessions'] or 0,
                    avg_session_duration=aggregated['avg_duration'] or 0
                )
    
    logger.info("Completed usage metrics aggregation")


@shared_task
def discover_subscriptions():
    """Discover new subscriptions from integrations"""
    from integrations.models import Integration
    from integrations.tasks import sync_integration
    
    # Get all active discovery integrations
    integrations = Integration.objects.filter(
        status='active',
        type__in=['email_scan', 'google_workspace', 'microsoft_365', 'plaid', 'sso']
    )
    
    for integration in integrations:
        sync_integration.delay(str(integration.id))
    
    logger.info(f"Triggered discovery for {integrations.count()} integrations")


@shared_task
def detect_redundancies():
    """Detect redundant subscriptions"""
    from services.models import Subscription, RedundancyGroup
    from users.models import Organization
    
    for org in Organization.objects.all():
        subscriptions = Subscription.objects.filter(
            organization=org,
            status='active'
        ).select_related('vendor')
        
        # Group by category
        category_groups = {}
        for sub in subscriptions:
            category = sub.vendor.category if sub.vendor else 'other'
            if category not in category_groups:
                category_groups[category] = []
            category_groups[category].append(sub)
        
        # Find redundancies
        for category, subs in category_groups.items():
            if len(subs) < 2:
                continue
            
            # Check for overlapping functionality
            for i, sub1 in enumerate(subs):
                for sub2 in subs[i+1:]:
                    overlap_score = calculate_overlap_score(sub1, sub2)
                    
                    if overlap_score > 0.5:  # 50% overlap threshold
                        # Create or update redundancy group
                        group, created = RedundancyGroup.objects.get_or_create(
                            organization=org,
                            name=f"{category.title()} Tools Overlap",
                            defaults={
                                'description': f"Multiple {category} tools with overlapping functionality",
                                'overlap_percentage': int(overlap_score * 100)
                            }
                        )
                        
                        group.subscriptions.add(sub1, sub2)
                        
                        if not created:
                            group.overlap_percentage = max(
                                group.overlap_percentage,
                                int(overlap_score * 100)
                            )
                            group.save()
        
        logger.info(f"Completed redundancy detection for {org.name}")


def calculate_overlap_score(sub1, sub2):
    """Calculate overlap score between two subscriptions"""
    score = 0
    
    # Same category
    if sub1.vendor and sub2.vendor:
        if sub1.vendor.category == sub2.vendor.category:
            score += 0.3
    
    # Check user overlap
    users1 = set(sub1.users.values_list('id', flat=True))
    users2 = set(sub2.users.values_list('id', flat=True))
    
    if users1 and users2:
        overlap = len(users1 & users2) / max(len(users1 | users2), 1)
        score += overlap * 0.4
    
    # Check for known equivalent tools
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
def generate_ai_recommendations():
    """Generate AI-powered recommendations"""
    from services.models import Subscription, Recommendation
    from users.models import Organization
    
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    
    for org in Organization.objects.all():
        subscriptions = Subscription.objects.filter(
            organization=org,
            status='active'
        ).select_related('vendor')
        
        for subscription in subscriptions:
            try:
                recommendation = analyze_subscription_with_ai(client, subscription)
                
                if recommendation:
                    Recommendation.objects.create(
                        subscription=subscription,
                        type=recommendation['type'],
                        title=recommendation['title'],
                        description=recommendation['description'],
                        estimated_savings=recommendation.get('savings', 0),
                        priority=recommendation.get('priority', 'medium'),
                        ai_confidence=recommendation.get('confidence', 0.8)
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
        'used_licenses': subscription.assigned_licenses,
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
    alert_thresholds = [90, 60, 30, 14, 7]  # Days before renewal
    
    for days in alert_thresholds:
        threshold_date = now + timezone.timedelta(days=days)
        
        subscriptions = Subscription.objects.filter(
            status='active',
            renewal_date__date=threshold_date.date()
        ).select_related('organization', 'owner')
        
        for subscription in subscriptions:
            # Check if alert already exists
            existing = Alert.objects.filter(
                subscription=subscription,
                type='renewal',
                created_at__gte=now - timezone.timedelta(days=1)
            ).exists()
            
            if existing:
                continue
            
            # Create alert
            alert = Alert.objects.create(
                subscription=subscription,
                type='renewal',
                severity='high' if days <= 14 else 'medium',
                title=f"Renewal in {days} days",
                message=f"{subscription.name} will renew on {subscription.renewal_date.strftime('%B %d, %Y')} for ${subscription.monthly_cost}/month"
            )
            
            # Create notification for owner
            if subscription.owner:
                Notification.objects.create(
                    user=subscription.owner,
                    type='alert',
                    title=alert.title,
                    message=alert.message,
                    action_url=f"/subscriptions/{subscription.id}"
                )
    
    logger.info("Completed renewal alerts check")


@shared_task
def generate_cost_report():
    """Generate monthly cost reports"""
    from services.models import Subscription, CostRecord, SavingsReport
    from users.models import Organization
    
    now = timezone.now()
    month_start = now.replace(day=1).date()
    
    for org in Organization.objects.all():
        subscriptions = Subscription.objects.filter(
            organization=org,
            status='active'
        )
        
        # Create cost records
        for subscription in subscriptions:
            CostRecord.objects.get_or_create(
                subscription=subscription,
                period_start=month_start,
                defaults={
                    'period_end': month_start,
                    'amount': subscription.monthly_cost or 0,
                    'currency': 'USD',
                    'record_type': 'actual'
                }
            )
        
        # Calculate totals
        total_cost = subscriptions.aggregate(
            total=Sum('monthly_cost')
        )['total'] or 0
        
        # Create savings report
        from services.models import Recommendation
        
        implemented = Recommendation.objects.filter(
            subscription__organization=org,
            status='implemented',
            implemented_at__month=now.month,
            implemented_at__year=now.year
        )
        
        savings = implemented.aggregate(
            total=Sum('estimated_savings')
        )['total'] or 0
        
        SavingsReport.objects.create(
            organization=org,
            period_start=month_start,
            period_end=now.date(),
            total_spend=total_cost,
            total_subscriptions=subscriptions.count(),
            recommendations_implemented=implemented.count(),
            actual_savings=savings,
            projected_annual_savings=savings * 12
        )
        
        logger.info(f"Generated cost report for {org.name}")


@shared_task
def process_workflow(workflow_id):
    """Process an automated workflow"""
    from services.models import Workflow
    from users.models import Notification
    
    try:
        workflow = Workflow.objects.get(id=workflow_id)
        
        if workflow.status != 'pending':
            return
        
        workflow.status = 'in_progress'
        workflow.save()
        
        # Process each step
        for step in workflow.steps.order_by('order'):
            try:
                result = execute_workflow_step(step)
                step.status = 'completed'
                step.completed_at = timezone.now()
                step.result_data = result
                step.save()
                
            except Exception as e:
                step.status = 'failed'
                step.error_message = str(e)
                step.save()
                
                workflow.status = 'failed'
                workflow.save()
                
                logger.error(f"Workflow step {step.id} failed: {e}")
                return
        
        workflow.status = 'completed'
        workflow.completed_at = timezone.now()
        workflow.save()
        
        # Notify creator
        if workflow.created_by:
            Notification.objects.create(
                user=workflow.created_by,
                type='workflow',
                title=f"Workflow completed: {workflow.name}",
                message="Your workflow has completed successfully.",
                action_url=f"/workflows/{workflow.id}"
            )
        
        logger.info(f"Workflow {workflow.name} completed")
        
    except Workflow.DoesNotExist:
        logger.error(f"Workflow {workflow_id} not found")


def execute_workflow_step(step):
    """Execute a single workflow step"""
    from services.models import Subscription
    
    action = step.action
    params = step.action_params or {}
    
    if action == 'notify':
        # Send notification
        from users.models import User, Notification
        user_ids = params.get('user_ids', [])
        message = params.get('message', '')
        
        for user_id in user_ids:
            try:
                user = User.objects.get(id=user_id)
                Notification.objects.create(
                    user=user,
                    type='workflow',
                    title=params.get('title', 'Workflow Notification'),
                    message=message
                )
            except User.DoesNotExist:
                pass
        
        return {'notified_users': len(user_ids)}
    
    elif action == 'cancel_subscription':
        subscription_id = params.get('subscription_id')
        subscription = Subscription.objects.get(id=subscription_id)
        subscription.status = 'cancelled'
        subscription.cancelled_at = timezone.now()
        subscription.save()
        return {'cancelled': True}
    
    elif action == 'downgrade_subscription':
        subscription_id = params.get('subscription_id')
        new_licenses = params.get('new_licenses')
        
        subscription = Subscription.objects.get(id=subscription_id)
        old_licenses = subscription.total_licenses
        subscription.total_licenses = new_licenses
        subscription.save()
        
        return {'old_licenses': old_licenses, 'new_licenses': new_licenses}
    
    elif action == 'send_email':
        from django.core.mail import send_mail
        
        send_mail(
            params.get('subject', ''),
            params.get('body', ''),
            settings.DEFAULT_FROM_EMAIL,
            params.get('recipients', []),
            fail_silently=False
        )
        return {'sent': True}
    
    elif action == 'webhook':
        import requests
        
        response = requests.post(
            params.get('url'),
            json=params.get('payload', {}),
            headers=params.get('headers', {}),
            timeout=30
        )
        return {'status_code': response.status_code}
    
    elif action == 'wait':
        import time
        seconds = params.get('seconds', 0)
        time.sleep(min(seconds, 300))  # Max 5 minutes
        return {'waited': seconds}
    
    elif action == 'approval':
        # Approval steps are handled separately
        return {'requires_approval': True}
    
    else:
        raise ValueError(f"Unknown action: {action}")


@shared_task
def sync_vendor_catalog():
    """Sync software vendor catalog"""
    from services.models import SoftwareVendor
    
    # This would typically pull from an external API
    # For now, we'll use a static list of common SaaS tools
    
    vendors = [
        {'name': 'Slack', 'category': 'collaboration', 'website': 'https://slack.com'},
        {'name': 'Zoom', 'category': 'video_conferencing', 'website': 'https://zoom.us'},
        {'name': 'Salesforce', 'category': 'crm', 'website': 'https://salesforce.com'},
        {'name': 'HubSpot', 'category': 'marketing', 'website': 'https://hubspot.com'},
        {'name': 'Jira', 'category': 'project_management', 'website': 'https://atlassian.com/jira'},
        {'name': 'GitHub', 'category': 'development', 'website': 'https://github.com'},
        {'name': 'AWS', 'category': 'cloud_infrastructure', 'website': 'https://aws.amazon.com'},
        {'name': 'Google Workspace', 'category': 'productivity', 'website': 'https://workspace.google.com'},
        {'name': 'Microsoft 365', 'category': 'productivity', 'website': 'https://microsoft.com/microsoft-365'},
        {'name': 'Notion', 'category': 'productivity', 'website': 'https://notion.so'},
    ]
    
    for vendor_data in vendors:
        SoftwareVendor.objects.update_or_create(
            name=vendor_data['name'],
            defaults={
                'category': vendor_data['category'],
                'website': vendor_data['website']
            }
        )
    
    logger.info(f"Synced {len(vendors)} vendors")
