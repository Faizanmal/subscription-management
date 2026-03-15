"""
Celery tasks for security app
"""

from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
import logging
import random
import string

logger = logging.getLogger('swm')


@shared_task
def send_mfa_code(device_id):
    """Send MFA verification code via SMS or email"""
    from security.models import MFADevice
    from django.core.cache import cache
    
    try:
        device = MFADevice.objects.select_related('user').get(id=device_id)
        
        # Generate 6-digit code
        code = ''.join(random.choices(string.digits, k=6))
        
        # Store code in cache (5 minute expiry)
        cache.set(f'mfa_code_{device.id}', code, 300)
        
        if device.type == 'sms':
            # Send via SMS (using Twilio or similar)
            send_sms_code(device.phone_number, code)
        elif device.type == 'email':
            # Send via email
            send_mail(
                'Your verification code',
                f'Your verification code is: {code}\n\nThis code will expire in 5 minutes.',
                settings.DEFAULT_FROM_EMAIL,
                [device.user.email],
                fail_silently=False
            )
        
        logger.info(f"MFA code sent for device {device_id}")
        
    except MFADevice.DoesNotExist:
        logger.error(f"MFA device {device_id} not found")
    except Exception as e:
        logger.error(f"Failed to send MFA code: {e}")


def send_sms_code(phone_number, code):
    """Send verification code via SMS"""
    # This would use Twilio or similar service
    # For now, just log it
    logger.info(f"Would send SMS to {phone_number}: Your code is {code}")


@shared_task
def send_password_reset_email(user_id, token):
    """Send password reset email"""
    from users.models import User
    
    try:
        user = User.objects.get(id=user_id)
        
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={user_id}:{token}"
        
        subject = "Reset your password"
        message = f"""
Hello {user.first_name or 'there'},

You requested to reset your password for Subscription Waste Manager.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

Best regards,
Subscription Waste Manager Team
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False
        )
        
        logger.info(f"Password reset email sent to {user.email}")
        
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")


@shared_task
def cleanup_expired_sessions():
    """Clean up expired sessions"""
    from security.models import Session
    
    now = timezone.now()
    
    # Mark expired sessions as inactive
    expired = Session.objects.filter(
        is_active=True,
        expires_at__lt=now
    )
    
    count = expired.update(is_active=False)
    logger.info(f"Cleaned up {count} expired sessions")


@shared_task
def cleanup_old_login_attempts():
    """Clean up old login attempt records"""
    from security.models import LoginAttempt
    
    # Keep 90 days of login attempts
    threshold = timezone.now() - timezone.timedelta(days=90)
    
    deleted, _ = LoginAttempt.objects.filter(
        created_at__lt=threshold
    ).delete()
    
    if deleted > 0:
        logger.info(f"Deleted {deleted} old login attempts")


@shared_task
def cleanup_old_access_logs():
    """Clean up old data access logs based on retention"""
    from security.models import DataAccessLog
    from users.models import Organization
    
    for org in Organization.objects.all():
        retention_days = getattr(org, 'retention_audit_days', 365)
        threshold = timezone.now() - timezone.timedelta(days=retention_days)
        
        deleted, _ = DataAccessLog.objects.filter(
            user__organization=org,
            created_at__lt=threshold
        ).delete()
        
        if deleted > 0:
            logger.info(f"Deleted {deleted} access logs for {org.name}")


@shared_task
def detect_suspicious_activity():
    """Detect and alert on suspicious login activity"""
    from security.models import LoginAttempt, Session
    from users.models import User, Notification
    
    now = timezone.now()
    last_hour = now - timezone.timedelta(hours=1)
    
    # Find users with multiple failed logins
    from django.db.models import Count
    
    suspicious_users = LoginAttempt.objects.filter(
        created_at__gte=last_hour,
        success=False
    ).values('email').annotate(
        count=Count('id')
    ).filter(count__gte=5)
    
    for item in suspicious_users:
        email = item['email']
        count = item['count']
        
        try:
            user = User.objects.get(email=email)
            
            # Check if we already notified
            existing = Notification.objects.filter(
                user=user,
                type='security',
                created_at__gte=last_hour
            ).exists()
            
            if not existing:
                Notification.objects.create(
                    user=user,
                    type='security',
                    title='Suspicious login activity detected',
                    message=f'There have been {count} failed login attempts to your account in the last hour.',
                    action_url='/settings/security'
                )
                
                # Also notify org admins
                if user.organization:
                    from users.models import Role
                    admins = User.objects.filter(
                        organization=user.organization,
                        role__type=Role.RoleType.ADMIN
                    )
                    
                    for admin in admins:
                        Notification.objects.create(
                            user=admin,
                            type='security',
                            title='Suspicious activity alert',
                            message=f'Multiple failed login attempts detected for {user.email}',
                            action_url='/admin/security'
                        )
                
        except User.DoesNotExist:
            # Could be brute force on non-existent account
            logger.warning(f"Multiple failed logins for unknown email: {email}")
    
    # Check for logins from new locations
    new_sessions = Session.objects.filter(
        created_at__gte=last_hour,
        is_active=True
    ).select_related('user')
    
    for session in new_sessions:
        # Check if user has sessions from different locations
        other_locations = Session.objects.filter(
            user=session.user,
            is_active=True
        ).exclude(id=session.id).values_list('location', flat=True)
        
        if session.location and other_locations:
            # Simplified check - in production would use IP geolocation
            if session.location not in list(other_locations):
                Notification.objects.create(
                    user=session.user,
                    type='security',
                    title='New login location detected',
                    message=f'A new login was detected from {session.location}. If this wasn\'t you, please secure your account.',
                    action_url='/settings/security'
                )


@shared_task
def expire_api_keys():
    """Deactivate expired API keys"""
    from security.models import APIKey
    
    now = timezone.now()
    
    expired = APIKey.objects.filter(
        is_active=True,
        expires_at__lt=now
    )
    
    count = expired.update(is_active=False)
    
    if count > 0:
        logger.info(f"Deactivated {count} expired API keys")


@shared_task
def generate_security_report():
    """Generate weekly security report for admins"""
    from security.models import LoginAttempt, Session, APIKey, DataAccessLog
    from users.models import User, Organization, Notification, Role
    
    now = timezone.now()
    week_ago = now - timezone.timedelta(days=7)
    
    for org in Organization.objects.all():
        # Gather stats
        stats = {
            'total_logins': LoginAttempt.objects.filter(
                user__organization=org,
                created_at__gte=week_ago,
                success=True
            ).count(),
            'failed_logins': LoginAttempt.objects.filter(
                user__organization=org,
                created_at__gte=week_ago,
                success=False
            ).count(),
            'active_sessions': Session.objects.filter(
                user__organization=org,
                is_active=True
            ).count(),
            'api_keys': APIKey.objects.filter(
                organization=org,
                is_active=True
            ).count(),
            'data_exports': DataAccessLog.objects.filter(
                user__organization=org,
                action='export',
                created_at__gte=week_ago
            ).count()
        }
        
        # Notify admins
        admins = User.objects.filter(
            organization=org,
            role__type=Role.RoleType.ADMIN
        )
        
        message = f"""
