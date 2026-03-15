"""
AI-powered recommendation engine for subscription optimization
"""

from django.conf import settings
from django.utils import timezone
from django.db.models import Sum, Avg
import logging
import openai
import json

logger = logging.getLogger('swm')


class RecommendationEngine:
    """AI-powered engine for generating subscription recommendations"""
    
    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def analyze_subscription(self, subscription):
        """Analyze a single subscription and generate recommendations"""
        from services.models import Recommendation
        
        # Gather context
        context = self._build_subscription_context(subscription)
        
        # Generate AI recommendation
        recommendation = self._get_ai_recommendation(context)
        
        if recommendation:
            # Save recommendation
            rec = Recommendation.objects.create(
                subscription=subscription,
                type=recommendation['type'],
                title=recommendation['title'],
                description=recommendation['description'],
                impact_summary=recommendation.get('impact', ''),
                estimated_savings=recommendation.get('savings', 0),
                implementation_steps=recommendation.get('steps', []),
                priority=recommendation.get('priority', 'medium'),
                ai_confidence=recommendation.get('confidence', 0.8),
                ai_reasoning=recommendation.get('reasoning', '')
            )
            return rec
        
        return None
    
    def analyze_organization(self, organization):
        """Analyze all subscriptions for an organization"""
        from services.models import Subscription
        
        subscriptions = Subscription.objects.filter(
            organization=organization,
            status='active'
        ).select_related('vendor')
        
        recommendations = []
        
        for subscription in subscriptions:
            try:
                rec = self.analyze_subscription(subscription)
                if rec:
                    recommendations.append(rec)
            except Exception as e:
                logger.error(f"Error analyzing {subscription.name}: {e}")
        
        # Also check for redundancies
        redundancy_recs = self._check_redundancies(organization, subscriptions)
        recommendations.extend(redundancy_recs)
        
        return recommendations
    
    def _build_subscription_context(self, subscription):
        """Build context object for AI analysis"""
        from services.models import UsageMetrics, CostRecord
        
        # Get usage data
        usage = UsageMetrics.objects.filter(
            subscription=subscription,
            period_type='monthly'
        ).order_by('-period_start')[:6]
        
        usage_data = []
        for u in usage:
            usage_data.append({
                'period': str(u.period_start),
                'active_users': u.active_users,
                'total_logins': u.total_logins,
                'avg_session_duration': u.avg_session_duration
            })
        
        # Get cost data
        costs = CostRecord.objects.filter(
            subscription=subscription
        ).order_by('-period_start')[:6]
        
        cost_data = []
        for c in costs:
            cost_data.append({
                'period': str(c.period_start),
                'amount': float(c.amount)
            })
        
        return {
            'subscription': {
                'name': subscription.name,
                'vendor': subscription.vendor.name if subscription.vendor else 'Unknown',
                'category': subscription.vendor.category if subscription.vendor else 'other',
                'monthly_cost': float(subscription.monthly_cost or 0),
                'billing_cycle': subscription.billing_cycle,
                'total_licenses': subscription.total_licenses,
                'assigned_licenses': subscription.assigned_licenses,
                'utilization_rate': subscription.utilization_rate,
                'last_usage': str(subscription.last_usage_at) if subscription.last_usage_at else None,
                'renewal_date': str(subscription.renewal_date) if subscription.renewal_date else None,
            },
            'usage_history': usage_data,
            'cost_history': cost_data
        }
    
    def _get_ai_recommendation(self, context):
        """Get recommendation from AI"""
        prompt = self._build_prompt(context)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a SaaS cost optimization expert. Analyze the subscription data and provide actionable recommendations to reduce waste and optimize spending.

