"""
User models for Subscription Waste Manager
Includes custom User model, Organizations, Teams, and Roles
"""

import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from django.utils.timezone import now as _timezone_now


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication"""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


class Organization(models.Model):
    """
    Organization model - represents a company/business using SWM
    Each organization has its own subscriptions, users, and settings
    """
    
    class PlanType(models.TextChoices):
        STARTER = 'starter', 'Starter'
        PRO = 'pro', 'Pro'
        ENTERPRISE = 'enterprise', 'Enterprise'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    domain = models.CharField(max_length=255, blank=True, null=True, help_text="Primary email domain for auto-joining")
    logo = models.ImageField(upload_to='org_logos/', blank=True, null=True)
    
    # Billing & Plan
    plan = models.CharField(max_length=20, choices=PlanType.choices, default=PlanType.STARTER)
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    trial_ends_at = models.DateTimeField(blank=True, null=True)
    
    # Currency settings
    default_currency = models.CharField(max_length=3, default='USD')
    
    # Settings
    settings = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'organizations'
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    @property
    def is_on_trial(self):
        if self.trial_ends_at:
            return timezone.now() < self.trial_ends_at
        return False
    
    @property
    def is_enterprise(self):
        return self.plan == self.PlanType.ENTERPRISE


class Department(models.Model):
    """Department within an organization"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True, null=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    budget_period = models.CharField(max_length=20, default='monthly')
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_departments')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'departments'
        unique_together = ['organization', 'name']
        ordering = ['name']
    
    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class Team(models.Model):
    """Team within a department"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='teams')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='teams')
    name = models.CharField(max_length=255)
    budget = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'teams'
        unique_together = ['organization', 'name']
        ordering = ['name']
    
    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class Role(models.Model):
    """Custom roles with permissions"""
    
    class RoleType(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        FINANCE = 'finance', 'Finance/Procurement'
        DEPARTMENT_LEAD = 'department_lead', 'Department Lead'
        TEAM_LEAD = 'team_lead', 'Team Lead'
        MEMBER = 'member', 'Member'
        VIEWER = 'viewer', 'Viewer'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='roles', null=True, blank=True)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=RoleType.choices, default=RoleType.MEMBER)
    description = models.TextField(blank=True)
    
    # Permissions
    permissions = models.JSONField(default=dict, blank=True)
    is_system_role = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'roles'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model with email authentication"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    job_title = models.CharField(max_length=255, blank=True, null=True)
    
    # Organization & Team
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    
    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    # Preferences
    timezone = models.CharField(max_length=50, default='UTC')
    language = models.CharField(max_length=10, default='en')
    notification_preferences = models.JSONField(default=dict, blank=True)
    
    # Tracking
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    last_activity = models.DateTimeField(blank=True, null=True)
    
    # Timestamps
    date_joined = models.DateTimeField(default=_timezone_now)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
        ordering = ['email']
    
    def __str__(self):
        return self.email
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email
    
    @property
    def is_admin(self):
        return self.role and self.role.type == Role.RoleType.ADMIN
    
    @property
    def is_finance(self):
        return self.role and self.role.type in [Role.RoleType.ADMIN, Role.RoleType.FINANCE]


class UserInvitation(models.Model):
    """User invitation to join an organization"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        EXPIRED = 'expired', 'Expired'
        CANCELLED = 'cancelled', 'Cancelled'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True)
    
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sent_invitations')
    token = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_invitations'
        ordering = ['-created_at']
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


class AuditLog(models.Model):
    """Audit log for tracking user actions"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=255, blank=True, null=True)
    
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'created_at']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.action} - {self.resource_type}"


class Notification(models.Model):
    """User notifications"""
    
    class NotificationType(models.TextChoices):
        ALERT = 'alert', 'Alert'
        RENEWAL = 'renewal', 'Renewal'
        RECOMMENDATION = 'recommendation', 'Recommendation'
        WORKFLOW = 'workflow', 'Workflow'
        SYSTEM = 'system', 'System'
    
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='notifications')
    
    type = models.CharField(max_length=20, choices=NotificationType.choices)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    title = models.CharField(max_length=255)
    message = models.TextField()
    action_url = models.URLField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.title}"
