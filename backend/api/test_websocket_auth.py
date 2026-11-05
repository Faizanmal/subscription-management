from channels.security.websocket import OriginValidator
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from api.middleware import JWTAuthMiddleware
from users.models import User


async def authenticated_app(scope, receive, send):
    await receive()
    await send({'type': 'websocket.accept'} if scope['user'].is_authenticated else {'type': 'websocket.close', 'code': 4401})
    if scope['user'].is_authenticated:
        await receive()


class WebSocketAuthenticationTests(TransactionTestCase):
    def setUp(self):
        user = User.objects.create_user('websocket@acme.com', 'TestPassword123!')
        self.token = str(RefreshToken.for_user(user).access_token)
        self.application = OriginValidator(JWTAuthMiddleware(authenticated_app), ['https://app.acme.com'])

    async def test_frontend_origin_can_authenticate_on_separate_api_host(self):
        client = WebsocketCommunicator(self.application, f'/ws/?token={self.token}', headers=[(b'origin', b'https://app.acme.com')])
        connected, _ = await client.connect()
        self.assertTrue(connected)
        await client.disconnect()

    async def test_wrong_origin_and_invalid_tokens_are_rejected(self):
        for token, origin in [(self.token, b'https://attacker.com'), ('invalid', b'https://app.acme.com')]:
            client = WebsocketCommunicator(self.application, f'/ws/?token={token}', headers=[(b'origin', origin)])
            connected, _ = await client.connect()
            self.assertFalse(connected)
            await client.disconnect()

    @override_settings(ENFORCE_POLICY_ACCEPTANCE=True)
    async def test_missing_policy_acceptance_cannot_open_websocket(self):
        client = WebsocketCommunicator(self.application, f'/ws/?token={self.token}', headers=[(b'origin', b'https://app.acme.com')])
        connected, _ = await client.connect()
        self.assertFalse(connected)
        await client.disconnect()

    @override_settings(ENFORCE_EMAIL_VERIFICATION=True)
    async def test_unverified_mailbox_cannot_open_websocket(self):
        client = WebsocketCommunicator(self.application, f'/ws/?token={self.token}', headers=[(b'origin', b'https://app.acme.com')])
        connected, _ = await client.connect()
        self.assertFalse(connected)
        await client.disconnect()