Weekly Security Summary:
- Successful logins: {stats['total_logins']}
- Failed login attempts: {stats['failed_logins']}
- Active sessions: {stats['active_sessions']}
- Active API keys: {stats['api_keys']}
- Data exports: {stats['data_exports']}
        """
        
        for admin in admins:
            Notification.objects.create(
                user=admin,
                type='security',
                title='Weekly Security Report',
                message=message,
                action_url='/admin/security'
            )
    
    logger.info("Generated weekly security reports")


@shared_task
def rotate_encryption_keys():
    """Placeholder for key rotation (would be more complex in production)"""
    logger.info("Key rotation check completed")


@shared_task
def check_password_expiry():
    """Check for users with expiring passwords"""
    from security.models import SecuritySetting
    from users.models import User, Notification
    
    for security_setting in SecuritySetting.objects.filter(password_expiry_days__gt=0):
        org = security_setting.organization
        expiry_threshold = timezone.now() - timezone.timedelta(days=security_setting.password_expiry_days - 7)
        
        # Find users who need to change password soon
        users = User.objects.filter(
            organization=org,
            is_active=True,
            password_changed_at__lt=expiry_threshold
        )
        
        for user in users:
            days_left = (user.password_changed_at + timezone.timedelta(days=security_setting.password_expiry_days) - timezone.now()).days
            
            if days_left > 0:
                # Check if we already notified today
                existing = Notification.objects.filter(
                    user=user,
                    type='security',
                    title__contains='password expires',
                    created_at__date=timezone.now().date()
                ).exists()
                
                if not existing:
                    Notification.objects.create(
                        user=user,
                        type='security',
                        title=f'Your password expires in {days_left} days',
                        message='Please change your password before it expires.',
                        action_url='/settings/security'
                    )
