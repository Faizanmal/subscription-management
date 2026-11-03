"""
Celery configuration for Subscription Waste Manager
"""

import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('swm')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Beat schedule must use real @shared_task names (module.function).
app.conf.beat_schedule = {
    'discover-subscriptions': {
        'task': 'services.tasks.discover_subscriptions',
        'schedule': crontab(minute=0, hour='*/6'),
    },
    'aggregate-usage-metrics': {
        'task': 'services.tasks.aggregate_usage_metrics',
        'schedule': crontab(minute=15),
    },
    'check-renewal-alerts': {
        'task': 'services.tasks.check_renewal_alerts',
        'schedule': crontab(minute=0, hour=9),
    },
    'generate-ai-recommendations': {
        'task': 'services.tasks.generate_ai_recommendations',
        'schedule': crontab(minute=0, hour=0),
    },
    'detect-redundancies': {
        'task': 'services.tasks.detect_redundancies',
        'schedule': crontab(minute=0, hour=2, day_of_week=0),
    },
    'generate-cost-report': {
        'task': 'services.tasks.generate_cost_report',
        'schedule': crontab(minute=0, hour='*/4'),
    },
    'sync-all-integrations': {
        'task': 'integrations.tasks.sync_all_integrations',
        'schedule': crontab(minute=30, hour='*/2'),
    },
    'run-scheduled-backups': {
        'task': 'backups.tasks.run_scheduled_backups',
        'schedule': crontab(minute=0, hour=2),
    },
    'cleanup-expired-invitations': {
        'task': 'users.tasks.cleanup_expired_invitations',
        'schedule': crontab(minute=0, hour=4),
    },
    'cleanup-old-notifications': {
        'task': 'users.tasks.cleanup_old_notifications',
        'schedule': crontab(minute=20, hour=4, day_of_week=0),
    },
    'cleanup-expired-sessions': {
        'task': 'security.tasks.cleanup_expired_sessions',
        'schedule': crontab(minute=40, hour=4),
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
