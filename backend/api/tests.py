"""
Tests for API permissions and exception handling
"""

<<<<<<< HEAD
from django.test import TestCase, Client
=======
from django.test import TestCase
>>>>>>> f2225d53a335250fd763dea989142daf386167f6
from django.contrib.auth import get_user_model
from users.models import Organization, Role
from api.permissions import IsAdmin, IsFinance, IsOrgMember

User = get_user_model()


class PermissionTestCase(TestCase):
    """Test role-based permissions"""
    
    def setUp(self):
        self.org = Organization.objects.create(
            name='Test Org',
            slug='test-org'
        )
        # Create roles
        self.admin_role = Role.objects.create(
            organization=self.org,
            name='Admin',
            type=Role.RoleType.ADMIN,
            is_system_role=True
        )
        self.finance_role = Role.objects.create(
            organization=self.org,
            name='Finance',
            type=Role.RoleType.FINANCE,
            is_system_role=True
        )
        self.member_role = Role.objects.create(
            organization=self.org,
            name='Member',
            type=Role.RoleType.MEMBER,
            is_system_role=True
        )
    
    def test_is_admin_permission(self):
        """Test IsAdmin permission check"""
        admin_user = User.objects.create_user(
            email='admin@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.admin_role
        )
        member_user = User.objects.create_user(
            email='member@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.member_role
        )
        
        permission = IsAdmin()
        
        # Mock request objects
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        admin_request = MockRequest(admin_user)
        member_request = MockRequest(member_user)
        
        self.assertTrue(permission.has_permission(admin_request, None))
        self.assertFalse(permission.has_permission(member_request, None))
    
    def test_is_finance_permission(self):
        """Test IsFinance permission check"""
        admin_user = User.objects.create_user(
            email='admin@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.admin_role
        )
        finance_user = User.objects.create_user(
            email='finance@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.finance_role
        )
        member_user = User.objects.create_user(
            email='member@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.member_role
        )
        
        permission = IsFinance()
        
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        self.assertTrue(permission.has_permission(MockRequest(admin_user), None))
        self.assertTrue(permission.has_permission(MockRequest(finance_user), None))
        self.assertFalse(permission.has_permission(MockRequest(member_user), None))
    
    def test_is_org_member_permission(self):
        """Test IsOrgMember permission check"""
        member = User.objects.create_user(
            email='member@example.com',
            password='testpass123!@#',
            organization=self.org,
            role=self.member_role
        )
        no_org_user = User.objects.create_user(
            email='noorg@example.com',
            password='testpass123!@#'
        )
        
        permission = IsOrgMember()
        
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        self.assertTrue(permission.has_permission(MockRequest(member), None))
        self.assertFalse(permission.has_permission(MockRequest(no_org_user), None))
