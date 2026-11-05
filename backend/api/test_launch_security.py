from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from services.models import Subscription
from users.models import Department, Organization, Role, Team


class OrganizationBoundaryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name='One', slug='one')
        cls.other = Organization.objects.create(name='Two', slug='two')
        cls.admin_role = Role.objects.create(organization=cls.org, name='Admin', type='admin')
        cls.foreign_role = Role.objects.create(organization=cls.other, name='Admin', type='admin')
        member_role = Role.objects.create(organization=cls.org, name='Member', type='member')
        User = get_user_model()
        cls.admin = User.objects.create_user('admin@one.com', 'TestPassword123!', organization=cls.org, role=cls.admin_role)
        cls.member = User.objects.create_user('member@one.com', 'TestPassword123!', organization=cls.org, role=member_role)
        cls.foreign_user = User.objects.create_user('admin@two.com', 'TestPassword123!', organization=cls.other, role=cls.foreign_role)
        cls.foreign_department = Department.objects.create(organization=cls.other, name='Private')
        cls.foreign_team = Team.objects.create(organization=cls.other, name='Private')
        cls.subscription = Subscription.objects.create(organization=cls.org, name='Local')
        cls.foreign_subscription = Subscription.objects.create(organization=cls.other, name='Private')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_self_profile_cannot_promote_or_change_membership(self):
        self.client.force_authenticate(self.member)
        original_role = self.member.role_id
        response = self.client.patch(reverse('me'), {
            'first_name': 'Updated', 'role': str(self.admin_role.pk),
            'department': str(self.foreign_department.pk), 'organization': str(self.other.pk),
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role_id, original_role)
        self.assertEqual(self.member.organization_id, self.org.pk)
        self.assertIsNone(self.member.department_id)

    def test_subscription_create_rejects_foreign_relationships(self):
        for field, instance in [('owner', self.foreign_user), ('department', self.foreign_department), ('team', self.foreign_team)]:
            with self.subTest(field=field):
                response = self.client.post(reverse('subscription-list'), {'name': 'Test', field: str(instance.pk)}, format='json')
                self.assertEqual(response.status_code, 400)

    def test_subscription_patch_cannot_link_foreign_owner(self):
        response = self.client.patch(reverse('subscription-detail', args=[self.subscription.pk]), {'owner_id': str(self.foreign_user.pk)}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_foreign_subscription_is_not_visible_or_mutable(self):
        url = reverse('subscription-detail', args=[self.foreign_subscription.pk])
        for response in [self.client.get(url), self.client.patch(url, {'name': 'Stolen'}, format='json'), self.client.delete(url)]:
            self.assertEqual(response.status_code, 404)

    def test_user_update_and_invitation_reject_foreign_role(self):
        response = self.client.patch(reverse('user-detail', args=[self.member.pk]), {'role': str(self.foreign_role.pk)}, format='json')
        self.assertEqual(response.status_code, 400)
        self.org.plan = 'pro'
        self.org.save(update_fields=['plan'])
        response = self.client.post(reverse('invitation-list'), {'email': 'invite@one.com', 'role': str(self.foreign_role.pk)}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_org_admin_cannot_extend_trial(self):
        response = self.client.patch(reverse('organization-current'), {'trial_ends_at': '2099-01-01T00:00:00Z', 'plan': 'enterprise'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.org.refresh_from_db()
        self.assertIsNone(self.org.trial_ends_at)
        self.assertEqual(self.org.plan, 'starter')

    def test_direct_user_creation_cannot_bypass_seat_limit(self):
        response = self.client.post(reverse('user-list'), {'email': 'new@one.com', 'password': 'UncommonPassword123!', 'password_confirm': 'UncommonPassword123!'}, format='json')
        self.assertEqual(response.status_code, 402)

    def test_invalid_organization_signup_rolls_back_user(self):
        self.client.force_authenticate(None)
        response = self.client.post(reverse('register_organization'), {'accept_terms': True, 'acknowledge_privacy': True, 'terms_version': '2026-11-04', 'privacy_version': '2026-11-04', 'email': 'orphan@one.com', 'password': 'UncommonPassword123!', 'password_confirm': 'UncommonPassword123!'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(get_user_model().objects.filter(email='orphan@one.com').exists())
