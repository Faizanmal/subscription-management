"""
Tests for services app - subscription and vendor management
"""

from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from users.models import Organization, Role
from services.models import (
    SoftwareVendor, Subscription,
    Recommendation, Workflow, AutomationWorkflow, WorkflowExecution
)

User = get_user_model()


class VendorTestCase(TestCase):
    """Test vendor management"""
    
    def setUp(self):
        self.client = APIClient()
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
        self.vendor = SoftwareVendor.objects.create(
            name='Test Vendor',
            category='productivity'
        )
        
        self.client.force_authenticate(user=self.user)
        self.headers = {}
    
    def test_list_vendors(self):
        """Test listing software vendors"""
        url = reverse('vendor-list')
        response = self.client.get(url, follow=True, **self.headers)
        self.assertEqual(response.status_code, 200)
    
    def test_get_vendor(self):
        """Test getting a specific vendor"""
        url = reverse('vendor-detail', args=[self.vendor.id])
        response = self.client.get(url, follow=True, **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Test Vendor')


class SubscriptionTestCase(TestCase):
    """Test subscription management"""
    
    def setUp(self):
        self.client = APIClient()
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
        self.vendor = SoftwareVendor.objects.create(
            name='Test Software',
            category='productivity'
        )
        self.subscription = Subscription.objects.create(
            organization=self.org,
            vendor=self.vendor,
            name='Test Subscription',
            cost_per_unit=99.99,
            status='active'
        )
        
        self.client.force_authenticate(user=self.user)
        self.headers = {}
    
    def test_list_subscriptions(self):
        """Test listing subscriptions"""
        url = reverse('subscription-list')
        response = self.client.get(url, follow=True, **self.headers)
        self.assertEqual(response.status_code, 200)
    
    def test_get_subscription(self):
        """Test getting a specific subscription"""
        url = reverse('subscription-detail', args=[self.subscription.id])
        response = self.client.get(url, follow=True, **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Test Subscription')
    
    def test_create_subscription_no_auth(self):
        """Test that unauthenticated users cannot create subscriptions"""
        url = reverse('subscription-list')
        data = {
            'vendor': str(self.vendor.id),
            'name': 'New Subscription',
            'cost_per_unit': 49.99
        }
        response = APIClient().post(url, data, format='json', follow=True)
        self.assertEqual(response.status_code, 401)

    def test_dashboard_requires_auth(self):
        response = APIClient().get(reverse('dashboard'))
        self.assertEqual(response.status_code, 401)

    def test_dashboard_returns_org_totals(self):
        url = reverse('dashboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('total_subscriptions', payload)
        self.assertGreaterEqual(payload['total_subscriptions'], 1)

    def test_create_subscription_accepts_frontend_payload(self):
        url = reverse('subscription-list')
        response = self.client.post(url, {
            'name': 'Figma Professional',
            'vendor_id': str(self.vendor.id),
            'monthly_cost': 99,
            'billing_cycle': 'monthly',
            'total_licenses': 3,
            'assigned_licenses': 2,
            'status': 'active',
            'start_date': '2026-08-19T12:00:00.000Z',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        created = Subscription.objects.get(name='Figma Professional')
        self.assertEqual(created.vendor_id, self.vendor.id)
        self.assertEqual(created.total_licenses, 3)
        self.assertEqual(created.used_licenses, 2)
        self.assertEqual(float(created.cost_per_unit), 33.0)

    def test_vendor_search_includes_unverified(self):
        url = reverse('vendor-search')
        response = self.client.get(url, {'q': 'Test'})
        self.assertEqual(response.status_code, 200)
        names = [item['name'] for item in response.json()]
        self.assertIn('Test Software', names)


class RecommendationWorkflowIntegrationTestCase(TestCase):
    """Integration tests for recommendation and workflow orchestration"""

    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name='Org One', slug='org-one')
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two')

        self.role = Role.objects.create(
            organization=self.org,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True,
        )
        self.role2 = Role.objects.create(
            organization=self.org2,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True,
        )

        self.user = User.objects.create_user(
            email='owner@org-one.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.role,
        )
        self.other_user = User.objects.create_user(
            email='owner@org-two.com',
            password='testpass123!@#',
            organization=self.org2,
            role=self.role2,
        )

        self.vendor = SoftwareVendor.objects.create(name='Vendor X', category='productivity')
        self.subscription = Subscription.objects.create(
            organization=self.org,
            vendor=self.vendor,
            name='Core SaaS',
            cost_per_unit=100,
            status='active',
        )

        self.recommendation = Recommendation.objects.create(
            organization=self.org,
            subscription=self.subscription,
            type='cancel',
            title='Cancel unused seats',
            description='Cancel unused seats to cut costs',
            estimated_savings=250,
            priority='high',
        )

        self.other_rec = Recommendation.objects.create(
            organization=self.org2,
            type='optimize',
            title='Other org recommendation',
            description='Should not leak',
            estimated_savings=10,
            priority='low',
        )

        self.client.force_authenticate(user=self.user)
        self.headers = {}

    def test_approve_recommendation_creates_approval_workflow(self):
        url = reverse('recommendation-approve', args=[self.recommendation.id])
        response = self.client.post(url, {}, format='json', follow=True, **self.headers)

        self.assertEqual(response.status_code, 200)
        self.recommendation.refresh_from_db()
        self.assertEqual(self.recommendation.status, 'approved')
        self.assertTrue(
            Workflow.objects.filter(
                organization=self.org,
                recommendation=self.recommendation,
                status='pending',
            ).exists()
        )

    def test_recommendation_list_is_scoped_to_organization(self):
        url = reverse('recommendation-list')
        response = self.client.get(url, follow=True, **self.headers)
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        results = payload.get('results', payload)
        ids = {item['id'] for item in results}
        self.assertIn(str(self.recommendation.id), ids)
        self.assertNotIn(str(self.other_rec.id), ids)


class AutomationWorkflowExecutionTestCase(TestCase):
    """Tests for automation workflow run and execution history APIs"""

    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            name='Automation Org',
            slug='automation-org',
            plan=Organization.PlanType.PRO,
        )
        self.role = Role.objects.create(
            organization=self.org,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True,
        )
        self.user = User.objects.create_user(
            email='automation@org.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.role,
        )
        self.workflow = AutomationWorkflow.objects.create(
            organization=self.org,
            name='Low usage notifier',
            description='Notify when subscription usage drops',
            trigger='low_usage',
            action='notify',
            trigger_config={'threshold': 30},
            action_config={'channel': 'email'},
            is_active=True,
            created_by=self.user,
        )

        self.client.force_authenticate(user=self.user)
        self.headers = {}

    def test_manual_run_creates_execution(self):
        from unittest.mock import patch

        url = reverse('workflow-run', args=[self.workflow.id])
        with patch('services.tasks.execute_automation_workflow.delay') as delay:
            response = self.client.post(url, {}, format='json', follow=True, **self.headers)
            self.assertEqual(response.status_code, 202)
            self.assertTrue(delay.called)

        self.assertTrue(
            WorkflowExecution.objects.filter(workflow=self.workflow).exists()
        )

    def test_workflow_execution_list_is_available(self):
        WorkflowExecution.objects.create(workflow=self.workflow, status='completed', trigger_reason='test')
        url = reverse('workflow-execution-list')
        response = self.client.get(url, follow=True, **self.headers)
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        results = payload.get('results', payload)
        self.assertGreaterEqual(len(results), 1)
