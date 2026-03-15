"""
Middleware for users app
"""

from django.utils import timezone
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


class AuditLogMiddleware:
    """Middleware to log sensitive actions"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        
        # Paths to log
        self.audit_paths = [
            '/api/users/',
            '/api/security/',
            '/api/backups/',
            '/api/integrations/',
        ]
        
        # Methods to log
        self.audit_methods = ['POST', 'PUT', 'PATCH', 'DELETE']
    
    def __call__(self, request):
        # Process response
        response = self.get_response(request)
        
        # Check if we should log this request
        if self.should_log(request, response):
            self.log_request(request, response)
        
        return response
    
    def should_log(self, request, response):
        """Determine if request should be logged"""
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return False
        
        if request.method not in self.audit_methods:
            return False
        
        # Check if path matches
        for path in self.audit_paths:
            if request.path.startswith(path):
                return True
        
        return False
    
    def log_request(self, request, response):
        """Log the request to audit log"""
        try:
            from users.models import AuditLog
            
            # Determine action
            action_map = {
                'POST': 'create',
                'PUT': 'update',
                'PATCH': 'update',
                'DELETE': 'delete'
            }
            action = action_map.get(request.method, 'unknown')
            
            # Extract resource info from path
            parts = request.path.strip('/').split('/')
            resource_type = parts[1] if len(parts) > 1 else 'unknown'
            resource_id = parts[2] if len(parts) > 2 else None
            
            AuditLog.objects.create(
                organization=request.organization,
                user=request.user,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                request_data={
                    'method': request.method,
                    'path': request.path,
                    'status_code': response.status_code
                }
            )
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
    
    def get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class SessionTrackingMiddleware:
    """Middleware to track user sessions"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Update session activity for authenticated users
        if hasattr(request, 'user') and request.user.is_authenticated:
            self.update_session(request)
        
        return response
    
    def update_session(self, request):
        """Update session last activity"""
        try:
            from security.models import Session
            
            # Get session from JWT if available
            session_id = getattr(request, 'session_id', None)
            if session_id:
                Session.objects.filter(
                    id=session_id,
                    is_active=True
                ).update(last_activity_at=timezone.now())
        except Exception:
            pass


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


class RateLimitMiddleware:
    """Simple rate limiting middleware"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.rate_limit = 100  # requests per minute
        self.window = 60  # seconds
    
    def __call__(self, request):
        from django.core.cache import cache
        
        # Get client identifier
        client_key = self.get_client_key(request)
        cache_key = f"rate_limit:{client_key}"
        
        # Check rate limit
        current = cache.get(cache_key, 0)
        if current >= self.rate_limit:
            from django.http import JsonResponse
            return JsonResponse(
                {'error': 'Rate limit exceeded'},
                status=429
            )
        
        # Increment counter
        cache.set(cache_key, current + 1, self.window)
        
        response = self.get_response(request)
        
        # Add rate limit headers
        response['X-RateLimit-Limit'] = str(self.rate_limit)
        response['X-RateLimit-Remaining'] = str(max(0, self.rate_limit - current - 1))
        
        return response
    
    def get_client_key(self, request):
        """Get unique client identifier"""
        # Use user ID if authenticated
        if hasattr(request, 'user') and request.user.is_authenticated:
            return f"user:{request.user.id}"
        
        # Fall back to IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        
        return f"ip:{ip}"
