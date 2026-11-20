"""Money rules shared by API writes, imports, connectors, and reports."""
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

SUPPORTED_CURRENCIES = ('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR')
ZERO = Decimal('0')


def currency_code(value):
    code = str(value).strip().upper()
    if code not in SUPPORTED_CURRENCIES:
        raise ValidationError({'currency': 'Choose USD, EUR, GBP, CAD, AUD, or INR.'})
    return code


def require_currency(organization, currency):
    code = currency_code(currency or organization.default_currency)
    if code != organization.default_currency:
        raise ValidationError({'currency': f'This workspace uses {organization.default_currency}. Currency conversion is not supported; enter amounts in that currency.'})
    return code


class WorkspaceMoneyMixin:
    """Model save protects non-API ingestion too. Never silently relabel money."""

    def save(self, *args, **kwargs):
        from users.models import Organization
        with transaction.atomic():
            org = Organization.objects.select_for_update().get(pk=self.organization_id)
            self.currency = require_currency(org, self.currency)
            return super().save(*args, **kwargs)


def checked_rows(rows, organization):
    rows = list(rows)
    for row in rows:
        require_currency(organization, row.currency)
    return rows


def monthly_total(rows, organization):
    return sum((row.monthly_cost for row in checked_rows(rows, organization)), ZERO)


def money(value):
    return Decimal(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def annual_estimate(recommendation):
    if recommendation.savings_period == 'monthly':
        return recommendation.estimated_savings * 12
    if recommendation.savings_period == 'quarterly':
        return recommendation.estimated_savings * 4
    return recommendation.estimated_savings


def potential_total(rows, organization):
    return sum((annual_estimate(row) for row in checked_rows(rows, organization)), ZERO)


def confirmed_total(rows, organization, start=None, end=None):
    """Confirmed amounts are one-time, dated observations, not recurring estimates."""
    return sum((row.confirmed_savings for row in checked_rows(rows, organization)
                if row.confirmed_savings is not None and row.savings_effective_date
                and (start is None or row.savings_effective_date >= start)
                and row.savings_effective_date <= (end or timezone.localdate())), ZERO)
