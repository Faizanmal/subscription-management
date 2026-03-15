from urllib.parse import parse_qs

from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTAuthMiddleware:
    """ASGI middleware that authenticates WebSocket connections using JWT.

    It looks for a `token` query parameter first, then falls back to an
    `Authorization: Bearer <token>` header. If a valid JWT is found, it sets
    `scope['user']` to the authenticated user.
    """

    def __init__(self, inner):
        self.inner = inner

    def __call__(self, scope):
        return JWTAuthMiddlewareInstance(scope, self.inner)


class JWTAuthMiddlewareInstance:
    def __init__(self, scope, inner):
        # Make a shallow copy of scope so we can mutate it safely
        self.scope = dict(scope)
        self.inner = inner

    async def __call__(self, receive, send):
        token = None

        # Query string (e.g., ws://.../?token=...)
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        if query_string:
            params = parse_qs(query_string)
            token_list = params.get('token')
            if token_list:
                token = token_list[0]

        # Authorization header fallback
        if not token:
            headers = dict((k.decode('utf-8'), v.decode('utf-8')) for k, v in self.scope.get('headers', []))
            auth_header = headers.get('authorization') or headers.get('Authorization')
            if auth_header and auth_header.lower().startswith('bearer '):
                token = auth_header.split(None, 1)[1]

        if token:
            try:
                auth = JWTAuthentication()
                validated_token = auth.get_validated_token(token)
                user = auth.get_user(validated_token)
                self.scope['user'] = user
            except Exception:
                # Failure to authenticate should not crash the connection; user remains anonymous
                pass

        inner = self.inner(self.scope)
        return await inner(receive, send)
