"""
Tests for users app - authentication and user management
"""

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from users.models import Organization, Role

User = get_user_model()


class AuthenticationTestCase(TestCase):
    """Test authentication endpoints"""
    
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123!@#'
        )
        # Create organization and role
        self.org = Organization.objects.create(
            name='Test Org',
            slug='test-org'
        )
        self.role = Role.objects.create(
            organization=self.org,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True
        )
        self.user.organization = self.org
        self.user.role = self.role
        self.user.save()
    
    def test_user_login(self):
        """Test JWT token obtain endpoint"""
        url = reverse('token_obtain_pair')
        data = {
            'email': 'test@example.com',
            'password': 'testpass123!@#'
        }
        response = self.client.post(url, data, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())
        self.assertIn('refresh', response.json())
    
    def test_invalid_login(self):
        """Test login with wrong password"""
        url = reverse('token_obtain_pair')
        data = {
            'email': 'test@example.com',
            'password': 'wrongpassword'
        }
        response = self.client.post(url, data, content_type='application/json')
        self.assertIn(response.status_code, [401, 400])
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        url = reverse('register')
        data = {
            'email': 'newuser@example.com',
            'password': 'newpass123!@#',
            'password_confirm': 'newpass123!@#',
            'first_name': 'Test',
            'last_name': 'User'
        }
        response = self.client.post(url, data, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('tokens', response.json())
        self.assertTrue(User.objects.filter(email='newuser@example.com').exists())
    
    def test_get_current_user(self):
        """Test getting current user profile"""
        # First login
        login_url = reverse('token_obtain_pair')
        login_data = {
            'email': 'test@example.com',
            'password': 'testpass123!@#'
        }
        login_response = self.client.post(login_url, login_data, content_type='application/json')
        token = login_response.json()['access']
        
        # Then get user profile
        url = reverse('me')
        headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        response = self.client.get(url, **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['email'], 'test@example.com')

    def test_logout_blacklists_refresh_token(self):
        login_url = reverse('token_obtain_pair')
        login_response = self.client.post(
            login_url,
            {'email': 'test@example.com', 'password': 'testpass123!@#'},
            content_type='application/json',
        )
        tokens = login_response.json()
        logout_url = reverse('logout')
        response = self.client.post(
            logout_url,
            {'refresh': tokens['refresh']},
            content_type='application/json',
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}",
        )
        self.assertEqual(response.status_code, 200)

    def test_update_notification_preferences(self):
        login_url = reverse('token_obtain_pair')
        token = self.client.post(
            login_url,
            {'email': 'test@example.com', 'password': 'testpass123!@#'},
            content_type='application/json',
        ).json()['access']
        url = reverse('me')
        response = self.client.patch(
            url,
            {'notification_preferences': {'email_enabled': False}},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.notification_preferences.get('email_enabled'), False)

    def test_change_password_uses_current_password(self):
        login_url = reverse('token_obtain_pair')
        token = self.client.post(
            login_url,
            {'email': 'test@example.com', 'password': 'testpass123!@#'},
            content_type='application/json',
        ).json()['access']
        url = reverse('change_password')
        response = self.client.post(
            url,
            {
                'current_password': 'testpass123!@#',
                'new_password': 'Newpass123!@#x',
                'new_password_confirm': 'Newpass123!@#x',
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 200)


class OrganizationTestCase(TestCase):
    """Test organization management"""
    
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(
            name='Test Organization',
            slug='test-org'
        )
        self.role = Role.objects.create(
            organization=self.org,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True
        )
        self.user = User.objects.create_user(
            email='admin@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.role
        )
    
    def test_get_current_organization(self):
        """Test getting current user's organization"""
        # Login first
        login_url = reverse('token_obtain_pair')
        login_data = {
            'email': 'admin@example.com',
            'password': 'testpass123!@#'
        }
        login_response = self.client.post(login_url, login_data, content_type='application/json')
        token = login_response.json()['access']
        
        # Get organization
        url = reverse('organization-current')
        headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        response = self.client.get(url, **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Test Organization')

    def test_patch_current_organization(self):
        token = self.client.post(
            reverse('token_obtain_pair'),
            {'email': 'admin@example.com', 'password': 'testpass123!@#'},
            content_type='application/json',
        ).json()['access']
        url = reverse('organization-current')
        response = self.client.patch(
            url,
            {'name': 'Renamed Org', 'domain': 'renamed.com', 'default_currency': 'EUR'},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Renamed Org')
        self.assertEqual(response.json()['domain'], 'renamed.com')
        self.assertEqual(response.json()['default_currency'], 'EUR')

    def _token(self):
        return self.client.post(
            reverse('token_obtain_pair'),
            {'email': 'admin@example.com', 'password': 'testpass123!@#'},
            content_type='application/json',
        ).json()['access']

    def test_plan_cannot_be_patched(self):
        token = self._token()
        url = reverse('organization-current')
        response = self.client.patch(
            url,
            {'plan': 'enterprise'},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['plan'], 'starter')
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, Organization.PlanType.STARTER)

    def test_billing_status(self):
        from django.test import override_settings

        token = self._token()
        with override_settings(STRIPE_SECRET_KEY=''):
            response = self.client.get(
                reverse('billing-status'),
                HTTP_AUTHORIZATION=f'Bearer {token}',
            )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['plan'], 'starter')
        self.assertIn('features', payload)
        self.assertFalse(payload['features'].get('ai_recommendations'))
        self.assertFalse(payload['stripe_configured'])
        self.assertEqual(len(payload['plans']), 3)

    def test_checkout_requires_stripe_config(self):
        token = self._token()
        response = self.client.post(
            reverse('billing-checkout'),
            {'plan': 'pro'},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 400)

    def test_stripe_webhook_requires_secret(self):
        response = self.client.post(
            reverse('billing-webhook'),
            {},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_stripe_webhook_checkout_upgrades_org_to_pro(self):
        from unittest.mock import patch
        from django.test import override_settings

        self.org.plan = Organization.PlanType.STARTER
        self.org.save(update_fields=['plan'])
        fake_event = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'client_reference_id': str(self.org.id),
                    'customer': 'cus_test_123',
                    'subscription': 'sub_test_123',
                    'metadata': {'plan': 'pro', 'organization_id': str(self.org.id)},
                }
            },
        }
        with override_settings(STRIPE_WEBHOOK_SECRET='whsec_test_secret', STRIPE_SECRET_KEY='sk_test_dummy'):
            with patch('stripe.Webhook.construct_event', return_value=fake_event):
                response = self.client.post(
                    reverse('billing-webhook'),
                    data=b'{}',
                    content_type='application/json',
                    HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
                )
        self.assertEqual(response.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, Organization.PlanType.PRO)
        self.assertEqual(self.org.stripe_customer_id, 'cus_test_123')
        self.assertEqual(self.org.stripe_subscription_id, 'sub_test_123')

    def test_stripe_webhook_subscription_deleted_downgrades_to_starter(self):
        from unittest.mock import patch
        from django.test import override_settings

        self.org.plan = Organization.PlanType.PRO
        self.org.stripe_customer_id = 'cus_test_123'
        self.org.stripe_subscription_id = 'sub_test_123'
        self.org.save(update_fields=['plan', 'stripe_customer_id', 'stripe_subscription_id'])
        fake_event = {
            'type': 'customer.subscription.deleted',
            'data': {
                'object': {
                    'id': 'sub_test_123',
                    'customer': 'cus_test_123',
                    'status': 'canceled',
                }
            },
        }
        with override_settings(STRIPE_WEBHOOK_SECRET='whsec_test_secret', STRIPE_SECRET_KEY='sk_test_dummy'):
            with patch('stripe.Webhook.construct_event', return_value=fake_event):
                response = self.client.post(
                    reverse('billing-webhook'),
                    data=b'{}',
                    content_type='application/json',
                    HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
                )
        self.assertEqual(response.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, Organization.PlanType.STARTER)
        self.assertIsNone(self.org.stripe_subscription_id)

    def test_starter_blocks_live_connectors(self):
        from django.utils import timezone

        self.org.trial_ends_at = timezone.now() - timezone.timedelta(days=1)
        self.org.plan = Organization.PlanType.STARTER
        self.org.save(update_fields=['trial_ends_at', 'plan'])
        token = self._token()
        response = self.client.get(
            reverse('google-oauth-setup'),
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.json()['code'], 'plan_upgrade_required')

    def test_trial_allows_live_connectors_setup_gate(self):
        from django.test import override_settings
        from django.utils import timezone

        self.org.trial_ends_at = timezone.now() + timezone.timedelta(days=7)
        self.org.plan = Organization.PlanType.STARTER
        self.org.save(update_fields=['trial_ends_at', 'plan'])
        token = self._token()
        with override_settings(GOOGLE_CLIENT_ID=''):
            response = self.client.get(
                reverse('google-oauth-setup'),
                HTTP_AUTHORIZATION=f'Bearer {token}',
            )
        # Entitled by trial; fails only because Google is not configured
        self.assertEqual(response.status_code, 400)
        self.assertIn('not configured', response.json()['error'])


