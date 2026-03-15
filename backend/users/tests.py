"""
Tests for users app - authentication and user management
"""

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from users.models import Organization, Role
import json

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
