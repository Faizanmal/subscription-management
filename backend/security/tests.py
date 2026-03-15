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
        non_admin = User.objects.create_user(
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
