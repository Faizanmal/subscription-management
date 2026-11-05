"""Fast, deterministic tests; provider credentials never come from local .env files."""

from .settings import *  # noqa: F403

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
# Existing feature tests use direct user fixtures; policy boundary tests enable it.
ENFORCE_POLICY_ACCEPTANCE = False
SECRET_KEY = 'test-only-django-key-not-for-deployment-01234567890123456789'
SIMPLE_JWT = {**SIMPLE_JWT, 'SIGNING_KEY': SECRET_KEY}  # noqa: F405
STRIPE_SECRET_KEY = STRIPE_WEBHOOK_SECRET = STRIPE_PRICE_PRO = STRIPE_PRICE_ENTERPRISE = ''
GOOGLE_CLIENT_ID = GOOGLE_CLIENT_SECRET = ''
MICROSOFT_CLIENT_ID = MICROSOFT_CLIENT_SECRET = ''
PLAID_CLIENT_ID = PLAID_SECRET = OPENAI_API_KEY = ''

ENFORCE_EMAIL_VERIFICATION = False
