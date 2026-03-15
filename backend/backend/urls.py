"""
URL Configuration for Subscription Waste Manager
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API v1 - Main services endpoints
    path('api/v1/', include('services.urls')),
    path('api/v1/integrations/', include('integrations.urls')),
    path('api/v1/security/', include('security.urls')),
    path('api/v1/backups/', include('backups.urls')),
    
    # Authentication & Users
    path('api/v1/auth/', include('users.urls')),
    
    # Social Auth
    path('social/', include('social_django.urls', namespace='social')),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# Serve static and media files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
