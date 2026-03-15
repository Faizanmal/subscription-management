"""
Celery tasks for users app
"""

from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger('swm')


@shared_task(bind=True, max_retries=3)
def send_invitation_email(self, invitation_id):
    """Send invitation email to new user"""
    from users.models import UserInvitation
    
    try:
        invitation = UserInvitation.objects.get(id=invitation_id)
        
        invite_url = f"{settings.FRONTEND_URL}/invite/accept?token={invitation.token}"
        
        subject = f"You've been invited to join {invitation.organization.name} on SWM"
        message = f"""
Hello,

{invitation.invited_by.get_full_name()} has invited you to join {invitation.organization.name} on Subscription Waste Manager.

Click the link below to accept the invitation and create your account:
{invite_url}

This invitation will expire on {invitation.expires_at.strftime('%B %d, %Y')}.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
Subscription Waste Manager Team
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [invitation.email],
            fail_silently=False
        )
        
        logger.info(f"Invitation email sent to {invitation.email}")
        
    except UserInvitation.DoesNotExist:
        logger.error(f"Invitation {invitation_id} not found")
    except Exception as e:
        logger.error(f"Failed to send invitation email: {e}")
        self.retry(countdown=60 * (2 ** self.request.retries))


@shared_task
def cleanup_expired_invitations():
    """Clean up expired invitations"""
    from users.models import UserInvitation
    
    expired = UserInvitation.objects.filter(
        expires_at__lt=timezone.now(),
        status='pending'
    )
    
    count = expired.update(status='expired')
    logger.info(f"Marked {count} invitations as expired")


@shared_task
def send_notification_email(notification_id):
    """Send notification via email"""
    from users.models import Notification
    
    try:
        notification = Notification.objects.select_related('user').get(id=notification_id)
        
        if not notification.user.email_notifications_enabled:
            return
        
        subject = f"[SWM] {notification.title}"
        
        send_mail(
            subject,
            notification.message,
            settings.DEFAULT_FROM_EMAIL,
            [notification.user.email],
            fail_silently=False
        )
        
        notification.email_sent = True
        notification.save()
        
    except Notification.DoesNotExist:
        logger.error(f"Notification {notification_id} not found")
    except Exception as e:
        logger.error(f"Failed to send notification email: {e}")


@shared_task
def send_weekly_digest():
    """Send weekly digest emails to all users"""
    from users.models import User, Notification
    
    users = User.objects.filter(
        is_active=True,
        email_notifications_enabled=True,
        organization__isnull=False
    )
    
    for user in users:
        # Get unread notifications from past week
        week_ago = timezone.now() - timezone.timedelta(days=7)
        notifications = Notification.objects.filter(
            user=user,
            created_at__gte=week_ago,
            is_read=False
        )
        
        if notifications.count() == 0:
            continue
        
        # Build digest content
        subject = f"[SWM] Your Weekly Digest - {notifications.count()} unread notifications"
        
        message_parts = ["Here's what you missed this week:\n"]
        for notif in notifications[:10]:
            message_parts.append(f"• {notif.title}")
        
        if notifications.count() > 10:
            message_parts.append(f"\n...and {notifications.count() - 10} more")
        
        message_parts.append(f"\nView all notifications: {settings.FRONTEND_URL}/notifications")
        
        send_mail(
            subject,
            '\n'.join(message_parts),
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True
        )
    
    logger.info(f"Sent weekly digest to {users.count()} users")


@shared_task
def cleanup_old_notifications():
    """Clean up old notifications"""
    from users.models import Notification
    
    # Delete read notifications older than 30 days
    threshold = timezone.now() - timezone.timedelta(days=30)
    
    deleted, _ = Notification.objects.filter(
        is_read=True,
        created_at__lt=threshold
    ).delete()
    
    logger.info(f"Deleted {deleted} old notifications")


@shared_task
def cleanup_old_audit_logs():
    """Clean up old audit logs based on retention policy"""
    from users.models import AuditLog, Organization
    
    for org in Organization.objects.all():
        retention_days = getattr(org, 'retention_audit_days', 365)
        threshold = timezone.now() - timezone.timedelta(days=retention_days)
        
        deleted, _ = AuditLog.objects.filter(
            organization=org,
            created_at__lt=threshold
        ).delete()
        
        if deleted > 0:
            logger.info(f"Deleted {deleted} audit logs for org {org.name}")


@shared_task
def sync_user_from_sso(user_id):
    """Sync user details from SSO provider"""
    from users.models import User
    from integrations.models import SSOConnection
    
    try:
        user = User.objects.get(id=user_id)
        
        if not user.organization:
            return
        
        email_domain = user.email.split('@')[1] if '@' in user.email else None
        if not email_domain:
            return
        
        # Find SSO connection
        try:
            sso = SSOConnection.objects.get(
                organization=user.organization,
                domain=email_domain,
                is_active=True
            )
            
            # TODO: Implement SSO provider-specific user sync
            logger.info(f"Would sync user {user.email} from {sso.provider}")
            
        except SSOConnection.DoesNotExist:
            pass
        
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")


@shared_task
def generate_organization_report(org_id):
    """Generate monthly organization report"""
    from users.models import Organization, User
    from services.models import Subscription, Recommendation, SavingsReport
    
    try:
        org = Organization.objects.get(id=org_id)
        
        now = timezone.now()
        month_ago = now - timezone.timedelta(days=30)
        
        # Gather stats
        total_users = User.objects.filter(organization=org, is_active=True).count()
        new_users = User.objects.filter(
            organization=org,
            created_at__gte=month_ago
        ).count()
        
        total_subscriptions = Subscription.objects.filter(
            organization=org,
            status='active'
        ).count()
        
        # Create savings report
        from django.db.models import Sum
        
        recommendations = Recommendation.objects.filter(
            subscription__organization=org,
            status='implemented',
            implemented_at__gte=month_ago
        )
        
        total_savings = recommendations.aggregate(
            sum=Sum('estimated_savings')
        )['sum'] or 0
        
        SavingsReport.objects.create(
            organization=org,
            period_start=month_ago.date(),
            period_end=now.date(),
            total_subscriptions=total_subscriptions,
            recommendations_implemented=recommendations.count(),
            projected_annual_savings=total_savings * 12,
            report_data={
                'total_users': total_users,
                'new_users': new_users
            }
        )
        
        logger.info(f"Generated monthly report for {org.name}")
        
    except Organization.DoesNotExist:
        logger.error(f"Organization {org_id} not found")
