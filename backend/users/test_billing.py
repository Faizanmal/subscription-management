from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import BillingWebhookEvent, Organization, Role, User


@override_settings(STRIPE_SECRET_KEY='sk_test_configured123456789', STRIPE_WEBHOOK_SECRET='whsec_configured123456789', STRIPE_PRICE_PRO='price_configured123456789')
class BillingLifecycleTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Billing', slug='billing')
        role = Role.objects.create(organization=self.org, type='admin', name='Admin')
        self.user = User.objects.create_user('billing@test.com', 'TestPassword123!', organization=self.org, role=role)
        self.client = APIClient()
        self.subscription = {
            'id': 'sub_current', 'customer': 'cus_current', 'status': 'active',
            'items': {'data': [{'price': {'id': 'price_configured123456789'}}]},
            'latest_invoice': {'status': 'paid'},
            'metadata': {'organization_id': str(self.org.pk)},
        }
        self.event = {
            'id': 'evt_first', 'type': 'checkout.session.completed',
            'data': {'object': {'id': 'cs_current', 'client_reference_id': str(self.org.pk), 'customer': 'cus_current', 'subscription': 'sub_current', 'payment_status': 'paid'}},
        }

    def deliver(self, event=None, subscription=None):
        with patch('stripe.Webhook.construct_event', return_value=event or self.event), patch('stripe.Subscription.retrieve', return_value=subscription or self.subscription):
            return self.client.post(reverse('billing-webhook'), {}, format='json', HTTP_STRIPE_SIGNATURE='signed')

    def bind_subscription(self):
        self.org.stripe_customer_id = 'cus_current'
        self.org.stripe_subscription_id = 'sub_current'
        self.org.plan = 'pro'
        self.org.save()

    def test_paid_checkout_upgrades_once(self):
        self.assertEqual(self.deliver().status_code, 200)
        with patch('stripe.Subscription.retrieve') as retrieve:
            self.assertEqual(self.deliver().status_code, 200)
            retrieve.assert_not_called()
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'pro')
        self.assertEqual(BillingWebhookEvent.objects.count(), 1)

    def test_real_sdk_objects_are_supported_in_webhook_reconciliation(self):
        import stripe
        event = stripe.Event.construct_from(self.event, None)
        subscription = stripe.Subscription.construct_from(self.subscription, None)
        self.assertEqual(self.deliver(event=event, subscription=subscription).status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'pro')

    def test_pending_checkout_does_not_grant_pro(self):
        self.event['data']['object']['payment_status'] = 'unpaid'
        self.subscription['latest_invoice'] = {'status': 'open'}
        self.assertEqual(self.deliver().status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'starter')

    def test_async_success_after_pending_checkout(self):
        self.event['data']['object']['payment_status'] = 'unpaid'
        self.subscription['latest_invoice'] = {'status': 'open'}
        self.deliver()
        self.event['id'] = 'evt_async'
        self.event['type'] = 'checkout.session.async_payment_succeeded'
        self.event['data']['object']['payment_status'] = 'paid'
        self.subscription['latest_invoice'] = {'status': 'paid'}
        self.assertEqual(self.deliver().status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'pro')

    def test_late_unpaid_checkout_snapshot_cannot_revoke_confirmed_payment(self):
        self.bind_subscription()
        self.event['data']['object']['payment_status'] = 'unpaid'
        self.deliver()
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'pro')

    def test_active_subscription_with_unpaid_invoice_is_not_paid_access(self):
        self.bind_subscription()
        self.event.update(id='evt_invoice', type='customer.subscription.updated', data={'object': {'id': 'sub_current', 'customer': 'cus_current'}})
        self.subscription['latest_invoice'] = {'status': 'open'}
        self.deliver()
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'starter')

    def test_stale_event_uses_current_stripe_state(self):
        self.bind_subscription()
        self.event.update(type='customer.subscription.updated', data={'object': {'id': 'sub_current', 'customer': 'cus_current', 'status': 'active'}})
        self.subscription['status'] = 'canceled'
        self.deliver()
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'starter')
        self.assertIsNone(self.org.stripe_subscription_id)

    def test_past_due_and_unknown_prices_fail_closed(self):
        for status, price in [('past_due', 'price_configured123456789'), ('active', 'price_unknown')]:
            with self.subTest(status=status):
                self.bind_subscription()
                self.event['id'] = f'evt_{status}'
                self.subscription['status'] = status
                self.subscription['items']['data'][0]['price']['id'] = price
                self.deliver()
                self.org.refresh_from_db()
                self.assertEqual(self.org.plan, 'starter')

    def test_wrong_customer_does_not_mutate_org_or_receipt(self):
        self.bind_subscription()
        self.event['data']['object']['customer'] = 'cus_other'
        self.assertEqual(self.deliver().status_code, 400)
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'pro')
        self.assertFalse(BillingWebhookEvent.objects.exists())

    def test_wrong_organization_metadata_is_rejected(self):
        self.subscription['metadata']['organization_id'] = 'another-org'
        self.assertEqual(self.deliver().status_code, 400)
        self.assertFalse(BillingWebhookEvent.objects.exists())

    def test_invalid_signature_rejected(self):
        with patch('stripe.Webhook.construct_event', side_effect=ValueError('invalid')):
            response = self.client.post(reverse('billing-webhook'), {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_lookup_failure_can_be_retried(self):
        with patch('stripe.Webhook.construct_event', return_value=self.event), patch('stripe.Subscription.retrieve', side_effect=RuntimeError('secret must not be logged')):
            response = self.client.post(reverse('billing-webhook'), {}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertFalse(BillingWebhookEvent.objects.exists())
        self.assertEqual(self.deliver().status_code, 200)

    def test_stale_checkout_does_not_replace_new_checkout(self):
        self.org.stripe_checkout_session_id = 'cs_new'
        self.org.save()
        self.deliver()
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, 'starter')
        self.assertIsNone(self.org.stripe_customer_id)

    def test_repeat_checkout_reuses_session_and_existing_subscription_is_blocked(self):
        self.client.force_authenticate(self.user)
        session = {'id': 'cs_current', 'url': 'https://checkout.stripe.com/test', 'status': 'open', 'metadata': {'plan': 'pro'}}
        with patch('stripe.checkout.Session.create', return_value=session) as create, patch('stripe.checkout.Session.retrieve', return_value=session):
            first = self.client.post(reverse('billing-checkout'), {'plan': 'pro'}, format='json')
            second = self.client.post(reverse('billing-checkout'), {'plan': 'pro'}, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(create.call_count, 1)
        self.assertEqual(create.call_args.kwargs['payment_method_types'], ['card'])
        self.bind_subscription()
        self.assertEqual(self.client.post(reverse('billing-checkout'), {'plan': 'pro'}, format='json').status_code, 409)

    def test_checkout_supports_actual_sdk_session_objects(self):
        import stripe
        self.client.force_authenticate(self.user)
        session = stripe.checkout.Session.construct_from({'id': 'cs_sdk', 'url': 'https://checkout.stripe.com/test', 'status': 'open', 'metadata': {'plan': 'pro'}}, None)
        with patch('stripe.checkout.Session.create', return_value=session), patch('stripe.checkout.Session.retrieve', return_value=session):
            self.assertEqual(self.client.post(reverse('billing-checkout'), {'plan': 'pro'}, format='json').status_code, 200)
            self.assertEqual(self.client.post(reverse('billing-checkout'), {'plan': 'pro'}, format='json').status_code, 200)
