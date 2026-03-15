"""
Utility functions for the users app
"""

from django.http import JsonResponse
from django.utils.translation import gettext as _


def axes_lockout_response(request, credentials, **kwargs):
    """
    Custom lockout response for Django Axes
    Returns JSON response for API requests, HTML for others
    """
    if request.content_type == 'application/json' or request.path.startswith('/api/'):
        return JsonResponse({
            'error': _('Too many failed login attempts. Account is locked.'),
            'code': 'account_locked',
            'retry_after': 900  # 15 minutes in seconds
        }, status=429)
    else:
        # For non-API requests, return a simple error message
        from django.http import HttpResponse
        return HttpResponse(
            _('Too many failed login attempts. Account is locked for 15 minutes.'),
            status=429,
            content_type='text/plain'
        )