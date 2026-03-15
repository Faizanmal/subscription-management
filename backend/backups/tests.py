"""
Tests for backups app - data backup and export functionality
"""

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from users.models import Organization, Role

User = get_user_model()


class BackupTestCase(TestCase):
    """Test backup management"""
    
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
    
    def test_backup_requires_admin(self):
        """Test that backup endpoints require admin role"""
        # Create a non-admin user
        non_admin_role = Role.objects.create(
            organization=self.org,
            name='Member',
            type=Role.RoleType.MEMBER,
            is_system_role=True
        )
        non_admin = User.objects.create_user(
            email='member@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=non_admin_role
        )
        
        # Login as non-admin
        login_url = reverse('token_obtain_pair')
        login_data = {
            'email': 'member@example.com',
            'password': 'testpass123!@#'
        }
        login_response = self.client.post(login_url, login_data, content_type='application/json')
        token = login_response.json()['access']
        headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        # Try to access backups (should be forbidden)
        url = reverse('backup-list')
        response = self.client.get(url, **headers)
        self.assertEqual(response.status_code, 403)
    
    def test_admin_can_access_backups(self):
        """Test that admin users can access backup endpoints"""
        url = reverse('backup-list')
        response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 200)
