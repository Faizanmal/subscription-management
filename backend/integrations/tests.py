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
