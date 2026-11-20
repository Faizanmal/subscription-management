"""Durable reminders for renewal and the earlier cancellation deadline."""
import logging

from django.db import transaction
from django.utils import timezone

from services.models import Subscription, RenewalReminder, Alert
from services.money import money
from users.models import Notification, User

logger = logging.getLogger('swm')


def create_due_reminders(today=None):
    today = today or timezone.localdate()
    created = 0
    for sub in Subscription.objects.filter(status='active', renewal_date__gte=today).select_related('organization', 'owner'):
        dates = [('renewal', sub.renewal_date)]
        if sub.auto_renew:
            dates.append(('cancellation', sub.cancel_by_date))
        for kind, deadline in dates:
            remaining = (deadline - today).days
            if remaining > 90:
                continue
            threshold = -1 if remaining < 0 else next((t for t in (0, 1, 7, 14, 30, 60, 90) if remaining <= t), 90)
            with transaction.atomic():
                _, is_new = RenewalReminder.objects.get_or_create(subscription=sub, deadline=deadline, kind=kind, threshold=threshold)
                if not is_new:
                    continue
                title = (f'Cancellation deadline {"passed" if remaining < 0 else "in " + str(remaining) + " days"}'
                         if kind == 'cancellation' else f'Renewal in {remaining} days')
                message = (f'{sub.name}: {"cancel by" if kind == "cancellation" else "renews on"} {deadline.isoformat()}. '
                           f'Renewal date: {sub.renewal_date.isoformat()}; notice: {sub.cancellation_notice_days} days. '
                           f'Monthly equivalent: {sub.currency} {money(sub.monthly_cost)}. '
                           'Recording a decision here does not cancel the vendor contract.')
                alert = Alert.objects.create(organization=sub.organization, subscription=sub,
                    alert_type='contract_expiry' if kind == 'cancellation' else 'renewal',
                    severity='critical' if remaining <= 1 else ('high' if remaining <= 14 else 'medium'),
                    title=title, message=message, action_required=True,
                    action_url=f'/subscriptions/{sub.pk}', currency=sub.currency,
                    trigger_date=deadline, metadata={'kind': kind, 'deadline': deadline.isoformat(), 'threshold': threshold})
                recipients = [sub.owner] if sub.owner and sub.owner.is_active else list(User.objects.filter(
                    organization=sub.organization, is_active=True, role__type='admin'))
                for user in recipients:
                    Notification.objects.create(user=user, organization=sub.organization, type='renewal',
                        priority='high' if remaining <= 14 else 'medium', title=title, message=message,
                        action_url=alert.action_url, metadata={'renewal_reminder': True})
                created += 1
    # Stored notifications act as an outbox if the broker was unavailable previously.
    from users.tasks import send_notification_email
    for notification in Notification.objects.filter(type='renewal', metadata__renewal_reminder=True):
        if notification.metadata.get('email_sent_at') or notification.metadata.get('email_skipped'):
            continue
        try:
            send_notification_email.delay(str(notification.pk))
        except Exception:
            logger.warning('Renewal email remains queued for the next reminder pass.')
    return created
