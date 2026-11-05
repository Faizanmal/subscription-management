import hashlib
from datetime import timedelta
from types import SimpleNamespace

from django.test import TestCase, override_settings, RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from social_core.exceptions import AuthPolicyError

from users.models import User, PolicyAcceptance, SocialLoginCode
from users.policies import current_versions, record_acceptance
from users.social_views import verifier_challenge, social_complete
from users.pipeline import get_or_create_user, save_organization_info


@override_settings(ENFORCE_POLICY_ACCEPTANCE=True)
class PolicyBoundaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('policy@example.com', 'UncommonPassword123!')
        self.payload = {**current_versions(), 'accept_terms': True, 'acknowledge_privacy': True}

    def authenticate(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(RefreshToken.for_user(self.user).access_token))

    def test_public_policy_versions_and_registration_requires_explicit_current_acceptance(self):
        self.assertEqual(self.client.get(reverse('policy-versions')).status_code, 200)
        signup = {'email': 'new@example.com', 'password': 'UncommonPassword123!', 'password_confirm': 'UncommonPassword123!', 'organization_name': 'New company'}
        for extra in [{}, {**self.payload, 'accept_terms': False}, {**self.payload, 'terms_version': 'old'}]:
            self.assertEqual(self.client.post(reverse('register_organization'), {**signup, **extra}, format='json').status_code, 400)
            self.assertFalse(User.objects.filter(email=signup['email']).exists())
        result = self.client.post(reverse('register_organization'), {**signup, **self.payload}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        account = User.objects.get(email=signup['email'])
        self.assertTrue(account.organization.is_on_trial)
        acceptance = account.policy_acceptances.get()
        self.assertEqual(acceptance.terms_version, current_versions()['terms_version'])
        self.assertIsNotNone(acceptance.accepted_at)

    def test_gate_allows_review_and_acceptance_but_blocks_private_api(self):
        self.authenticate()
        self.assertTrue(self.client.get(reverse('me')).data['agreements_required'])
        for route in ['billing-status', 'billing-checkout', 'organization-start']:
            response = self.client.post(reverse(route), {'name': 'Company', 'plan': 'pro'}, format='json') if route != 'billing-status' else self.client.get(reverse(route))
            self.assertEqual(response.status_code, 403, response.data)
        for _ in range(2):
            self.assertIn(self.client.post(reverse('policy-acceptance'), self.payload, format='json').status_code, [200, 201])
        self.assertEqual(PolicyAcceptance.objects.filter(user=self.user).count(), 1)
        self.assertFalse(self.client.get(reverse('me')).data['agreements_required'])
        with override_settings(TERMS_VERSION='new-version'):
            self.assertEqual(self.client.get(reverse('billing-status')).status_code, 403)

    def test_social_account_can_create_one_trial_workspace_after_agreement(self):
        self.authenticate()
        record_acceptance(self.user, 'test')
        result = self.client.post(reverse('organization-start'), {'name': 'Social company'}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role.type, 'admin')
        self.assertTrue(self.user.organization.is_on_trial)
        self.assertEqual(self.client.post(reverse('organization-start'), {'name': 'Other'}, format='json').status_code, 409)


class SocialHandoffTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('social@example.com', None)
        self.code = 'C' * 43
        self.verifier = 'V' * 43
        self.record = SocialLoginCode.objects.create(code_hash=hashlib.sha256(self.code.encode()).hexdigest(), user=self.user, challenge=verifier_challenge(self.verifier), expires_at=timezone.now() + timedelta(seconds=90))

    def exchange(self, verifier=None):
        return self.client.post(reverse('social-exchange'), {'code': self.code, 'verifier': verifier or self.verifier}, format='json')

    def test_exchange_is_browser_bound_and_single_use(self):
        self.assertEqual(self.exchange('W' * 43).status_code, 400)
        response = self.exchange()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(self.exchange().status_code, 400)

    def test_expired_inactive_and_mfa_accounts_cannot_exchange(self):
        self.record.expires_at = timezone.now() - timedelta(seconds=1)
        self.record.save()
        self.assertEqual(self.exchange().status_code, 400)
        self.record.expires_at = timezone.now() + timedelta(seconds=90)
        self.record.save()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.exchange().status_code, 400)
        self.user.is_active = True
        self.user.save()
        self.user.mfa_devices.create(device_type='totp', name='Authenticator', secret='JBSWY3DPEHPK3PXP', is_verified=True)
        self.assertEqual(self.exchange().status_code, 400)

    def test_social_complete_places_only_short_lived_nonce_in_redirect(self):
        request = RequestFactory().get('/social/finish/')
        request.user = self.user
        from django.contrib.sessions.backends.db import SessionStore
        request.session = SessionStore()
        request.session['swm_challenge'] = verifier_challenge(self.verifier)
        response = social_complete(request)
        self.assertIn('/auth/callback?code=', response.url)
        self.assertNotIn('access=', response.url)
        self.assertEqual(response['Referrer-Policy'], 'no-referrer')

    def test_provider_email_is_verified_and_never_implicitly_links_local_account(self):
        backend = SimpleNamespace(name='google-oauth2')
        with self.assertRaises(AuthPolicyError):
            get_or_create_user(None, {'email': 'fresh@example.com'}, backend, response={'email_verified': False})
        with self.assertRaises(AuthPolicyError):
            get_or_create_user(None, {'email': self.user.email}, backend, response={'email_verified': True})
        result = get_or_create_user(None, {'email': 'fresh@example.com'}, backend, response={'email_verified': True})
        save_organization_info(backend, result['user'], {'email': 'fresh@example.com'})
        self.assertIsNone(result['user'].organization_id)

    def test_provider_mail_attribute_without_verified_claim_still_requires_email_proof(self):
        from unittest.mock import patch
        backend = SimpleNamespace(name='microsoft-graph')
        with patch('users.verification.send_initial_verification') as send:
            with self.captureOnCommitCallbacks(execute=True):
                result = get_or_create_user(None, {'email': 'graph@example.com'}, backend, response={'mail': 'graph@example.com'})
        self.assertIsNone(result['user'].email_verified_at)
        self.assertFalse(result['user'].is_verified)
        send.assert_called_once_with(result['user'].pk)
