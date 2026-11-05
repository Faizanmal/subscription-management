from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from users.authentication import MFAJWTAuthentication


@database_sync_to_async
def authenticate_token(token):
    auth = MFAJWTAuthentication()
    user = auth.get_user(auth.get_validated_token(token))
    from users.policies import agreements_required
    from users.verification import verification_required
    if agreements_required(user) or verification_required(user):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Current agreements required')
    return user


class JWTAuthMiddleware:
    """Channels 4 ASGI authentication with the same rules as HTTP requests."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope['user'] = AnonymousUser()
        params = parse_qs(scope.get('query_string', b'').decode('utf-8', errors='replace'))
        token = (params.get('token') or [None])[0]
        if not token:
            headers = dict(scope.get('headers', []))
            auth = headers.get(b'authorization', b'').decode('utf-8', errors='replace')
            if auth.lower().startswith('bearer '):
                token = auth.split(None, 1)[1]
        if token:
            try:
                scope['user'] = await authenticate_token(token)
            except Exception:
                pass
        return await self.inner(scope, receive, send)
