"""
Stripe billing for organization plans.
"""

import logging

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsAdmin, IsOrgMember
from users.models import Organization
from users.plans import entitlements_payload

logger = logging.getLogger('swm')

PLAN_LABELS = {
    Organization.PlanType.STARTER: 'Starter',
    Organization.PlanType.PRO: 'Pro',
    Organization.PlanType.ENTERPRISE: 'Enterprise',
}


def _price_map():
    return {
        Organization.PlanType.STARTER: getattr(settings, 'STRIPE_PRICE_STARTER', '') or '',
        Organization.PlanType.PRO: getattr(settings, 'STRIPE_PRICE_PRO', '') or '',
        Organization.PlanType.ENTERPRISE: getattr(settings, 'STRIPE_PRICE_ENTERPRISE', '') or '',
    }


def _plan_for_price_id(price_id):
    if not price_id:
        return None
    for plan, configured in _price_map().items():
        if configured and configured == price_id:
            return plan
    return None


def _stripe_configured():
    from users.billing_service import configured
    return configured()


class BillingStatusView(APIView):
    """Current plan and whether Stripe Checkout is available."""

    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def get(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No organization associated with this account'}, status=400)

        prices = _price_map()
        entitlements = entitlements_payload(org)
        return Response({
            'plan': org.plan,
            'plan_label': PLAN_LABELS.get(org.plan, org.plan),
            'effective_plan': entitlements['effective_plan'],
            'trial_ends_at': org.trial_ends_at,
            'is_on_trial': org.is_on_trial,
            'has_pro_access': org.has_pro_access,
            'features': entitlements['features'],
            'feature_labels': entitlements['feature_labels'],
            'seat_limit': entitlements['seat_limit'],
            'subscription_limit': entitlements['subscription_limit'],
            'stripe_configured': _stripe_configured(),
            'has_stripe_customer': bool(org.stripe_customer_id),
            'has_stripe_subscription': bool(org.stripe_subscription_id),
            'plans': [
                {
                    'id': Organization.PlanType.STARTER,
                    'name': 'Starter',
                    'price': '$0',
                    'period': 'forever',
                    'description': 'Manual tracking for small teams (2 seats, 25 subscriptions)',
                    'checkout_enabled': False,
                },
                {
                    'id': Organization.PlanType.PRO,
                    'name': 'Pro',
                    'price': '$49',
                    'period': 'per month',
                    'description': 'Auto-discovery, AI recommendations, bank feeds (25 seats)',
                    'checkout_enabled': _stripe_configured() and bool(prices[Organization.PlanType.PRO]),
                },
                {
                    'id': Organization.PlanType.ENTERPRISE,
                    'name': 'Enterprise',
                    'price': 'Custom',
                    'period': 'contact us',
                    'description': 'Unlimited seats, SSO workflows, dedicated support',
                    'checkout_enabled': _stripe_configured() and bool(prices[Organization.PlanType.ENTERPRISE]),
                },
            ],
        })


class CreateCheckoutSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        from users.billing_service import checkout
        try:
            return checkout(request)
        except Exception:
            logger.warning('Stripe checkout unavailable')
            return Response({'error': 'Unable to start checkout. Please try again.'}, status=503)


class CreateBillingPortalSessionView(APIView):
    """Open the Stripe customer portal for payment methods and invoices."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        org = request.user.organization
        if not org or not org.stripe_customer_id:
            return Response(
                {'error': 'No Stripe customer on this organization. Subscribe to a paid plan first.'},
                status=400,
            )
        if not _stripe_configured():
            return Response({'error': 'Stripe is not configured.'}, status=400)

        import stripe

        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            session = stripe.billing_portal.Session.create(
                customer=org.stripe_customer_id,
                return_url=f"{settings.FRONTEND_URL}/settings/billing",
            )
        except Exception as exc:
            logger.warning('Stripe portal session failed: %s', exc)
            return Response({'error': 'Unable to open the billing portal.'}, status=400)

        return Response({'portal_url': session.url})


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = []  # Provider retries must not compete with public API throttling.

    def post(self, request):
        if not settings.STRIPE_WEBHOOK_SECRET:
            return Response({'error': 'Billing webhook is unavailable.'}, status=400)
        import stripe
        from users.billing_service import process_event
        try:
            event = stripe.Webhook.construct_event(
                request.body, request.META.get('HTTP_STRIPE_SIGNATURE', ''), settings.STRIPE_WEBHOOK_SECRET,
            )
        except (ValueError, stripe.SignatureVerificationError):
            return Response({'error': 'Invalid webhook'}, status=400)
        try:
            process_event(event)
        except ValueError:
            logger.warning('Stripe webhook rejected: invalid billing mapping')
            return Response({'error': 'Invalid billing event'}, status=400)
        except Exception:
            logger.warning('Stripe webhook reconciliation failed; provider should retry')
            return Response({'error': 'Billing is temporarily unavailable'}, status=503)
        return Response({'received': True})
