"""
Views for the integrations app
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.conf import settings
import uuid

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
from api.permissions import IsAdmin, IsFinance, IsOrgMember


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
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """Trigger integration sync"""
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
        import plaid
        from plaid.api import plaid_api
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
        from plaid.model.products import Products
        from plaid.model.country_code import CountryCode
        
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
            
            # Create integration
            integration = Integration.objects.create(
                organization=request.user.organization,
                name='Plaid Bank Connection',
                type=Integration.IntegrationType.PLAID,
                status='active',
                credentials_encrypted={'access_token': access_token},
                config={'item_id': item_id}
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
            account=account
        ).order_by('-transaction_date')[:100]
        
        serializer = BankTransactionSerializer(transactions, many=True)
        return Response(serializer.data)


class BankTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for bank transactions (read-only)"""
    
    serializer_class = BankTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsFinance]
    
    def get_queryset(self):
        queryset = BankTransaction.objects.filter(
            account__integration__organization=self.request.user.organization
        ).select_related('account', 'matched_subscription')
        
        # Filter options
        account_id = self.request.query_params.get('account')
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        
        is_subscription = self.request.query_params.get('subscription_only')
        if is_subscription:
            queryset = queryset.filter(is_subscription_payment=True)
        
        unmatched = self.request.query_params.get('unmatched')
        if unmatched:
            queryset = queryset.filter(
                is_subscription_payment=True,
                matched_subscription__isnull=True
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
            transaction.matched_subscription = subscription
            transaction.is_subscription_payment = True
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
        serializer.save(
            organization=self.request.user.organization,
            secret=uuid.uuid4().hex
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
        ).select_related('default_role', 'default_department')
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test SSO connection"""
        connection = self.get_object()
        
        # Validate metadata URL or certificate
        try:
            from integrations.utils.sso import validate_sso_config
            result = validate_sso_config(connection)
            return Response({
                'valid': result['valid'],
                'message': result.get('message', 'SSO configuration is valid')
            })
        except Exception as e:
            return Response(
                {'valid': False, 'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


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
            integration__organization=self.request.user.organization
        ).select_related('integration')
    
    @action(detail=True, methods=['post'])
    def scan_now(self, request, pk=None):
        """Trigger immediate email scan"""
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
        
        state = uuid.uuid4().hex
        
        # Store state in session
        request.session['google_oauth_state'] = state
        
        params = {
            'client_id': settings.GOOGLE_CLIENT_ID,
            'redirect_uri': f"{settings.FRONTEND_URL}/integrations/google/callback",
            'response_type': 'code',
            'scope': ' '.join([
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/admin.directory.user.readonly',
                'openid',
                'email',
                'profile'
            ]),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state
        }
        
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        
        return Response({'auth_url': auth_url})


class GoogleOAuthCallbackView(APIView):
    """Handle Google OAuth callback"""
    
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request):
        """Exchange authorization code for tokens"""
        code = request.data.get('code')
        state = request.data.get('state')
        
        # Verify state
        stored_state = request.session.get('google_oauth_state')
        if state != stored_state:
            return Response(
                {'error': 'Invalid state parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        import requests
        
        # Exchange code for tokens
        token_response = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code': code,
                'client_id': settings.GOOGLE_CLIENT_ID,
                'client_secret': settings.GOOGLE_CLIENT_SECRET,
                'redirect_uri': f"{settings.FRONTEND_URL}/integrations/google/callback",
                'grant_type': 'authorization_code'
            }
        )
        
        if token_response.status_code != 200:
            return Response(
                {'error': 'Failed to exchange authorization code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tokens = token_response.json()
        
        # Create integration
        integration = Integration.objects.create(
            organization=request.user.organization,
            name='Google Workspace',
            type=Integration.IntegrationType.GOOGLE_WORKSPACE,
            status='active',
            credentials_encrypted={
                'access_token': tokens.get('access_token'),
                'refresh_token': tokens.get('refresh_token'),
                'expires_in': tokens.get('expires_in')
            }
        )
        
        # Trigger initial sync
        from integrations.tasks import sync_google_workspace
        sync_google_workspace.delay(str(integration.id))
        
        return Response({
            'message': 'Google Workspace connected successfully',
            'integration_id': str(integration.id)
        })


class MicrosoftOAuthSetupView(APIView):
    """Setup Microsoft 365 OAuth"""
    
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        """Get OAuth authorization URL"""
        from urllib.parse import urlencode
        
        state = uuid.uuid4().hex
        
        # Store state in session
        request.session['microsoft_oauth_state'] = state
        
        params = {
            'client_id': settings.MICROSOFT_CLIENT_ID,
            'redirect_uri': f"{settings.FRONTEND_URL}/integrations/microsoft/callback",
            'response_type': 'code',
            'scope': ' '.join([
                'openid',
                'email',
                'profile',
                'User.Read',
                'User.Read.All',
                'Directory.Read.All'
            ]),
            'response_mode': 'query',
            'state': state
        }
        
        auth_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urlencode(params)}"
        
        return Response({'auth_url': auth_url})


class MicrosoftOAuthCallbackView(APIView):
    """Handle Microsoft OAuth callback"""
    
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request):
        """Exchange authorization code for tokens"""
        code = request.data.get('code')
        state = request.data.get('state')
        
        # Verify state
        stored_state = request.session.get('microsoft_oauth_state')
        if state != stored_state:
            return Response(
                {'error': 'Invalid state parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        import requests
        
        # Exchange code for tokens
        token_response = requests.post(
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            data={
                'code': code,
                'client_id': settings.MICROSOFT_CLIENT_ID,
                'client_secret': settings.MICROSOFT_CLIENT_SECRET,
                'redirect_uri': f"{settings.FRONTEND_URL}/integrations/microsoft/callback",
                'grant_type': 'authorization_code'
            }
        )
        
        if token_response.status_code != 200:
            return Response(
                {'error': 'Failed to exchange authorization code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tokens = token_response.json()
        
        # Create integration
        integration = Integration.objects.create(
            organization=request.user.organization,
            name='Microsoft 365',
            type=Integration.IntegrationType.MICROSOFT_365,
            status='active',
            credentials_encrypted={
                'access_token': tokens.get('access_token'),
                'refresh_token': tokens.get('refresh_token'),
                'expires_in': tokens.get('expires_in')
            }
        )
        
        # Trigger initial sync
        from integrations.tasks import sync_microsoft_365
        sync_microsoft_365.delay(str(integration.id))
        
        return Response({
            'message': 'Microsoft 365 connected successfully',
            'integration_id': str(integration.id)
        })
