"""
Plan entitlements for Subscription Waste Manager.

Starter (free, after trial): manual tracking only.
Trial / Pro / Enterprise: discovery connectors, AI, workflows.
"""

from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response

from users.models import Organization

# Feature keys used by API gates and billing status.
FEATURE_LIVE_CONNECTORS = 'live_connectors'
FEATURE_DISCOVERY_SYNC = 'discovery_sync'
FEATURE_AI_RECOMMENDATIONS = 'ai_recommendations'
FEATURE_WORKFLOWS = 'workflows'
FEATURE_BANK_FEEDS = 'bank_feeds'

PLAN_FEATURES = {
    Organization.PlanType.STARTER: frozenset(),
    Organization.PlanType.PRO: frozenset({
        FEATURE_LIVE_CONNECTORS,
        FEATURE_DISCOVERY_SYNC,
        FEATURE_AI_RECOMMENDATIONS,
        FEATURE_WORKFLOWS,
        FEATURE_BANK_FEEDS,
    }),
    Organization.PlanType.ENTERPRISE: frozenset({
        FEATURE_LIVE_CONNECTORS,
        FEATURE_DISCOVERY_SYNC,
        FEATURE_AI_RECOMMENDATIONS,
        FEATURE_WORKFLOWS,
        FEATURE_BANK_FEEDS,
    }),
}

# Soft caps (None = unlimited)
SEAT_LIMITS = {
    Organization.PlanType.STARTER: 2,
    Organization.PlanType.PRO: 25,
    Organization.PlanType.ENTERPRISE: None,
}

SUBSCRIPTION_LIMITS = {
    Organization.PlanType.STARTER: 25,
    Organization.PlanType.PRO: 200,
    Organization.PlanType.ENTERPRISE: None,
}

FEATURE_LABELS = {
    FEATURE_LIVE_CONNECTORS: 'Live connectors (Google, Microsoft, Okta, Azure AD)',
    FEATURE_DISCOVERY_SYNC: 'Automatic subscription discovery sync',
    FEATURE_AI_RECOMMENDATIONS: 'AI recommendations',
    FEATURE_WORKFLOWS: 'Automation workflows',
    FEATURE_BANK_FEEDS: 'Bank feeds (Plaid)',
}


def effective_plan(org: Organization | None) -> str:
    """Paid plan wins; otherwise Pro entitlements while trial is active."""
    if not org:
        return Organization.PlanType.STARTER
    if org.plan in (Organization.PlanType.PRO, Organization.PlanType.ENTERPRISE):
        return org.plan
    if org.is_on_trial:
        return Organization.PlanType.PRO
    return Organization.PlanType.STARTER


def has_feature(org: Organization | None, feature: str) -> bool:
    plan = effective_plan(org)
    return feature in PLAN_FEATURES.get(plan, frozenset())


def seat_limit(org: Organization | None) -> int | None:
    return SEAT_LIMITS.get(effective_plan(org))


def subscription_limit(org: Organization | None) -> int | None:
    return SUBSCRIPTION_LIMITS.get(effective_plan(org))


def feature_matrix(org: Organization | None) -> dict[str, bool]:
    plan = effective_plan(org)
    entitled = PLAN_FEATURES.get(plan, frozenset())
    return {key: key in entitled for key in FEATURE_LABELS}


def entitlements_payload(org: Organization | None) -> dict[str, Any]:
    plan = effective_plan(org)
    return {
        'effective_plan': plan,
        'features': feature_matrix(org),
        'feature_labels': FEATURE_LABELS,
        'seat_limit': seat_limit(org),
        'subscription_limit': subscription_limit(org),
        'is_on_trial': bool(org and org.is_on_trial),
        'trial_ends_at': org.trial_ends_at if org else None,
        'stored_plan': org.plan if org else Organization.PlanType.STARTER,
    }


def plan_upgrade_response(feature: str, detail: str | None = None) -> Response:
    label = FEATURE_LABELS.get(feature, feature)
    return Response(
        {
            'error': detail or f'{label} requires Pro (or an active trial).',
            'code': 'plan_upgrade_required',
            'feature': feature,
            'required_plan': Organization.PlanType.PRO,
            'upgrade_url': '/settings/billing',
        },
        status=status.HTTP_402_PAYMENT_REQUIRED,
    )


def require_feature(org: Organization | None, feature: str) -> Response | None:
    if has_feature(org, feature):
        return None
    return plan_upgrade_response(feature)


def require_seat_available(org: Organization) -> Response | None:
    limit = seat_limit(org)
    if limit is None:
        return None
    from users.models import User

    from users.models import UserInvitation

    current = User.objects.filter(organization=org, is_active=True).count()
    pending = org.invitations.filter(status=UserInvitation.Status.PENDING).count()
    if current + pending >= limit:
        return Response(
            {
                'error': f'Seat limit reached for your plan ({limit}). Upgrade to add more teammates.',
                'code': 'plan_upgrade_required',
                'feature': 'seats',
                'required_plan': Organization.PlanType.PRO,
                'upgrade_url': '/settings/billing',
                'seat_limit': limit,
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )
    return None


def require_subscription_slot(org: Organization) -> Response | None:
    limit = subscription_limit(org)
    if limit is None:
        return None
    from services.models import Subscription

    current = Subscription.objects.filter(organization=org).exclude(status='cancelled').count()
    if current >= limit:
        return Response(
            {
                'error': f'Subscription limit reached for your plan ({limit}). Upgrade to track more tools.',
                'code': 'plan_upgrade_required',
                'feature': 'subscriptions',
                'required_plan': Organization.PlanType.PRO,
                'upgrade_url': '/settings/billing',
                'subscription_limit': limit,
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )
    return None
