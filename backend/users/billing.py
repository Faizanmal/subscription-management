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
    return bool(settings.STRIPE_SECRET_KEY)


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
    """Create a Stripe Checkout session for a paid plan."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No organization associated with this account'}, status=400)
        if not _stripe_configured():
            return Response(
                {'error': 'Stripe is not configured. Set STRIPE_SECRET_KEY and a price ID.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = (request.data.get('plan') or '').strip()
        if plan == 'professional':
            plan = Organization.PlanType.PRO
        prices = _price_map()
        price_id = prices.get(plan)
        if plan == Organization.PlanType.STARTER:
            return Response({'error': 'Starter is the free default plan and does not use Checkout.'}, status=400)
        if not price_id:
            return Response(
                {'error': f'No Stripe price configured for the {plan or "requested"} plan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import stripe

        stripe.api_key = settings.STRIPE_SECRET_KEY
        session_kwargs = {
            'mode': 'subscription',
            'client_reference_id': str(org.id),
            'metadata': {'organization_id': str(org.id), 'plan': plan},
            'line_items': [{'price': price_id, 'quantity': 1}],
            'success_url': f"{settings.FRONTEND_URL}/settings/billing?checkout=success",
            'cancel_url': f"{settings.FRONTEND_URL}/settings/billing?checkout=cancel",
        }
        if org.stripe_customer_id:
            session_kwargs['customer'] = org.stripe_customer_id
        else:
            session_kwargs['customer_email'] = request.user.email

        try:
            session = stripe.checkout.Session.create(**session_kwargs)
        except Exception as exc:
            logger.warning('Stripe checkout session failed: %s', exc)
            return Response({'error': 'Unable to start Stripe Checkout.'}, status=400)

        return Response({'checkout_url': session.url, 'session_id': session.id})


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


def _apply_subscription_to_org(org, subscription_object, fallback_plan=None):
    status_value = subscription_object.get('status')
    org.stripe_subscription_id = subscription_object.get('id') or org.stripe_subscription_id
    customer = subscription_object.get('customer')
    if customer:
        org.stripe_customer_id = customer

    if status_value in ('canceled', 'unpaid', 'incomplete_expired'):
        org.plan = Organization.PlanType.STARTER
        if status_value == 'canceled':
            org.stripe_subscription_id = None
    else:
        items = (subscription_object.get('items') or {}).get('data') or []
        price_id = None
        if items:
            price_id = ((items[0].get('price') or {}).get('id'))
        org.plan = _plan_for_price_id(price_id) or fallback_plan or org.plan or Organization.PlanType.PRO
    org.save(update_fields=['plan', 'stripe_customer_id', 'stripe_subscription_id', 'updated_at'])


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    """Stripe event receiver. Verifies the webhook signature; no JWT."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = settings.STRIPE_WEBHOOK_SECRET
        if not secret:
            return Response({'error': 'Stripe webhook secret is not configured.'}, status=400)

        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
        import stripe

        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, secret)
        except Exception as exc:
            name = type(exc).__name__
            if name in ('SignatureVerificationError', 'ValueError'):
                return Response({'error': 'Invalid webhook'}, status=400)
            raise

        event_type = event.get('type')
        obj = event.get('data', {}).get('object', {})

        try:
            if event_type == 'checkout.session.completed':
                org_id = obj.get('client_reference_id') or (obj.get('metadata') or {}).get('organization_id')
                if not org_id:
                    return Response({'received': True})
                org = Organization.objects.filter(id=org_id).first()
                if not org:
                    logger.warning('Stripe checkout for unknown organization')
                    return Response({'received': True})
                org.stripe_customer_id = obj.get('customer') or org.stripe_customer_id
                org.stripe_subscription_id = obj.get('subscription') or org.stripe_subscription_id
                plan = (obj.get('metadata') or {}).get('plan')
                if plan in dict(Organization.PlanType.choices):
                    org.plan = plan
                # Paid checkout ends trial gating; keep timestamp for history if useful.
                update_fields = ['stripe_customer_id', 'stripe_subscription_id', 'plan', 'updated_at']
                if org.plan in (Organization.PlanType.PRO, Organization.PlanType.ENTERPRISE):
                    org.trial_ends_at = None
                    update_fields.append('trial_ends_at')
                org.save(update_fields=update_fields)

            elif event_type in ('customer.subscription.updated', 'customer.subscription.deleted'):
                sub_id = obj.get('id')
                customer = obj.get('customer')
                org = Organization.objects.filter(stripe_subscription_id=sub_id).first()
                if not org and customer:
                    org = Organization.objects.filter(stripe_customer_id=customer).first()
                if org:
                    if event_type.endswith('deleted'):
                        obj = {**obj, 'status': 'canceled'}
                    _apply_subscription_to_org(org, obj)
        except Exception:
            logger.exception('Stripe webhook handling failed')
            return Response({'error': 'Webhook handling failed'}, status=500)

        return Response({'received': True})
