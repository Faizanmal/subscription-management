from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.tokens import default_token_generator
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken
import pyotp

from security.models import MFADevice
from users.models import User


class AuthenticationFlowTests(TestCase):
    def setUp(self):
        self.password = 'OriginalPassword123!'
        self.user = User.objects.create_user('flow@acme.com', self.password)

    def login(self, **extra):
        return self.client.post(reverse('token_obtain_pair'), {'email': self.user.email, 'password': self.password, **extra}, content_type='application/json')

    def reset(self, token, password='ReplacementPassword456!'):
        return self.client.post(reverse('password-reset-confirm'), {'token': token, 'new_password': password, 'confirm_password': password}, content_type='application/json')

    def test_reset_is_single_use_and_revokes_old_access_and_refresh(self):
        tokens = self.login().json()
        self.user.refresh_from_db()
        token = f'{self.user.pk}:{default_token_generator.make_token(self.user)}'
        self.assertEqual(self.reset(token).status_code, 200)
        self.assertEqual(self.reset(token).status_code, 400)
        self.assertEqual(self.client.get(reverse('me'), HTTP_AUTHORIZATION=f"Bearer {tokens['access']}").status_code, 401)
        self.assertEqual(self.client.post(reverse('token_refresh'), {'refresh': tokens['refresh']}, content_type='application/json').status_code, 401)

    def test_reset_rejects_malformed_ids_weak_password_and_expired_tokens(self):
        self.assertEqual(self.reset('not-a-uuid:token').status_code, 400)
        token = f'{self.user.pk}:{default_token_generator.make_token(self.user)}'
        self.assertEqual(self.reset(token, '12345678').status_code, 400)
        later = default_token_generator._now() + timedelta(hours=2)
        with patch.object(default_token_generator, '_now', return_value=later):
            self.assertEqual(self.reset(token).status_code, 400)

    def test_verified_totp_requires_code_and_prevents_replay(self):
        secret = pyotp.random_base32()
        MFADevice.objects.create(user=self.user, device_type='totp', name='Authenticator', secret=secret, is_verified=True)
        self.assertEqual(self.login().status_code, 401)
        self.assertEqual(self.login(otp='invalid').status_code, 401)
        code = pyotp.TOTP(secret).now()
        response = self.login(otp=code)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(reverse('me'), HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}").status_code, 200)
        self.assertEqual(self.login(otp=code).status_code, 401)

    def test_tokens_without_mfa_proof_cannot_bypass_mfa(self):
        tokens = self.login().json()
        MFADevice.objects.create(user=self.user, device_type='totp', name='Authenticator', secret=pyotp.random_base32(), is_verified=True)
        self.assertEqual(self.client.get(reverse('me'), HTTP_AUTHORIZATION=f"Bearer {tokens['access']}").status_code, 401)
        # Social/passwordless token issuance cannot bypass the same API rule.
        token = RefreshToken.for_user(self.user).access_token
        self.assertEqual(self.client.get(reverse('me'), HTTP_AUTHORIZATION=f'Bearer {token}').status_code, 401)

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.PBKDF2PasswordHasher'])
    def test_login_with_production_password_hasher(self):
        self.user.set_password(self.password)
        self.user.save()
        self.assertTrue(self.user.password.startswith('pbkdf2_sha256$'))
        self.assertEqual(self.login().status_code, 200)
