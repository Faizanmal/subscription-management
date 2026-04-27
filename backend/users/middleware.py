"""
Middleware for users app
"""

from django.conf import settings
import logging

logger = logging.getLogger('swm')


class OrganizationMiddleware:
    """Middleware to attach organization to request"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Attach organization to request if user is authenticated
        if hasattr(request, 'user') and request.user.is_authenticated:
            request.organization = getattr(request.user, 'organization', None)
        else:
            request.organization = None
        
        response = self.get_response(request)
        return response


class SecurityHeadersMiddleware:
    """Middleware to add security headers"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Add security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Only add HSTS in production
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response