Return a JSON object with the following structure (or null if no recommendation):
{
    "type": "downgrade|cancel|renegotiate|consolidate|optimize|rightsizing",
    "title": "Short recommendation title",
    "description": "Detailed explanation",
    "impact": "Expected impact summary",
    "savings": 0, // Monthly savings in USD
    "priority": "low|medium|high|critical",
    "confidence": 0.8, // 0-1 confidence score
    "reasoning": "Why this recommendation was made",
    "steps": ["Step 1", "Step 2", "Step 3"] // Implementation steps
}"""
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            
            if result and result.get('type'):
                return result
            
        except Exception as e:
            logger.error(f"AI recommendation error: {e}")
        
        return None
    
    def _build_prompt(self, context):
        """Build prompt for AI analysis"""
        sub = context['subscription']
        
        prompt = f"""
Analyze this SaaS subscription and provide optimization recommendations:

## Subscription Details
- **Name**: {sub['name']}
- **Vendor**: {sub['vendor']}
- **Category**: {sub['category']}
- **Monthly Cost**: ${sub['monthly_cost']:.2f}
- **Billing Cycle**: {sub['billing_cycle']}
- **Total Licenses**: {sub['total_licenses']}
- **Assigned Licenses**: {sub['assigned_licenses']}
- **Utilization Rate**: {sub['utilization_rate']}%
- **Last Usage**: {sub['last_usage'] or 'Never'}
- **Renewal Date**: {sub['renewal_date'] or 'Not set'}

## Usage History (Last 6 months)
"""
        
        if context['usage_history']:
            for u in context['usage_history']:
                prompt += f"- {u['period']}: {u['active_users']} active users, {u['total_logins']} logins\n"
        else:
            prompt += "No usage data available\n"
        
        prompt += """
## Cost History (Last 6 months)
"""
        
        if context['cost_history']:
            for c in context['cost_history']:
                prompt += f"- {c['period']}: ${c['amount']:.2f}\n"
        else:
            prompt += "No cost history available\n"
        
        prompt += """
## Analysis Guidelines
1. If utilization is below 50%, consider downsizing or cancellation
2. If no usage in 30+ days, recommend review or cancellation
3. If approaching renewal, consider renegotiation opportunities
4. Check for cost optimization opportunities (annual billing, etc.)
5. Consider license right-sizing based on actual usage

Provide a specific, actionable recommendation or return null if no action needed.
"""
        
        return prompt
    
    def _check_redundancies(self, organization, subscriptions):
        """Check for redundant subscriptions"""
        
        recommendations = []
        
        # Group by category
        by_category = {}
        for sub in subscriptions:
            category = sub.vendor.category if sub.vendor else 'other'
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(sub)
        
        # Check each category for redundancies
        for category, subs in by_category.items():
            if len(subs) < 2:
                continue
            
            # Build context for AI
            context = {
                'category': category,
                'subscriptions': []
            }
            
            for sub in subs:
                context['subscriptions'].append({
                    'name': sub.name,
                    'monthly_cost': float(sub.monthly_cost or 0),
                    'utilization_rate': sub.utilization_rate,
                    'active_users': sub.assigned_licenses
                })
            
            # Check with AI
            rec = self._check_redundancy_with_ai(organization, context)
            if rec:
                recommendations.append(rec)
        
        return recommendations
    
    def _check_redundancy_with_ai(self, organization, context):
        """Check for redundancy with AI"""
        from services.models import Recommendation, Subscription
        
        prompt = f"""
Analyze these {context['category']} tools for potential redundancy:

"""
        
        total_cost = 0
        for sub in context['subscriptions']:
            prompt += f"- {sub['name']}: ${sub['monthly_cost']}/mo, {sub['utilization_rate']}% utilization, {sub['active_users']} users\n"
            total_cost += sub['monthly_cost']
        
        prompt += f"""
Total monthly spend on {context['category']} tools: ${total_cost:.2f}

Are any of these tools redundant? Could they be consolidated?
Consider:
1. Overlapping functionality
2. User overlap
3. Cost efficiency of consolidation
4. Feature parity

