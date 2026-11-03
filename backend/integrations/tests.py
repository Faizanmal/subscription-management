"""
Tests for integrations app - third-party service integrations
"""

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from users.models import Organization, Role

User = get_user_model()


class IntegrationTestCase(TestCase):
    """Test integration management"""
    
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(
            name='Test Org',
            slug='test-org',
            plan=Organization.PlanType.PRO,
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
        
        # Login
        login_url = reverse('token_obtain_pair')
        login_data = {
            'email': 'admin@example.com',
            'password': 'testpass123!@#'
        }
        login_response = self.client.post(login_url, login_data, content_type='application/json')
        self.token = login_response.json()['access']
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}
    
    def test_integration_requires_auth(self):
        """Test that integration endpoints require authentication"""
        url = reverse('integration-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 401)
    
    def test_list_integrations_authenticated(self):
        """Test listing integrations with authentication"""
        url = reverse('integration-list')
        response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 200)

    def test_list_integrations_returns_model_fields(self):
        from integrations.models import Integration

        Integration.objects.create(
            organization=self.org,
            name='Google Workspace',
            type=Integration.IntegrationType.GOOGLE_WORKSPACE,
            status=Integration.Status.CONNECTED,
        )
        url = reverse('integration-list')
        response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        results = payload['results'] if isinstance(payload, dict) else payload
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['type'], 'google_workspace')
        self.assertEqual(results[0]['status'], 'connected')

    def test_google_oauth_setup_requires_config(self):
        from django.test import override_settings

        url = reverse('google-oauth-setup')
        with override_settings(GOOGLE_CLIENT_ID=''):
            response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_google_oauth_setup_returns_auth_url(self):
        from django.test import override_settings

        url = reverse('google-oauth-setup')
        with override_settings(GOOGLE_CLIENT_ID='google-client-id', FRONTEND_URL='http://localhost:3000'):
            response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 200)
        auth_url = response.json()['auth_url']
        self.assertIn('accounts.google.com', auth_url)
        self.assertIn('google-client-id', auth_url)

    def test_google_oauth_callback_rejects_bad_state(self):
        url = reverse('google-oauth-callback')
        response = self.client.post(
            url,
            {'code': 'abc', 'state': 'not-real'},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_email_scan_list(self):
        url = reverse('email-scan-list')
        response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 200)

    def test_plaid_link_token_requires_config(self):
        from django.test import override_settings

        url = reverse('bank-account-plaid-link-token')
        with override_settings(PLAID_CLIENT_ID='', PLAID_SECRET=''):
            response = self.client.post(url, {}, content_type='application/json', **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_create_webhook(self):
        url = reverse('webhook-list')
        response = self.client.post(
            url,
            {'url': 'https://example.com/hooks', 'events': ['subscription.created']},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['url'], 'https://example.com/hooks')

    def test_sso_list(self):
        url = reverse('sso-list')
        response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 200)

    def test_slack_connect_rejects_non_slack_url(self):
        url = reverse('slack-connect')
        response = self.client.post(
            url,
            {'webhook_url': 'https://example.com/not-slack', 'channel_name': 'alerts'},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_okta_connect_rejects_bad_domain(self):
        url = reverse('okta-connect')
        response = self.client.post(
            url,
            {'domain': 'evil.example.com', 'api_token': 'token'},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_azure_ad_connect_requires_fields(self):
        url = reverse('azure-ad-connect')
        response = self.client.post(
            url,
            {'tenant_id': '', 'client_id': '', 'client_secret': ''},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_mocked_connectors_return_coming_soon(self):
        for name in (
            'quickbooks-oauth-setup',
            'xero-oauth-setup',
            'workday-oauth-setup',
            'onelogin-oauth-setup',
        ):
            response = self.client.get(reverse(name), **self.headers)
            self.assertEqual(response.status_code, 501, name)
            self.assertEqual(response.json().get('status'), 'coming_soon')

    def test_credentials_are_encrypted_when_key_set(self):
        from cryptography.fernet import Fernet
        from django.test import override_settings
        from integrations.models import Integration

        key = Fernet.generate_key().decode()
        with override_settings(ENCRYPTION_KEY=key):
            integration = Integration.objects.create(
                organization=self.org,
                name='Plaid',
                type=Integration.IntegrationType.PLAID,
                status=Integration.Status.CONNECTED,
            )
            integration.set_credentials_dict({'access_token': 'secret-token', 'item_id': 'item-1'})
            integration.save(update_fields=['credentials'])
            integration.refresh_from_db()
            stored = integration.credentials.get('access_token', '')
            self.assertTrue(str(stored).startswith('enc:'))
            self.assertNotEqual(stored, 'secret-token')
            self.assertEqual(integration.get_credential('access_token'), 'secret-token')
            self.assertEqual(integration.get_decrypted_credentials()['item_id'], 'item-1')

    def test_starter_cannot_create_live_connector_via_api(self):
        from django.utils import timezone

        self.org.plan = Organization.PlanType.STARTER
        self.org.trial_ends_at = timezone.now() - timezone.timedelta(days=1)
        self.org.save(update_fields=['plan', 'trial_ends_at'])
        url = reverse('integration-list')
        response = self.client.post(
            url,
            {'name': 'Google', 'type': 'google_workspace'},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.json()['code'], 'plan_upgrade_required')

    def test_starter_can_create_slack_integration(self):
        from django.utils import timezone

        self.org.plan = Organization.PlanType.STARTER
        self.org.trial_ends_at = timezone.now() - timezone.timedelta(days=1)
        self.org.save(update_fields=['plan', 'trial_ends_at'])
        url = reverse('integration-list')
        response = self.client.post(
            url,
            {'name': 'Slack Alerts', 'type': 'slack'},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 201)
