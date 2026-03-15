"""
Custom exception handler for API
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger('swm')


def custom_exception_handler(exc, context):
    """Custom exception handler with logging"""
    
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # Log the exception
    logger.error(f"API Exception: {exc}", exc_info=True)
    
    if response is not None:
        # Customize the response format
        custom_response_data = {
            'success': False,
            'error': {
                'code': response.status_code,
                'message': get_error_message(response.data),
                'details': response.data if isinstance(response.data, dict) else {'message': response.data}
            }
        }
        response.data = custom_response_data
    else:
        # Handle unexpected errors
        custom_response_data = {
            'success': False,
            'error': {
                'code': 500,
                'message': 'Internal server error',
                'details': str(exc)
            }
        }
        response = Response(custom_response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return response


def get_error_message(data):
    """Extract a human-readable error message from response data"""
    
    if isinstance(data, str):
        return data
    
    if isinstance(data, list):
        return data[0] if data else 'An error occurred'
    
    if isinstance(data, dict):
        if 'detail' in data:
            return data['detail']
        if 'message' in data:
            return data['message']
        if 'error' in data:
            return data['error']
        
        # Get first field error
        for key, value in data.items():
            if isinstance(value, list) and value:
                return f"{key}: {value[0]}"
            if isinstance(value, str):
                return f"{key}: {value}"
    
    return 'An error occurred'
