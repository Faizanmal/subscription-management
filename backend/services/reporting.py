"""Recorded spend and confirmed savings; estimates never become actuals."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from services.models import Subscription, Recommendation, CostRecord, SavingsReport
from services.money import checked_rows, monthly_total, confirmed_total, potential_total, money
from users.models import Organization, User


def build_savings_report(organization_id, period='monthly', generated_by_id=None):
    if period not in SavingsReport.Period.values:
        raise ValueError('Period must be monthly, quarterly, or annual.')
    today = timezone.localdate()
    month = 1 if period == 'annual' else ((today.month - 1) // 3 * 3 + 1 if period == 'quarterly' else today.month)
    start = today.replace(month=month, day=1)
    with transaction.atomic():
        org = Organization.objects.select_for_update().get(pk=organization_id)
        subscriptions = list(Subscription.objects.filter(organization=org, status='active'))
        run_rate = monthly_total(subscriptions, org)
        recs = checked_rows(Recommendation.objects.filter(organization=org), org)
        completed = [r for r in recs if r.status == 'completed' and r.savings_confirmed_at
                     and r.savings_effective_date and start <= r.savings_effective_date <= today]
        savings = confirmed_total(completed, org, start, today)
        # Legacy cost_report rows were generated estimates, not invoices received.
        costs = checked_rows(CostRecord.objects.filter(organization=org, period_start__range=(start, today)).exclude(source='cost_report'), org)
        spend = sum((-abs(c.amount) if c.record_type in ('refund', 'credit') else c.amount for c in costs), Decimal('0'))
        by_type, by_department = {}, {}
        for rec in completed:
            by_type[rec.type] = str(money(Decimal(by_type.get(rec.type, '0')) + rec.confirmed_savings))
            department = rec.subscription.department.name if rec.subscription and rec.subscription.department else 'Unassigned'
            by_department[department] = str(money(Decimal(by_department.get(department, '0')) + rec.confirmed_savings))
        report = SavingsReport.objects.filter(organization=org, period=period, period_start=start).order_by('id').first()
        if report is None:
            report = SavingsReport(organization=org, period=period, period_start=start)
        report.period_end = today
        report.total_spend = money(spend)
        # Current recorded spend already reflects any reductions: do not subtract twice.
        report.optimized_spend = money(spend)
        report.total_savings = money(savings)
        report.monthly_run_rate = money(run_rate)
        report.spend_basis = 'recorded_costs'
        report.currency = org.default_currency
        report.savings_by_type = by_type
        report.savings_by_department = by_department
        report.savings_by_action = {str(r.pk): str(r.confirmed_savings) for r in completed}
        report.subscriptions_analyzed = len(subscriptions)
        report.recommendations_generated = sum(start <= r.created_at.date() <= today for r in recs)
        report.recommendations_implemented = len(completed)
        report.generated_by = User.objects.filter(pk=generated_by_id, organization=org).first() if generated_by_id else None
        report.save()
        return {'report_id': str(report.id), 'total_spend': float(spend),
                'monthly_run_rate': float(money(run_rate)), 'implemented_savings': float(savings),
                'potential_savings': float(potential_total([r for r in recs if r.status == 'pending'], org)),
                'currency': org.default_currency, 'spend_basis': report.spend_basis}