Return a JSON recommendation if consolidation would save money, or null if no action needed.
"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a SaaS expert analyzing tool redundancy. Return JSON recommendations for consolidation."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            
            if result and result.get('consolidate'):
                # Find primary subscription to attach recommendation
                sub_name = context['subscriptions'][0]['name']
                subscription = Subscription.objects.filter(
                    organization=organization,
                    name=sub_name
                ).first()
                
                if subscription:
                    rec = Recommendation.objects.create(
                        subscription=subscription,
                        type='consolidate',
                        title=f"Consolidate {context['category']} tools",
                        description=result.get('description', 'Consider consolidating redundant tools'),
                        estimated_savings=result.get('savings', 0),
                        priority='high',
                        ai_confidence=result.get('confidence', 0.7),
                        ai_reasoning=result.get('reasoning', '')
                    )
                    return rec
            
        except Exception as e:
            logger.error(f"Redundancy check error: {e}")
        
        return None
    
    def get_quick_wins(self, organization, limit=5):
        """Get quick win recommendations"""
        from services.models import Recommendation
        
        return Recommendation.objects.filter(
            subscription__organization=organization,
            status='pending',
            priority__in=['high', 'critical']
        ).order_by('-estimated_savings')[:limit]
    
    def get_total_potential_savings(self, organization):
        """Calculate total potential savings"""
        from services.models import Recommendation
        
        result = Recommendation.objects.filter(
            subscription__organization=organization,
            status='pending'
        ).aggregate(total=Sum('estimated_savings'))
        
        return result['total'] or 0
    
    def generate_optimization_report(self, organization):
        """Generate comprehensive optimization report"""
        from services.models import Subscription, Recommendation
        
        subscriptions = Subscription.objects.filter(
            organization=organization,
            status='active'
        )
        
        recommendations = Recommendation.objects.filter(
            subscription__organization=organization,
            status='pending'
        )
        
        report = {
            'generated_at': timezone.now().isoformat(),
            'summary': {
                'total_subscriptions': subscriptions.count(),
                'total_monthly_spend': float(subscriptions.aggregate(
                    total=Sum('monthly_cost')
                )['total'] or 0),
                'avg_utilization': subscriptions.aggregate(
                    avg=Avg('utilization_rate')
                )['avg'] or 0,
                'pending_recommendations': recommendations.count(),
                'potential_monthly_savings': float(recommendations.aggregate(
                    total=Sum('estimated_savings')
                )['total'] or 0)
            },
            'by_category': {},
            'top_recommendations': [],
            'low_utilization': [],
            'upcoming_renewals': []
        }
        
        # Group by category
        for sub in subscriptions.select_related('vendor'):
            category = sub.vendor.category if sub.vendor else 'other'
            
            if category not in report['by_category']:
                report['by_category'][category] = {
                    'count': 0,
                    'total_cost': 0,
                    'subscriptions': []
                }
            
            report['by_category'][category]['count'] += 1
            report['by_category'][category]['total_cost'] += float(sub.monthly_cost or 0)
            report['by_category'][category]['subscriptions'].append({
                'name': sub.name,
                'cost': float(sub.monthly_cost or 0),
                'utilization': sub.utilization_rate
            })
        
        # Top recommendations
        for rec in recommendations.order_by('-estimated_savings')[:10]:
            report['top_recommendations'].append({
                'subscription': rec.subscription.name,
                'type': rec.type,
                'title': rec.title,
                'savings': float(rec.estimated_savings or 0),
                'priority': rec.priority
            })
        
        # Low utilization
        for sub in subscriptions.filter(utilization_rate__lt=30):
            report['low_utilization'].append({
                'name': sub.name,
                'utilization': sub.utilization_rate,
                'cost': float(sub.monthly_cost or 0)
            })
        
        # Upcoming renewals
        thirty_days = timezone.now() + timezone.timedelta(days=30)
        for sub in subscriptions.filter(renewal_date__lte=thirty_days):
            report['upcoming_renewals'].append({
                'name': sub.name,
                'renewal_date': str(sub.renewal_date),
                'cost': float(sub.monthly_cost or 0)
            })
        
        return report


# Singleton instance
recommendation_engine = RecommendationEngine()
