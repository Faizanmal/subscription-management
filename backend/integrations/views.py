"""
Views for the integrations app
"""

import uuid

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsAdmin, IsFinance, IsOrgMember
from users.plans import (
    FEATURE_BANK_FEEDS,
    FEATURE_DISCOVERY_SYNC,
    FEATURE_LIVE_CONNECTORS,
    require_feature,
)
from integrations.models import (
    Integration, IntegrationSync, EmailScanConfig,
    BankAccount, BankTransaction, SSOConnection,
    SlackNotification, Webhook, WebhookDelivery
)
from integrations.serializers import (
    IntegrationSerializer, IntegrationSyncSerializer, EmailScanConfigSerializer,
    BankAccountSerializer, BankTransactionSerializer, SSOConnectionSerializer,
    SlackNotificationSerializer, WebhookSerializer, WebhookDeliverySerializer,
    PlaidExchangeTokenSerializer
)

OAUTH_STATE_TTL = 600

LAUNCH_INTEGRATION_TYPES = frozenset({
    Integration.IntegrationType.GOOGLE_WORKSPACE,
    Integration.IntegrationType.MICROSOFT_365,
    Integration.IntegrationType.PLAID,
    Integration.IntegrationType.OKTA,
    Integration.IntegrationType.AZURE_AD,
    Integration.IntegrationType.SLACK,
    Integration.IntegrationType.TEAMS,
    Integration.IntegrationType.WEBHOOK,
    Integration.IntegrationType.API,
})

LIVE_CONNECTOR_TYPES = frozenset({
    Integration.IntegrationType.GOOGLE_WORKSPACE,
    Integration.IntegrationType.MICROSOFT_365,
    Integration.IntegrationType.OKTA,
    Integration.IntegrationType.AZURE_AD,
})

COMING_SOON_MESSAGE = (
    'This connector is not available yet. Launch connectors are Google Workspace, '
    'Microsoft 365, Plaid, Okta, Azure AD, Slack, and Teams.'
)


def _oauth_state_key(user_id, state):
    return f'oauth_state:{user_id}:{state}'


def _store_oauth_state(user, provider):
    state = uuid.uuid4().hex
    cache.set(_oauth_state_key(user.id, state), provider, timeout=OAUTH_STATE_TTL)
    return state


def _consume_oauth_state(user, state, provider):
    if not state:
        return False
    key = _oauth_state_key(user.id, state)
    stored = cache.get(key)
    if stored != provider:
        return False
    cache.delete(key)
    return True


def _coming_soon_response():
    return Response(
        {'error': COMING_SOON_MESSAGE, 'status': 'coming_soon'},
        status=status.HTTP_501_NOT_IMPLEMENTED,
    )


def _upsert_integration(organization, integration_type, name, credentials, user, extra_config=None):
    integration, created = Integration.objects.get_or_create(
        organization=organization,
        type=integration_type,
        name=name,
        defaults={
            'status': Integration.Status.CONNECTED,
            'config': extra_config or {},
            'connected_by': user,
            'connected_at': timezone.now(),
            'last_sync_error': '',
        },
    )
    if not created:
        integration.status = Integration.Status.CONNECTED
        integration.config = extra_config or {}
        integration.connected_by = user
        integration.connected_at = timezone.now()
        integration.last_sync_error = ''
        integration.save(update_fields=[
            'status', 'config', 'connected_by', 'connected_at', 'last_sync_error', 'updated_at',
        ])
    integration.set_credentials_dict(credentials or {})
    integration.save(update_fields=['credentials', 'updated_at'])
    return integration


def _ensure_email_scan_config(integration, mailbox):
    defaults = {'enabled': True}
    if mailbox:
        defaults['mailboxes'] = [mailbox]
    EmailScanConfig.objects.get_or_create(
        organization=integration.organization,
        integration=integration,
        defaults=defaults,
    )


class IntegrationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing integrations"""
    
    serializer_class = IntegrationSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]
    
    def get_queryset(self):
        return Integration.objects.filter(
            organization=self.request.user.organization
        ).select_related('organization')
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        integration_type = request.data.get('type')
        if integration_type and integration_type not in LAUNCH_INTEGRATION_TYPES:
            return _coming_soon_response()
        if integration_type in LIVE_CONNECTOR_TYPES:
            blocked = require_feature(request.user.organization, FEATURE_LIVE_CONNECTORS)
            if blocked:
                return blocked
        if integration_type == Integration.IntegrationType.PLAID:
            blocked = require_feature(request.user.organization, FEATURE_BANK_FEEDS)
            if blocked:
                return blocked
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """Trigger integration sync"""
        blocked = require_feature(request.user.organization, FEATURE_DISCOVERY_SYNC)
        if blocked:
            return blocked

        integration = self.get_object()
        
        # Create sync record
        sync = IntegrationSync.objects.create(
            integration=integration,
            status='running',
            started_at=timezone.now()
        )
        
        # Trigger async sync task
        from integrations.tasks import sync_integration
        sync_integration.delay(str(integration.id), str(sync.id))
        
        return Response({
            'message': 'Sync started',
            'sync_id': str(sync.id)
        })
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test integration connection"""
        integration = self.get_object()
        
        # Trigger async test task
        from integrations.tasks import test_integration
        result = test_integration.delay(str(integration.id))
        
        return Response({
            'message': 'Test initiated',
            'task_id': result.id
        })
    
    @action(detail=True, methods=['get'])
    def sync_history(self, request, pk=None):
        """Get sync history for integration"""
        integration = self.get_object()
        syncs = IntegrationSync.objects.filter(
            integration=integration
        ).order_by('-started_at')[:50]
        
        serializer = IntegrationSyncSerializer(syncs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        """Get available integration types"""
        types = []
        for choice in Integration.IntegrationType.choices:
            types.append({
                'value': choice[0],
                'label': choice[1],
                'configured': Integration.objects.filter(
                    organization=request.user.organization,
                    type=choice[0]
                ).exists()
            })
        
        return Response(types)


class BankAccountViewSet(viewsets.ModelViewSet):
    """ViewSet for bank accounts"""
    
    serializer_class = BankAccountSerializer
    permission_classes = [permissions.IsAuthenticated, IsFinance]
    
    def get_queryset(self):
        return BankAccount.objects.filter(
            integration__organization=self.request.user.organization
        ).select_related('integration')
    
    @action(detail=False, methods=['post'])
    def plaid_link_token(self, request):
        """Create Plaid link token for connecting bank"""
        blocked = require_feature(request.user.organization, FEATURE_BANK_FEEDS)
        if blocked:
            return blocked
        if not settings.PLAID_CLIENT_ID or not settings.PLAID_SECRET:
            return Response(
                {'error': 'Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            import plaid
            from plaid.api import plaid_api
            from plaid.model.link_token_create_request import LinkTokenCreateRequest
            from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
            from plaid.model.products import Products
            from plaid.model.country_code import CountryCode
        except ImportError:
            return Response(
                {'error': 'Plaid SDK is not installed on this server.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        configuration = plaid.Configuration(
            host=getattr(plaid.Environment, settings.PLAID_ENV, plaid.Environment.Sandbox),
            api_key={
                'clientId': settings.PLAID_CLIENT_ID,
                'secret': settings.PLAID_SECRET,
            }
        )
        
        api_client = plaid.ApiClient(configuration)
        client = plaid_api.PlaidApi(api_client)
        
        user_id = str(request.user.id)
        
        request_data = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="Subscription Waste Manager",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(
                client_user_id=user_id
            )
        )
        
        try:
            response = client.link_token_create(request_data)
            return Response({
                'link_token': response['link_token'],
                'expiration': response['expiration'],
                'request_id': response['request_id']
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def plaid_exchange_token(self, request):
        """Exchange Plaid public token for access token"""
        blocked = require_feature(request.user.organization, FEATURE_BANK_FEEDS)
        if blocked:
            return blocked
        serializer = PlaidExchangeTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        import plaid
        from plaid.api import plaid_api
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
        
        configuration = plaid.Configuration(
            host=getattr(plaid.Environment, settings.PLAID_ENV, plaid.Environment.Sandbox),
            api_key={
                'clientId': settings.PLAID_CLIENT_ID,
                'secret': settings.PLAID_SECRET,
            }
        )
        
        api_client = plaid.ApiClient(configuration)
        client = plaid_api.PlaidApi(api_client)
        
        try:
            exchange_request = ItemPublicTokenExchangeRequest(
                public_token=serializer.validated_data['public_token']
            )
            exchange_response = client.item_public_token_exchange(exchange_request)
            
            access_token = exchange_response['access_token']
            item_id = exchange_response['item_id']
            
            integration = _upsert_integration(
                request.user.organization,
                Integration.IntegrationType.PLAID,
                'Plaid Bank Connection',
                {'access_token': access_token, 'item_id': item_id},
                request.user,
                {'item_id': item_id},
            )
            
            # Trigger account sync
            from integrations.tasks import sync_plaid_accounts
            sync_plaid_accounts.delay(str(integration.id))
            
            return Response({
                'message': 'Bank connected successfully',
                'integration_id': str(integration.id)
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        """Get transactions for bank account"""
        account = self.get_object()
        transactions = BankTransaction.objects.filter(
            bank_account=account
        ).order_by('-transaction_date')[:100]
        
        serializer = BankTransactionSerializer(transactions, many=True)
        return Response(serializer.data)


class BankTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for bank transactions (read-only)"""
    
    serializer_class = BankTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsFinance]
    
    def get_queryset(self):
        queryset = BankTransaction.objects.filter(
            bank_account__integration__organization=self.request.user.organization
        ).select_related('bank_account', 'subscription')
        
        # Filter options
        account_id = self.request.query_params.get('account')
        if account_id:
            queryset = queryset.filter(bank_account_id=account_id)
        
        is_subscription = self.request.query_params.get('subscription_only')
        if is_subscription:
            queryset = queryset.filter(is_subscription_related=True)
        
        unmatched = self.request.query_params.get('unmatched')
        if unmatched:
            queryset = queryset.filter(
                is_subscription_related=True,
                subscription__isnull=True
            )
        
        return queryset.order_by('-transaction_date')
    
    @action(detail=True, methods=['post'])
    def match_subscription(self, request, pk=None):
        """Match transaction to a subscription"""
        transaction = self.get_object()
        subscription_id = request.data.get('subscription_id')
        
        from services.models import Subscription
        
        try:
            subscription = Subscription.objects.get(
                id=subscription_id,
                organization=request.user.organization
            )
            transaction.subscription = subscription
            transaction.is_subscription_related = True
            transaction.is_matched = True
            transaction.matched_by = 'manual'
            transaction.save()
            
            return Response({
                'message': 'Transaction matched to subscription',
                'subscription': subscription.name
            })
        except Subscription.DoesNotExist:
            return Response(
                {'error': 'Subscription not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class WebhookViewSet(viewsets.ModelViewSet):
    """ViewSet for webhooks"""
    
    serializer_class = WebhookSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return Webhook.objects.filter(
            organization=self.request.user.organization
        )
    
    def perform_create(self, serializer):
        url = serializer.validated_data.get('url', '')
        serializer.save(
            organization=self.request.user.organization,
            secret=uuid.uuid4().hex,
            name=serializer.validated_data.get('name') or url or 'Webhook',
        )
    
    @action(detail=True, methods=['get'])
    def deliveries(self, request, pk=None):
        """Get webhook delivery history"""
        webhook = self.get_object()
        deliveries = WebhookDelivery.objects.filter(
            webhook=webhook
        ).order_by('-created_at')[:100]
        
        serializer = WebhookDeliverySerializer(deliveries, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Send test webhook"""
        webhook = self.get_object()
        
        from integrations.tasks import send_webhook
        result = send_webhook.delay(
            str(webhook.id),
            'test',
            {'message': 'This is a test webhook'}
        )
        
        return Response({
            'message': 'Test webhook sent',
            'task_id': result.id
        })


class SSOConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for SSO connections"""
    
    serializer_class = SSOConnectionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return SSOConnection.objects.filter(
            organization=self.request.user.organization
        ).select_related('integration', 'subscription')
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test SSO connection by checking the parent integration is connected."""
        connection = self.get_object()
        integration = connection.integration
        connected = integration.status in (
            Integration.Status.CONNECTED,
            Integration.Status.PENDING,
        )
        if integration.status == Integration.Status.ERROR:
            connected = False
        return Response({
            'valid': connected and integration.status != Integration.Status.ERROR,
            'message': 'SSO app is linked to a connected integration' if connected else 'Parent integration is not connected',
        })


class SlackNotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for Slack notifications"""
    
    serializer_class = SlackNotificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return SlackNotification.objects.filter(
            organization=self.request.user.organization
        )
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Send test Slack notification"""
        notification = self.get_object()
        
        from integrations.tasks import send_slack_notification
        result = send_slack_notification.delay(
            str(notification.id),
            "🧪 Test notification from Subscription Waste Manager",
            attachments=[{
                'color': '#36a64f',
                'text': 'If you see this message, your Slack integration is working correctly!'
            }]
        )
        
        return Response({
            'message': 'Test notification sent',
            'task_id': result.id
        })


class EmailScanConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for email scan configurations"""
    
    serializer_class = EmailScanConfigSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        return EmailScanConfig.objects.filter(
            organization=self.request.user.organization
        ).select_related('integration')

    def create(self, request, *args, **kwargs):
        blocked = require_feature(request.user.organization, FEATURE_DISCOVERY_SYNC)
        if blocked:
            return blocked
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=True, methods=['post'])
    def scan_now(self, request, pk=None):
        """Trigger immediate email scan"""
        blocked = require_feature(request.user.organization, FEATURE_DISCOVERY_SYNC)
        if blocked:
            return blocked
        config = self.get_object()
        
        from integrations.tasks import scan_emails
        result = scan_emails.delay(str(config.id))
        
        return Response({
            'message': 'Email scan started',
            'task_id': result.id
        })


# OAuth setup views

class GoogleOAuthSetupView(APIView):
    """Setup Google Workspace OAuth"""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        """Get OAuth authorization URL"""
        from urllib.parse import urlencode

        blocked = require_feature(request.user.organization, FEATURE_LIVE_CONNECTORS)
        if blocked:
            return blocked
        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {'error': 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        state = _store_oauth_state(request.user, 'google')
        params = {
            'client_id': settings.GOOGLE_CLIENT_ID,
            'redirect_uri': f"{settings.FRONTEND_URL}/integrations/google/callback",
            'response_type': 'code',
            'scope': ' '.join([
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/admin.directory.user.readonly',
                'openid',
                'email',
                'profile',
            ]),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state,
        }
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return Response({'auth_url': auth_url})


class GoogleOAuthCallbackView(APIView):
    """Handle Google OAuth callback"""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        """Exchange authorization code for tokens"""
        blocked = require_feature(request.user.organization, FEATURE_LIVE_CONNECTORS)
        if blocked:
            return blocked

        code = request.data.get('code')
        state = request.data.get('state')

        if not _consume_oauth_state(request.user, state, 'google'):
            return Response(
                {'error': 'Invalid state parameter'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import requests

        token_response = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code': code,
                'client_id': settings.GOOGLE_CLIENT_ID,
                'client_secret': settings.GOOGLE_CLIENT_SECRET,
                'redirect_uri': f"{settings.FRONTEND_URL}/integrations/google/callback",
                'grant_type': 'authorization_code',
            },
            timeout=20,
        )

        if token_response.status_code != 200:
            return Response(
                {'error': 'Failed to exchange authorization code'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tokens = token_response.json()
        integration = _upsert_integration(
            request.user.organization,
            Integration.IntegrationType.GOOGLE_WORKSPACE,
            'Google Workspace',
            {
                'access_token': tokens.get('access_token'),
                'refresh_token': tokens.get('refresh_token'),
                'expires_in': tokens.get('expires_in'),
            },
            request.user,
        )
        _ensure_email_scan_config(integration, request.user.email)

        from integrations.tasks import sync_integration
        sync_integration.delay(str(integration.id))

        return Response({
            'message': 'Google Workspace connected successfully',
            'integration_id': str(integration.id),
        })


class MicrosoftOAuthSetupView(APIView):
    """Setup Microsoft 365 OAuth"""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        """Get OAuth authorization URL"""
        from urllib.parse import urlencode

        blocked = require_feature(request.user.organization, FEATURE_LIVE_CONNECTORS)
        if blocked:
            return blocked
        if not settings.MICROSOFT_CLIENT_ID:
            return Response(
                {'error': 'Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        state = _store_oauth_state(request.user, 'microsoft')
        tenant = getattr(settings, 'MICROSOFT_TENANT_ID', None) or 'common'
        params = {
            'client_id': settings.MICROSOFT_CLIENT_ID,
            'redirect_uri': f"{settings.FRONTEND_URL}/integrations/microsoft/callback",
            'response_type': 'code',
            'scope': ' '.join([
                'openid',
                'email',
                'profile',
                'offline_access',
                'User.Read',
                'User.Read.All',
                'Directory.Read.All',
                'Mail.Read',
            ]),
            'response_mode': 'query',
            'state': state,
        }
        auth_url = (
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
            f"?{urlencode(params)}"
        )
        return Response({'auth_url': auth_url})


class MicrosoftOAuthCallbackView(APIView):
    """Handle Microsoft OAuth callback"""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        """Exchange authorization code for tokens"""
        blocked = require_feature(request.user.organization, FEATURE_LIVE_CONNECTORS)
        if blocked:
            return blocked

        code = request.data.get('code')
        state = request.data.get('state')

        if not _consume_oauth_state(request.user, state, 'microsoft'):
            return Response(
                {'error': 'Invalid state parameter'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import requests

        tenant = getattr(settings, 'MICROSOFT_TENANT_ID', None) or 'common'
        token_response = requests.post(
            f'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
            data={
                'code': code,
                'client_id': settings.MICROSOFT_CLIENT_ID,
                'client_secret': settings.MICROSOFT_CLIENT_SECRET,
                'redirect_uri': f"{settings.FRONTEND_URL}/integrations/microsoft/callback",
                'grant_type': 'authorization_code',
            },
            timeout=20,
        )

        if token_response.status_code != 200:
            return Response(
                {'error': 'Failed to exchange authorization code'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tokens = token_response.json()
        integration = _upsert_integration(
            request.user.organization,
            Integration.IntegrationType.MICROSOFT_365,
            'Microsoft 365',
            {
                'access_token': tokens.get('access_token'),
                'refresh_token': tokens.get('refresh_token'),
                'expires_in': tokens.get('expires_in'),
            },
            request.user,
        )
        _ensure_email_scan_config(integration, request.user.email)

        from integrations.tasks import sync_integration
        sync_integration.delay(str(integration.id))

        return Response({
            'message': 'Microsoft 365 connected successfully',
            'integration_id': str(integration.id),
        })


class SlackConnectView(APIView):
    """Connect Slack via an incoming webhook URL."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        import requests

        webhook_url = (request.data.get('webhook_url') or '').strip()
        channel_name = (request.data.get('channel_name') or '').strip() or 'alerts'
        if not webhook_url.startswith('https://hooks.slack.com/'):
            return Response(
                {'error': 'Enter a Slack incoming webhook URL (https://hooks.slack.com/...).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ping = requests.post(
            webhook_url,
            json={'text': 'Subscription Waste Manager is connected to this channel.'},
            timeout=10,
        )
        if ping.status_code != 200:
            return Response(
                {'error': 'Slack rejected the webhook URL. Check the URL and try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        integration = _upsert_integration(
            request.user.organization,
            Integration.IntegrationType.SLACK,
            'Slack',
            {'webhook_url': webhook_url},
            request.user,
            {'channel_name': channel_name},
        )
        SlackNotification.objects.update_or_create(
            organization=request.user.organization,
            integration=integration,
            channel_name=channel_name,
            defaults={'channel_id': channel_name, 'is_active': True},
        )
        return Response({
            'message': 'Slack connected successfully',
            'integration_id': str(integration.id),
        })


class OktaConnectView(APIView):
    """Connect Okta with a domain and API token."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        blocked = require_feature(request.user.organization, FEATURE_LIVE_CONNECTORS)
        if blocked:
            return blocked

        import re
        import requests

        raw_domain = (request.data.get('domain') or '').strip().lower()
        raw_domain = raw_domain.replace('https://', '').replace('http://', '').rstrip('/')
        api_token = (request.data.get('api_token') or '').strip()
        if not re.fullmatch(r'[a-z0-9.-]+\.okta(preview)?\.com', raw_domain):
            return Response(
                {'error': 'Domain must look like company.okta.com.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not api_token:
            return Response({'error': 'API token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        probe = requests.get(
            f'https://{raw_domain}/api/v1/users',
            headers={'Authorization': f'SSWS {api_token}', 'Accept': 'application/json'},
            params={'limit': 1},
            timeout=15,
        )
        if probe.status_code != 200:
            return Response(
                {'error': 'Okta rejected those credentials. Check the domain and API token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        integration = _upsert_integration(
            request.user.organization,
            Integration.IntegrationType.OKTA,
            'Okta',
            {'api_token': api_token, 'domain': raw_domain},
            request.user,
            {'domain': raw_domain},
        )
        from integrations.tasks import sync_integration
        sync_integration.delay(str(integration.id))
        return Response({
            'message': 'Okta connected successfully',
            'integration_id': str(integration.id),
        })


class AzureADConnectView(APIView):
    """Connect Azure AD with an app registration (client credentials)."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        blocked = require_feature(request.user.organization, FEATURE_LIVE_CONNECTORS)
        if blocked:
            return blocked

        import requests

        tenant_id = (request.data.get('tenant_id') or '').strip()
        client_id = (request.data.get('client_id') or '').strip()
        client_secret = (request.data.get('client_secret') or '').strip()
        if not tenant_id or not client_id or not client_secret:
            return Response(
                {'error': 'Tenant ID, client ID, and client secret are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_response = requests.post(
            f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
            data={
                'client_id': client_id,
                'client_secret': client_secret,
                'grant_type': 'client_credentials',
                'scope': 'https://graph.microsoft.com/.default',
            },
            timeout=15,
        )
        if token_response.status_code != 200:
            return Response(
                {'error': 'Azure AD rejected those credentials. Check the app registration and permissions.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        integration = _upsert_integration(
            request.user.organization,
            Integration.IntegrationType.AZURE_AD,
            'Azure Active Directory',
            {
                'tenant_id': tenant_id,
                'client_id': client_id,
                'client_secret': client_secret,
                'access_token': token_response.json().get('access_token'),
            },
            request.user,
            {'tenant_id': tenant_id},
        )
        from integrations.tasks import sync_integration
        sync_integration.delay(str(integration.id))
        return Response({
            'message': 'Azure AD connected successfully',
            'integration_id': str(integration.id),
        })


class TeamsConnectView(APIView):
    """Connect Microsoft Teams via an incoming webhook URL."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        webhook_url = (request.data.get('webhook_url') or '').strip()
        channel_name = (request.data.get('channel_name') or '').strip() or 'alerts'
        if not webhook_url.startswith('https://'):
            return Response(
                {'error': 'Enter a valid Microsoft Teams incoming webhook URL.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        integration = _upsert_integration(
            request.user.organization,
            Integration.IntegrationType.TEAMS,
            'Microsoft Teams',
            {'webhook_url': webhook_url},
            request.user,
            {'channel_name': channel_name},
        )
        return Response({
            'message': 'Microsoft Teams connected successfully',
            'integration_id': str(integration.id),
        })


class ComingSoonConnectorView(APIView):
    """Stub endpoints for connectors deferred until after launch."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        return _coming_soon_response()

    def post(self, request):
        return _coming_soon_response()


QuickBooksOAuthSetupView = ComingSoonConnectorView
QuickBooksOAuthCallbackView = ComingSoonConnectorView
XeroOAuthSetupView = ComingSoonConnectorView
XeroOAuthCallbackView = ComingSoonConnectorView
WorkdayOAuthSetupView = ComingSoonConnectorView
WorkdayOAuthCallbackView = ComingSoonConnectorView
BambooHROAuthSetupView = ComingSoonConnectorView
BambooHROAuthCallbackView = ComingSoonConnectorView
GustoOAuthSetupView = ComingSoonConnectorView
GustoOAuthCallbackView = ComingSoonConnectorView
RipplingOAuthSetupView = ComingSoonConnectorView
RipplingOAuthCallbackView = ComingSoonConnectorView
ConcurOAuthSetupView = ComingSoonConnectorView
ConcurOAuthCallbackView = ComingSoonConnectorView
ExpensifyOAuthSetupView = ComingSoonConnectorView
ExpensifyOAuthCallbackView = ComingSoonConnectorView
BrexOAuthSetupView = ComingSoonConnectorView
BrexOAuthCallbackView = ComingSoonConnectorView
RampOAuthSetupView = ComingSoonConnectorView
RampOAuthCallbackView = ComingSoonConnectorView
OneLoginOAuthSetupView = ComingSoonConnectorView
OneLoginOAuthCallbackView = ComingSoonConnectorView
JumpCloudOAuthSetupView = ComingSoonConnectorView
JumpCloudOAuthCallbackView = ComingSoonConnectorView
