"""
WebSocket consumers for real-time updates
"""

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
import logging

logger = logging.getLogger('swm')


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time notifications"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        # Get user from scope (set by AuthMiddlewareStack)
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        
        # Create personal notification channel
        self.user_group = f"user_{self.user.id}"
        
        # Join user's notification group
        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )
        
        # Also join organization group
        if self.user.organization_id:
            self.org_group = f"org_{self.user.organization_id}"
            await self.channel_layer.group_add(
                self.org_group,
                self.channel_name
            )
        
        await self.accept()
        
        # Send initial unread count
        unread_count = await self.get_unread_count()
        await self.send_json({
            'type': 'notification.count',
            'count': unread_count
        })
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(
                self.user_group,
                self.channel_name
            )
        
        if hasattr(self, 'org_group'):
            await self.channel_layer.group_discard(
                self.org_group,
                self.channel_name
            )
    
    async def receive_json(self, content):
        """Handle incoming messages"""
        message_type = content.get('type')
        
        if message_type == 'mark_read':
            notification_id = content.get('notification_id')
            await self.mark_notification_read(notification_id)
            
            unread_count = await self.get_unread_count()
            await self.send_json({
                'type': 'notification.count',
                'count': unread_count
            })
        
        elif message_type == 'mark_all_read':
            await self.mark_all_read()
            await self.send_json({
                'type': 'notification.count',
                'count': 0
            })
    
    async def notification_new(self, event):
        """Handle new notification event"""
        await self.send_json({
            'type': 'notification.new',
            'notification': event['notification']
        })
    
    async def notification_count(self, event):
        """Handle notification count update"""
        await self.send_json({
            'type': 'notification.count',
            'count': event['count']
        })
    
    @database_sync_to_async
    def get_unread_count(self):
        from users.models import Notification
        return Notification.objects.filter(
            user=self.user,
            is_read=False
        ).count()
    
    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        from users.models import Notification
        Notification.objects.filter(
            id=notification_id,
            user=self.user
        ).update(is_read=True, read_at=timezone.now())
    
    @database_sync_to_async
    def mark_all_read(self):
        from users.models import Notification
        Notification.objects.filter(
            user=self.user,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())


class DashboardConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time dashboard updates"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        
        if not self.user.organization_id:
            await self.close()
            return
        
        self.org_group = f"dashboard_{self.user.organization_id}"
        
        await self.channel_layer.group_add(
            self.org_group,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'org_group'):
            await self.channel_layer.group_discard(
                self.org_group,
                self.channel_name
            )
    
    async def receive_json(self, content):
        """Handle incoming messages"""
        message_type = content.get('type')
        
        if message_type == 'refresh':
            # Send latest dashboard data
            data = await self.get_dashboard_data()
            await self.send_json({
                'type': 'dashboard.update',
                'data': data
            })
    
    async def dashboard_update(self, event):
        """Handle dashboard update event"""
        await self.send_json({
            'type': 'dashboard.update',
            'data': event['data']
        })
    
    async def metric_update(self, event):
        """Handle metric update event"""
        await self.send_json({
            'type': 'metric.update',
            'metric': event['metric'],
            'value': event['value']
        })
    
    @database_sync_to_async
    def get_dashboard_data(self):
        from services.models import Subscription
        from django.db.models import Sum
        
        org = self.user.organization
        
        subscriptions = Subscription.objects.filter(
            organization=org,
            status='active'
        )
        
        return {
            'total_subscriptions': subscriptions.count(),
            'total_spend': float(subscriptions.aggregate(
                total=Sum('monthly_cost')
            )['total'] or 0),
            'avg_utilization': 75,  # Placeholder
        }


class AlertConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time alerts"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        
        if not self.user.organization_id:
            await self.close()
            return
        
        self.org_group = f"alerts_{self.user.organization_id}"
        
        await self.channel_layer.group_add(
            self.org_group,
            self.channel_name
        )
        
        await self.accept()
        
        # Send current alert count
        alert_count = await self.get_active_alert_count()
        await self.send_json({
            'type': 'alert.count',
            'count': alert_count
        })
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'org_group'):
            await self.channel_layer.group_discard(
                self.org_group,
                self.channel_name
            )
    
    async def alert_new(self, event):
        """Handle new alert event"""
        await self.send_json({
            'type': 'alert.new',
            'alert': event['alert']
        })
    
    async def alert_resolved(self, event):
        """Handle alert resolved event"""
        await self.send_json({
            'type': 'alert.resolved',
            'alert_id': event['alert_id']
        })
    
    @database_sync_to_async
    def get_active_alert_count(self):
        from services.models import Alert
        return Alert.objects.filter(
            subscription__organization=self.user.organization,
            status='active'
        ).count()


class IntegrationConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for integration sync status"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        
        if not self.user.organization_id:
            await self.close()
            return
        
        self.org_group = f"integrations_{self.user.organization_id}"
        
        await self.channel_layer.group_add(
            self.org_group,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'org_group'):
            await self.channel_layer.group_discard(
                self.org_group,
                self.channel_name
            )
    
    async def sync_started(self, event):
        """Handle sync started event"""
        await self.send_json({
            'type': 'sync.started',
            'integration_id': event['integration_id'],
            'integration_name': event['integration_name']
        })
    
    async def sync_progress(self, event):
        """Handle sync progress event"""
        await self.send_json({
            'type': 'sync.progress',
            'integration_id': event['integration_id'],
            'progress': event['progress'],
            'message': event.get('message', '')
        })
    
    async def sync_completed(self, event):
        """Handle sync completed event"""
        await self.send_json({
            'type': 'sync.completed',
            'integration_id': event['integration_id'],
            'items_synced': event['items_synced']
        })
    
    async def sync_failed(self, event):
        """Handle sync failed event"""
        await self.send_json({
            'type': 'sync.failed',
            'integration_id': event['integration_id'],
            'error': event['error']
        })


# Utility functions for sending WebSocket messages from tasks

async def send_notification(user_id, notification_data):
    """Send notification to user via WebSocket"""
    from channels.layers import get_channel_layer
    
    channel_layer = get_channel_layer()
    
    await channel_layer.group_send(
        f"user_{user_id}",
        {
            'type': 'notification.new',
            'notification': notification_data
        }
    )


async def send_dashboard_update(org_id, data):
    """Send dashboard update to organization"""
    from channels.layers import get_channel_layer
    
    channel_layer = get_channel_layer()
    
    await channel_layer.group_send(
        f"dashboard_{org_id}",
        {
            'type': 'dashboard.update',
            'data': data
        }
    )


async def send_alert(org_id, alert_data):
    """Send alert to organization"""
    from channels.layers import get_channel_layer
    
    channel_layer = get_channel_layer()
    
    await channel_layer.group_send(
        f"alerts_{org_id}",
        {
            'type': 'alert.new',
            'alert': alert_data
        }
    )


async def send_sync_status(org_id, status_type, data):
    """Send integration sync status update"""
    from channels.layers import get_channel_layer
    
    channel_layer = get_channel_layer()
    
    await channel_layer.group_send(
        f"integrations_{org_id}",
        {
            'type': status_type,
            **data
        }
    )


# Synchronous wrappers for use in Celery tasks

def sync_send_notification(user_id, notification_data):
    """Synchronous wrapper for send_notification"""
    import asyncio
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(send_notification(user_id, notification_data))
    finally:
        loop.close()


def sync_send_dashboard_update(org_id, data):
    """Synchronous wrapper for send_dashboard_update"""
    import asyncio
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(send_dashboard_update(org_id, data))
    finally:
        loop.close()


def sync_send_alert(org_id, alert_data):
    """Synchronous wrapper for send_alert"""
    import asyncio
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(send_alert(org_id, alert_data))
    finally:
        loop.close()