class InvitationAcceptTestCase(TestCase):
    def setUp(self):
        from django.utils import timezone
        from users.models import UserInvitation

        self.client = Client()
        self.org = Organization.objects.create(name='Invite Org', slug='invite-org')
        self.role = Role.objects.create(
            organization=self.org,
            name='Member',
            type=Role.RoleType.MEMBER,
            is_system_role=True,
        )
        self.inviter = User.objects.create_user(
            email='owner@invite.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.role,
        )
        self.invitation = UserInvitation.objects.create(
            organization=self.org,
            email='newhire@invite.com',
            role=self.role,
            invited_by=self.inviter,
            token='invite-token-abc',
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )

    def test_accept_invitation_creates_user(self):
        url = reverse('accept_invitation')
        response = self.client.post(
            url,
            {
                'token': 'invite-token-abc',
                'password': 'Newhire123!@#x',
                'password_confirm': 'Newhire123!@#x',
                'first_name': 'New',
                'last_name': 'Hire',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn('tokens', response.json())
        self.assertTrue(User.objects.filter(email='newhire@invite.com').exists())

    def test_accept_invitation_rejects_bad_token(self):
        url = reverse('accept_invitation')
        response = self.client.post(
            url,
            {
                'token': 'not-a-real-token',
                'password': 'Newhire123!@#x',
                'password_confirm': 'Newhire123!@#x',
                'first_name': 'New',
                'last_name': 'Hire',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
