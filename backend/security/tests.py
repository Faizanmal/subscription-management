"""
Tests for security app - API keys, MFA, and security settings
"""

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from users.models import Organization, Role

User = get_user_model()


class APIKeyTestCase(TestCase):
    """Test API key management"""
    
    def setUp(self):
        self.client = Client()
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
    
    def test_permission_required_for_api_keys(self):
        """Test that non-admin users cannot create API keys"""
        # Create a non-admin user
        non_admin_role = Role.objects.create(
            organization=self.org,
            name='Viewer',
            type=Role.RoleType.VIEWER,
            is_system_role=True
        )
        User.objects.create_user(
            email='viewer@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=non_admin_role
        )
        
        # Login as non-admin
        login_url = reverse('token_obtain_pair')
        login_data = {
            'email': 'viewer@example.com',
            'password': 'testpass123!@#'
        }
        login_response = self.client.post(login_url, login_data, content_type='application/json')
        token = login_response.json()['access']
        headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        # Try to access API keys
        url = reverse('api-key-list')
        response = self.client.get(url, **headers)
        self.assertEqual(response.status_code, 403)


class MFASetupTestCase(TestCase):
    """TOTP setup must match the MFADevice model fields."""

    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name='Test Org', slug='test-org')
        self.role = Role.objects.create(
            organization=self.org,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True,
        )
        self.user = User.objects.create_user(
            email='admin@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.role,
        )
        login_response = self.client.post(
            reverse('token_obtain_pair'),
            {'email': 'admin@example.com', 'password': 'testpass123!@#'},
            content_type='application/json',
        )
        self.headers = {'HTTP_AUTHORIZATION': f"Bearer {login_response.json()['access']}"}

    def test_totp_setup_returns_qr_code(self):
        url = reverse('mfa-device-setup')
        response = self.client.post(
            url,
            {'type': 'totp', 'name': 'Authenticator'},
            content_type='application/json',
            **self.headers,
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('device_id', payload)
        self.assertIn('qr_code', payload)
        self.assertTrue(payload['qr_code'].startswith('data:image/png;base64,'))


class PasswordResetTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            email='reset@example.com',
            password='testpass123!@#',
        )

    def test_password_reset_request_does_not_reveal_user(self):
        url = reverse('password-reset-request')
        response = self.client.post(
            url,
            {'email': 'nobody@example.com'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

