"""
ASGI config for Subscription Waste Manager project.
Supports HTTP and WebSocket protocols.
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

# Import after Django setup
from api.routing import websocket_urlpatterns  # noqa: E402
from api.middleware import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": OriginValidator(
        JWTAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        ),
        settings.CORS_ALLOWED_ORIGINS,
    ),
})
