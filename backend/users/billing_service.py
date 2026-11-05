"""Serialize billing changes and reconcile webhook snapshots with Stripe state."""

import uuid

from django.conf import settings
from django.db import transaction
from rest_framework.response import Response

from users.models import BillingWebhookEvent, Organization


def plain_object(value):
    """Normalize SDK responses at the boundary (Stripe 16 is no longer a dict)."""
    if hasattr(value, 'to_dict_recursive'):
        return value.to_dict_recursive()
    if hasattr(value, 'to_dict'):
        return value.to_dict()
    return value


def configured():
    from users.management.commands.check_launch_ready import complete
    return all((
        complete(settings.STRIPE_SECRET_KEY, ('sk_test_', 'sk_live_')),
        complete(settings.STRIPE_WEBHOOK_SECRET, ('whsec_',)),
        complete(settings.STRIPE_PRICE_PRO, ('price_',)),
    ))


def checkout(request):
    import stripe
    from users.billing import _price_map

    if not request.user.organization_id:
        return Response({'error': 'No organization associated with this account'}, status=400)
    if not configured():
        return Response({'error': 'Paid checkout is unavailable. Contact support.'}, status=400)
    plan = request.data.get('plan')
    plan = 'pro' if plan == 'professional' else plan
    if plan not in ('pro', 'enterprise') or not _price_map().get(plan):
        return Response({'error': 'Choose an available paid plan.'}, status=400)
    with transaction.atomic():
        org = Organization.objects.select_for_update().get(pk=request.user.organization_id)
        if org.stripe_subscription_id:
            return Response({'error': 'Manage your existing subscription in the billing portal.'}, status=409)
        previous_id = org.stripe_checkout_session_id
        if previous_id:
            previous = plain_object(stripe.checkout.Session.retrieve(previous_id, api_key=settings.STRIPE_SECRET_KEY))
            if previous.get('status') == 'open':
                if (previous.get('metadata') or {}).get('plan') != plan:
                    return Response({'error': 'Finish or expire the existing checkout before changing plans.'}, status=409)
                return Response({'checkout_url': previous['url'], 'session_id': previous['id']})
            if previous.get('status') == 'complete':
                # A completed payment must be reconciled by the signed webhook first.
                if previous.get('subscription') and not org.stripe_customer_id:
                    return Response({'error': 'Your payment is being confirmed. Please try again shortly.'}, status=409)
        kwargs = {
            'mode': 'subscription',
            'client_reference_id': str(org.id),
            'metadata': {'organization_id': str(org.id), 'plan': plan},
            'subscription_data': {'metadata': {'organization_id': str(org.id)}},
            'line_items': [{'price': _price_map()[plan], 'quantity': 1}],
            # Restrict this release to immediate card payments.
            'payment_method_types': ['card'],
            'success_url': f'{settings.FRONTEND_URL}/settings/billing?checkout=success',
            'cancel_url': f'{settings.FRONTEND_URL}/settings/billing?checkout=cancel',
        }
        if org.stripe_customer_id:
            kwargs['customer'] = org.stripe_customer_id
        else:
            kwargs['customer_email'] = request.user.email
        session = plain_object(stripe.checkout.Session.create(
            **kwargs, api_key=settings.STRIPE_SECRET_KEY,
            idempotency_key=f'swm:{org.id}:{plan}:{previous_id or "initial"}',
        ))
        org.stripe_checkout_session_id = session['id']
        org.save(update_fields=['stripe_checkout_session_id', 'updated_at'])
        return Response({'checkout_url': session['url'], 'session_id': session['id']})


CHECKOUT_EVENTS = {'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'}
SUBSCRIPTION_EVENTS = {'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'}


def process_event(event):
    """Lock the org across reconciliation so concurrent stale events cannot win.

    A failed Stripe lookup rolls back the event receipt for safe webhook retries.
    Every update fetches current subscription state rather than trusting event order.
    """
    import stripe
    from users.billing import _plan_for_price_id

    event = plain_object(event)
    event_id, kind = event.get('id'), event.get('type')
    if not isinstance(event_id, str) or not event_id or len(event_id) > 255:
        raise ValueError('Missing event ID')
    if kind not in CHECKOUT_EVENTS | SUBSCRIPTION_EVENTS:
        return
    obj = event.get('data', {}).get('object', {})
    sub_id = obj.get('subscription') if kind in CHECKOUT_EVENTS else obj.get('id')
    customer_id = obj.get('customer')
    if not isinstance(sub_id, str) or not isinstance(customer_id, str):
        raise ValueError('Missing subscription or customer')
    with transaction.atomic():
        if kind in CHECKOUT_EVENTS:
            reference = obj.get('client_reference_id') or (obj.get('metadata') or {}).get('organization_id')
            try:
                org_id = uuid.UUID(str(reference))
            except ValueError:
                raise ValueError('Invalid organization reference') from None
            org = Organization.objects.select_for_update().filter(pk=org_id).first()
        else:
            org = Organization.objects.select_for_update().filter(stripe_subscription_id=sub_id).first()
        if not org:
            return  # Subscription creation can arrive before its Checkout event.
        if BillingWebhookEvent.objects.filter(pk=event_id).exists():
            return
        if org.stripe_customer_id and org.stripe_customer_id != customer_id:
            raise ValueError('Customer does not match organization')
        if org.stripe_subscription_id and org.stripe_subscription_id != sub_id:
            raise ValueError('Subscription does not match organization')
        if kind in CHECKOUT_EVENTS and org.stripe_checkout_session_id and org.stripe_checkout_session_id != obj.get('id'):
            # Ignore a replay from an older checkout after a new checkout was started.
            BillingWebhookEvent.objects.create(event_id=event_id, event_type=kind)
            return
        subscription = plain_object(stripe.Subscription.retrieve(sub_id, expand=['latest_invoice'], api_key=settings.STRIPE_SECRET_KEY))
        if subscription.get('id') != sub_id or subscription.get('customer') != customer_id:
            raise ValueError('Stripe subscription mapping does not match')
        metadata_org = (subscription.get('metadata') or {}).get('organization_id')
        if metadata_org and metadata_org != str(org.pk):
            raise ValueError('Subscription belongs to another organization')
        items = (subscription.get('items') or {}).get('data') or []
        price = ((items[0].get('price') or {}).get('id')) if len(items) == 1 else None
        plan = _plan_for_price_id(price)
        invoice = subscription.get('latest_invoice') or {}
        paid_invoice = isinstance(invoice, dict) and (invoice.get('status') == 'paid' or invoice.get('paid') is True)
        active = subscription.get('status') == 'trialing' or (subscription.get('status') == 'active' and paid_invoice)
        # Current paid invoice / trial status is authoritative. A Checkout event's
        # payment_status can be stale after delayed payment succeeds or fails.
        # Never grant access from Checkout metadata or completion alone.
        org.stripe_customer_id = customer_id
        org.stripe_subscription_id = None if subscription.get('status') == 'canceled' else sub_id
        org.plan = plan if active and plan else Organization.PlanType.STARTER
        # Once billing starts, an old app trial must not bypass a failed payment/downgrade.
        org.trial_ends_at = None
        org.save(update_fields=['stripe_customer_id', 'stripe_subscription_id', 'plan', 'trial_ends_at', 'updated_at'])
        BillingWebhookEvent.objects.create(event_id=event_id, event_type=kind)
