"""
Django settings for Subscription Waste Manager (SWM) SaaS Platform.
Production-ready configuration with environment variables.
"""

import os
import sys
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

# Load environment variables
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-dev-key-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() == 'true'
TESTING = 'test' in sys.argv or os.getenv('DJANGO_TESTING', '').lower() == 'true'

ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Application definition
INSTALLED_APPS = [
    # Django defaults
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'channels',
    'django_celery_beat',
    'django_celery_results',
    'social_django',
    'axes',
    
    # Local apps
    'users.apps.UsersConfig',
    'api.apps.ApiConfig',
    'services.apps.ServicesConfig',
    'integrations.apps.IntegrationsConfig',
    'backups.apps.BackupsConfig',
    'security.apps.SecurityConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'axes.middleware.AxesMiddleware',
    'users.middleware.OrganizationMiddleware',
    'users.middleware.SecurityHeadersMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'social_django.context_processors.backends',
                'social_django.context_processors.login_redirect',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'
ASGI_APPLICATION = 'backend.asgi.application'

# Database

if TESTING:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
else:
    DATABASES = {
        'default': dj_database_url.config(
            default='sqlite:///' + str(BASE_DIR / 'db.sqlite3'),
            conn_max_age=600,
            conn_health_checks=True,
        )
    }

# Cache configuration
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SERIALIZER': 'django_redis.serializers.json.JSONSerializer',
        },
        'KEY_PREFIX': 'swm',
        'TIMEOUT': 300,
    }
}

# Session configuration
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# Channels configuration (WebSockets)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.getenv('REDIS_URL', 'redis://localhost:6379/0')],
            'capacity': 1500,
            'expiry': 10,
        },
    },
}

# Celery configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/1')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'default'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Custom user model
AUTH_USER_MODEL = 'users.User'

# Authentication backends
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'social_core.backends.google.GoogleOAuth2',
    'social_core.backends.microsoft.MicrosoftOAuth2',
    'django.contrib.auth.backends.ModelBackend',
]

# Axes configuration (brute force protection)
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_LOCKOUT_CALLABLE = 'users.utils.axes_lockout_response'
AXES_RESET_ON_SUCCESS = True

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

# Media files
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'
EXPORT_ROOT = BASE_DIR / 'exports'
(BASE_DIR / 'exports').mkdir(exist_ok=True)

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS settings
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000',
    ).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CSRF_TRUSTED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000',
    ).split(',')
    if origin.strip()
]

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
    'EXCEPTION_HANDLER': 'api.exceptions.custom_exception_handler',
}

# JWT configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_LIFETIME_DAYS', 7))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.getenv('JWT_SECRET_KEY', SECRET_KEY),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_OBTAIN_SERIALIZER': 'users.serializers.CustomTokenObtainPairSerializer',
}

# API Documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'Subscription Waste Manager API',
    'DESCRIPTION': 'API for tracking and optimizing software subscriptions',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': r'/api/v1',
}

# Social Auth settings
SOCIAL_AUTH_JSONFIELD_ENABLED = True
SOCIAL_AUTH_URL_NAMESPACE = 'social'

SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '')
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', '')
SOCIAL_AUTH_GOOGLE_OAUTH2_SCOPE = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
]

SOCIAL_AUTH_MICROSOFT_GRAPH_KEY = os.getenv('MICROSOFT_CLIENT_ID', '')
SOCIAL_AUTH_MICROSOFT_GRAPH_SECRET = os.getenv('MICROSOFT_CLIENT_SECRET', '')
SOCIAL_AUTH_MICROSOFT_GRAPH_SCOPE = ['openid', 'email', 'profile', 'User.Read']

SOCIAL_AUTH_PIPELINE = (
    'social_core.pipeline.social_auth.social_details',
    'social_core.pipeline.social_auth.social_uid',
    'social_core.pipeline.social_auth.auth_allowed',
    'social_core.pipeline.social_auth.social_user',
    'social_core.pipeline.user.get_username',
    'users.pipeline.get_or_create_user',
    'social_core.pipeline.social_auth.associate_user',
    'social_core.pipeline.social_auth.load_extra_data',
    'social_core.pipeline.user.user_details',
    'users.pipeline.save_organization_info',
    'users.pipeline.assign_default_role',
    'users.pipeline.check_sso_connection',
    'users.pipeline.create_audit_log',
    'users.pipeline.sync_google_workspace_users',
)

