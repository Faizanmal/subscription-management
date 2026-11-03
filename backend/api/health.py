"""Liveness / readiness probes for Docker and load balancers."""

from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        checks = {'api': 'ok'}
        status_code = 200

        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
            checks['database'] = 'ok'
        except Exception as exc:
            checks['database'] = 'error'
            checks['database_detail'] = str(exc)[:200]
            status_code = 503

        try:
            from django.core.cache import cache
            cache.set('healthcheck', '1', 5)
            checks['cache'] = 'ok' if cache.get('healthcheck') == '1' else 'degraded'
        except Exception:
            checks['cache'] = 'degraded'

        payload = {
            'status': 'ok' if status_code == 200 else 'degraded',
            'checks': checks,
        }
        return Response(payload, status=status_code)
