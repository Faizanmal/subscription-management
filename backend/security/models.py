"""
Security models for Subscription Waste Manager
API keys, tokens, and security settings
"""

import uuid
import secrets
import hashlib
from django.db import models
from django.utils import timezone
from users.models import Organization, User


class APIKey(models.Model):
    """API keys for programmatic access"""
    
    class Scope(models.TextChoices):
        READ = 'read', 'Read Only'
        WRITE = 'write', 'Read/Write'
        ADMIN = 'admin', 'Admin Access'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='api_keys')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_api_keys')
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Key (hashed for storage, prefix for identification)
    key_prefix = models.CharField(max_length=8, unique=True)
    key_hash = models.CharField(max_length=64)  # SHA-256 hash
    
    scope = models.CharField(max_length=10, choices=Scope.choices, default=Scope.READ)
    
    # Permissions (fine-grained)
    allowed_endpoints = models.JSONField(default=list, blank=True)
    allowed_ips = models.JSONField(default=list, blank=True)
    
    # Rate limiting
    rate_limit_per_hour = models.IntegerField(default=1000)
    
    # Usage tracking
    last_used = models.DateTimeField(blank=True, null=True)
    total_requests = models.IntegerField(default=0)
    
    # Expiration
    expires_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'api_keys'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"
    
    @classmethod
    def generate_key(cls):
        """Generate a new API key"""
        key = secrets.token_urlsafe(32)
        prefix = key[:8]
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        return key, prefix, key_hash
    
    @classmethod
    def verify_key(cls, key):
        """Verify an API key and return the APIKey object if valid"""
        if not key or len(key) < 8:
            return None
        prefix = key[:8]
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        try:
            api_key = cls.objects.get(key_prefix=prefix, key_hash=key_hash, is_active=True)
            if api_key.expires_at and api_key.expires_at < timezone.now():
                return None
            return api_key
        except cls.DoesNotExist:
            return None
    
    def record_usage(self):
        """Record API key usage"""
        self.last_used = timezone.now()
        self.total_requests += 1
        self.save(update_fields=['last_used', 'total_requests'])


class SecuritySetting(models.Model):
    """Organization security settings"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name='security_settings')
    
    # Password policy
    min_password_length = models.IntegerField(default=10)
    require_uppercase = models.BooleanField(default=True)
    require_lowercase = models.BooleanField(default=True)
    require_numbers = models.BooleanField(default=True)
    require_special_chars = models.BooleanField(default=True)
    password_expiry_days = models.IntegerField(default=90)
    
    # MFA settings
    require_mfa = models.BooleanField(default=False)
    mfa_methods = models.JSONField(default=list)  # ['totp', 'sms', 'email']
    
    # Session settings
    session_timeout_minutes = models.IntegerField(default=60)
    max_concurrent_sessions = models.IntegerField(default=5)
    
    # Login settings
    max_login_attempts = models.IntegerField(default=5)
    lockout_duration_minutes = models.IntegerField(default=15)
    
    # IP restrictions
    allowed_ips = models.JSONField(default=list, blank=True)
    blocked_ips = models.JSONField(default=list, blank=True)
    
    # Audit settings
    audit_log_retention_days = models.IntegerField(default=365)
    log_successful_logins = models.BooleanField(default=True)
    log_failed_logins = models.BooleanField(default=True)
    log_data_access = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'security_settings'


class MFADevice(models.Model):
    """Multi-factor authentication devices"""
    
    class DeviceType(models.TextChoices):
        TOTP = 'totp', 'Authenticator App (TOTP)'
        SMS = 'sms', 'SMS'
        EMAIL = 'email', 'Email'
        WEBAUTHN = 'webauthn', 'Security Key (WebAuthn)'
        BACKUP = 'backup', 'Backup Codes'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mfa_devices')
    
    device_type = models.CharField(max_length=10, choices=DeviceType.choices)
    name = models.CharField(max_length=255)
    
    # Device-specific data (encrypted)
    secret = models.CharField(max_length=255, blank=True)  # TOTP secret
    phone_number = models.CharField(max_length=20, blank=True)  # SMS
    email = models.EmailField(blank=True)  # Email
    credential_id = models.TextField(blank=True)  # WebAuthn
    backup_codes = models.JSONField(default=list, blank=True)  # Backup codes (hashed)
    
    is_primary = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    last_used = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mfa_devices'
        ordering = ['-is_primary', '-created_at']


class LoginAttempt(models.Model):
    """Record of login attempts"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    email = models.EmailField()
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='login_attempts')
    
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    
    successful = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=255, blank=True)
    
    mfa_required = models.BooleanField(default=False)
    mfa_passed = models.BooleanField(default=False)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'login_attempts'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['email', 'timestamp']),
            models.Index(fields=['ip_address', 'timestamp']),
        ]


class Session(models.Model):
    """User session tracking"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    
    session_key = models.CharField(max_length=255, unique=True)
    
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    device_info = models.JSONField(default=dict, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        db_table = 'sessions'
        ordering = ['-last_activity']
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


class DataAccessLog(models.Model):
    """Log of sensitive data access"""
    
    class AccessType(models.TextChoices):
        VIEW = 'view', 'View'
        EXPORT = 'export', 'Export'
        DOWNLOAD = 'download', 'Download'
        SHARE = 'share', 'Share'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='data_access_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='data_access_logs')
    
    access_type = models.CharField(max_length=10, choices=AccessType.choices)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=255)
    
    details = models.JSONField(default=dict, blank=True)
    
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'data_access_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['organization', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
        ]
