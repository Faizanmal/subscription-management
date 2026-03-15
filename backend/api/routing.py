"""
WebSocket URL routing
"""

from django.urls import re_path
from api.consumers import (
    NotificationConsumer,
    DashboardConsumer,
    AlertConsumer,
    IntegrationConsumer
)

websocket_urlpatterns = [
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
    re_path(r'ws/dashboard/$', DashboardConsumer.as_asgi()),
    re_path(r'ws/alerts/$', AlertConsumer.as_asgi()),
    re_path(r'ws/integrations/$', IntegrationConsumer.as_asgi()),
]
