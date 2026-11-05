import hashlib
import io
import re
import tempfile
from datetime import timedelta
from unittest.mock import patch
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import User, Organization, Role, EmailVerification
from users.verification import send_verification
from users.policies import current_versions

@override_settings(ENFORCE_EMAIL_VERIFICATION=True, ENFORCE_POLICY_ACCEPTANCE=False, EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class EmailVerificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('verify@example.com', 'UncommonPhrase123!', is_verified=True)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(RefreshToken.for_user(self.user).access_token))

    def test_legacy_flag_does_not_bypass_gate_and_me_and_resend_still_work(self):
        self.assertTrue(self.client.get(reverse('me')).data['email_verification_required'])
        self.assertEqual(self.client.get(reverse('billing-status')).status_code, 403)
        self.assertEqual(self.client.post(reverse('verification-request')).status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.client.post(reverse('verification-request')).status_code, 429)
        token = re.search(r'token=([A-Za-z0-9_-]+)', mail.outbox[0].body).group(1)
        self.assertEqual(EmailVerification.objects.get().code_hash, hashlib.sha256(token.encode()).hexdigest())
        # Confirmation needs no existing browser session and never grants a session.
        self.client.credentials()
        response = self.client.post(reverse('verification-confirm'), {'token': token}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('tokens', response.data)
        self.assertEqual(self.client.post(reverse('verification-confirm'), {'token': token}, format='json').status_code, 400)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.email_verified_at)

    def test_expired_changed_email_and_inactive_user_are_rejected(self):
        for case in ['expired', 'changed', 'inactive']:
            code = case.ljust(43, 'x')
            EmailVerification.objects.create(user=self.user, email='different@example.com' if case == 'changed' else self.user.email, code_hash=hashlib.sha256(code.encode()).hexdigest(), expires_at=timezone.now() + timedelta(hours=-1 if case == 'expired' else 1))
            if case == 'inactive':
                self.user.is_active = False; self.user.save()
            self.assertEqual(self.client.post(reverse('verification-confirm'), {'token': code}, format='json').status_code, 400)
        self.assertEqual(self.client.post(reverse('verification-confirm'), {'token': []}, format='json').status_code, 400)

    def test_sender_failure_is_safe_and_retryable(self):
        with patch('users.verification.send_mail', side_effect=RuntimeError('private smtp credentials')):
            response = self.client.post(reverse('verification-request'))
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('credentials', str(response.data))

    def test_password_signup_stays_unverified_and_sends_only_after_commit(self):
        self.client.credentials()
        payload = {'email': 'signup@example.com', 'password': 'UncommonPhrase123!', 'password_confirm': 'UncommonPhrase123!', 'organization_name': 'Verify company', 'accept_terms': True, 'acknowledge_privacy': True, **current_versions()}
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(reverse('register_organization'), payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        account = User.objects.get(email=payload['email'])
        self.assertFalse(account.is_verified)
        self.assertIsNone(account.email_verified_at)
        self.assertTrue(response.data['user']['email_verification_required'])
        self.assertEqual(len(mail.outbox), 1)

@override_settings(ENFORCE_EMAIL_VERIFICATION=False, ENFORCE_POLICY_ACCEPTANCE=False)
class OwnerAndAvatarTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='One', slug='one')
        self.role = Role.objects.create(organization=self.org, name='Finance', type='finance')
        self.user = User.objects.create_user('owner@example.com', 'UncommonPhrase123!', organization=self.org, role=self.role)
        self.other = User.objects.create_user('other@example.com', 'UncommonPhrase123!', organization=Organization.objects.create(name='Two', slug='two'))
        User.objects.create_user('inactive@example.com', 'UncommonPhrase123!', organization=self.org, is_active=False)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.media = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.media.name);self.override.enable()
        self.addCleanup(self.media.cleanup);self.addCleanup(self.override.disable)

    def test_owner_options_are_available_to_members_scoped_and_minimal(self):
        response = self.client.get(reverse('organization-member-options'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['id'] for row in response.data], [str(self.user.pk)])
        self.assertEqual(set(response.data[0]), {'id', 'first_name', 'last_name', 'full_name'})
        self.assertEqual(self.client.get(reverse('user-list')).status_code, 403)

    def test_real_image_multipart_upload_and_invalid_images(self):
        output = io.BytesIO();Image.new('RGB', (24, 24), 'blue').save(output, format='PNG')
        response = self.client.patch(reverse('me'), {'first_name': 'Updated', 'avatar': SimpleUploadedFile('photo.png', output.getvalue(), content_type='image/png')}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Updated')
        self.assertIn('/media/avatars/', response.data['avatar'])
        self.assertNotIn('/auth/me/media/', response.data['avatar'])
        self.assertTrue(self.user.avatar.storage.exists(self.user.avatar.name))
        self.assertNotIn('photo.png', self.user.avatar.name)
        response = self.client.patch(reverse('me'), {'avatar': SimpleUploadedFile('photo.svg', b'<svg/>', content_type='image/svg+xml')}, format='multipart')
        self.assertEqual(response.status_code, 400)
        oversized = output.getvalue() + b'x' * (2 * 1024 * 1024)
        response = self.client.patch(reverse('me'), {'avatar': SimpleUploadedFile('large.png', oversized, content_type='image/png')}, format='multipart')
        self.assertEqual(response.status_code, 400)