SOCIAL_AUTH_LOGIN_REDIRECT_URL = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard"
SOCIAL_AUTH_NEW_USER_REDIRECT_URL = SOCIAL_AUTH_LOGIN_REDIRECT_URL
LOGIN_REDIRECT_URL = SOCIAL_AUTH_LOGIN_REDIRECT_URL

# Integration OAuth (Google Workspace / Microsoft 365 connectors)
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', os.getenv('GOOGLE_OAUTH_CLIENT_ID', ''))
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', ''))
MICROSOFT_CLIENT_ID = os.getenv('MICROSOFT_CLIENT_ID', '')
MICROSOFT_CLIENT_SECRET = os.getenv('MICROSOFT_CLIENT_SECRET', '')
MICROSOFT_TENANT_ID = os.getenv('MICROSOFT_TENANT_ID', 'common')

# OpenAI settings
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')

# Stripe settings
STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY', '')
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PRICE_STARTER = os.getenv('STRIPE_PRICE_STARTER', '')
STRIPE_PRICE_PRO = os.getenv('STRIPE_PRICE_PRO', '')
STRIPE_PRICE_ENTERPRISE = os.getenv('STRIPE_PRICE_ENTERPRISE', '')

# Plaid settings
PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID', '')
PLAID_SECRET = os.getenv('PLAID_SECRET', '')
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')

# Slack settings
SLACK_CLIENT_ID = os.getenv('SLACK_CLIENT_ID', '')
SLACK_CLIENT_SECRET = os.getenv('SLACK_CLIENT_SECRET', '')
SLACK_SIGNING_SECRET = os.getenv('SLACK_SIGNING_SECRET', '')

# Encryption key for sensitive data (Fernet: url-safe base64-encoded 32-byte key)
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', '')

# Frontend URL
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Email configuration
# Prefer Anymail when ANYMAIL_BACKEND / ESP credentials are set; else Django SMTP/console.
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@swm.com')
SERVER_EMAIL = os.getenv('SERVER_EMAIL', DEFAULT_FROM_EMAIL)

ANYMAIL = {
    'SENDGRID_API_KEY': os.getenv('SENDGRID_API_KEY', ''),
    'MAILGUN_API_KEY': os.getenv('MAILGUN_API_KEY', ''),
    'MAILGUN_SENDER_DOMAIN': os.getenv('MAILGUN_SENDER_DOMAIN', ''),
}
if os.getenv('ANYMAIL_ESP', '').lower() == 'sendgrid' and ANYMAIL['SENDGRID_API_KEY']:
    EMAIL_BACKEND = 'anymail.backends.sendgrid.EmailBackend'
elif os.getenv('ANYMAIL_ESP', '').lower() == 'mailgun' and ANYMAIL['MAILGUN_API_KEY']:
    EMAIL_BACKEND = 'anymail.backends.mailgun.EmailBackend'

# Sentry (optional) — ignore empty / placeholder DSNs (e.g. blank scheme)
SENTRY_DSN = (os.getenv('SENTRY_DSN', '') or '').strip()
if SENTRY_DSN.startswith(('http://', 'https://')) and not TESTING:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        send_default_pii=False,
        environment=os.getenv('SENTRY_ENVIRONMENT', 'development' if DEBUG else 'production'),
    )

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'swm.log',
            'maxBytes': 1024 * 1024 * 5,  # 5 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'swm': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# Create logs directory
(BASE_DIR / 'logs').mkdir(exist_ok=True)
(BASE_DIR / 'static').mkdir(exist_ok=True)

# Security settings for production (skip during tests so HTTP clients work)
if not DEBUG and not TESTING:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    if not ENCRYPTION_KEY:
        raise ValueError(
            'ENCRYPTION_KEY is required when DJANGO_DEBUG=False. '
            'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    try:
        from cryptography.fernet import Fernet
        Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
    except Exception as exc:
        raise ValueError(
            'ENCRYPTION_KEY must be a valid Fernet key (url-safe base64-encoded 32 bytes).'
        ) from exc

    if EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend':
        import warnings
        warnings.warn(
            'EMAIL_BACKEND is still console in production. '
            'Set ANYMAIL_ESP=sendgrid|mailgun or EMAIL_BACKEND to an SMTP backend.',
            RuntimeWarning,
            stacklevel=1,
        )

if TESTING:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {}
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
    AXES_ENABLED = False
