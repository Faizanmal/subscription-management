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

# Celery beat schedule for periodic tasks
app.conf.beat_schedule = {
    # Subscription discovery - runs every 6 hours
    'discover-subscriptions': {
        'task': 'services.tasks.discover_subscriptions_task',
        'schedule': crontab(hour='*/6'),
    },
    # Usage tracking - runs every hour
    'track-usage': {
        'task': 'services.tasks.track_usage_task',
        'schedule': crontab(minute=0),
    },
    # Renewal alerts - runs daily at 9 AM
    'send-renewal-alerts': {
        'task': 'services.tasks.send_renewal_alerts_task',
        'schedule': crontab(hour=9, minute=0),
    },
    # AI recommendations - runs daily at midnight
    'generate-recommendations': {
        'task': 'services.tasks.generate_recommendations_task',
        'schedule': crontab(hour=0, minute=0),
    },
    # Redundancy detection - runs weekly
    'detect-redundancies': {
        'task': 'services.tasks.detect_redundancies_task',
        'schedule': crontab(day_of_week=0, hour=2, minute=0),
    },
    # Cost analytics update - runs every 4 hours
    'update-cost-analytics': {
        'task': 'services.tasks.update_cost_analytics_task',
        'schedule': crontab(hour='*/4'),
    },
    # Cleanup old data - runs weekly
    'cleanup-old-data': {
        'task': 'services.tasks.cleanup_old_data_task',
        'schedule': crontab(day_of_week=0, hour=3, minute=0),
    },
    # Sync integrations - runs every 2 hours
    'sync-integrations': {
        'task': 'integrations.tasks.sync_all_integrations_task',
        'schedule': crontab(hour='*/2'),
    },
    # Backup database - runs daily at 2 AM
    'backup-database': {
        'task': 'backups.tasks.backup_database_task',
        'schedule': crontab(hour=2, minute=0),
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
