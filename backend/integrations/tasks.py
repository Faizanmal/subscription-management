"""
Celery tasks for integrations app
"""

from celery import shared_task
from django.utils import timezone
from django.conf import settings
import logging
import json
import requests

logger = logging.getLogger('swm')


def _backoff_seconds(retries):
    """Exponential backoff capped at 1 hour."""
    return min(3600, 60 * (2 ** retries))


def _refresh_google_access_token(integration, credentials):
    refresh_token = credentials.get('refresh_token')
    client_id = credentials.get('client_id') or getattr(settings, 'GOOGLE_CLIENT_ID', None)
    client_secret = credentials.get('client_secret') or getattr(settings, 'GOOGLE_CLIENT_SECRET', None)

    if not refresh_token or not client_id or not client_secret:
        return credentials.get('access_token')

    response = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': client_id,
            'client_secret': client_secret,
        },
        timeout=15,
    )
    if response.status_code != 200:
        raise ValueError(f"Failed to refresh Google token: {response.status_code}")

    payload = response.json()
    credentials['access_token'] = payload.get('access_token')
    if payload.get('expires_in'):
        credentials['expires_in'] = payload['expires_in']
    integration.credentials = credentials
    integration.save(update_fields=['credentials', 'updated_at'])
    return credentials.get('access_token')


def _refresh_microsoft_access_token(integration, credentials):
    refresh_token = credentials.get('refresh_token')
    tenant_id = credentials.get('tenant_id') or getattr(settings, 'MICROSOFT_TENANT_ID', 'common')
    client_id = credentials.get('client_id') or getattr(settings, 'MICROSOFT_CLIENT_ID', None)
    client_secret = credentials.get('client_secret') or getattr(settings, 'MICROSOFT_CLIENT_SECRET', None)

    if not refresh_token or not client_id or not client_secret:
        return credentials.get('access_token')

    response = requests.post(
        f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
        data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': client_id,
            'client_secret': client_secret,
            'scope': 'https://graph.microsoft.com/.default',
        },
        timeout=15,
    )
    if response.status_code != 200:
        raise ValueError(f"Failed to refresh Microsoft token: {response.status_code}")

    payload = response.json()
    credentials['access_token'] = payload.get('access_token')
    if payload.get('expires_in'):
        credentials['expires_in'] = payload['expires_in']
    integration.credentials = credentials
    integration.save(update_fields=['credentials', 'updated_at'])
    return credentials.get('access_token')


@shared_task(bind=True, max_retries=3)
def sync_integration(self, integration_id, sync_id=None):
    """Sync data from an integration"""
    from integrations.models import Integration, IntegrationSync
    
    try:
        integration = Integration.objects.get(id=integration_id)
        
        # Create or get sync record
        if sync_id:
            sync = IntegrationSync.objects.get(id=sync_id)
        else:
            sync = IntegrationSync.objects.create(
                integration=integration,
                status='running',
                started_at=timezone.now()
            )
        
        try:
            # Route to appropriate sync handler
            handlers = {
                'google_workspace': sync_google_workspace,
                'microsoft_365': sync_microsoft_365,
                'plaid': sync_plaid_accounts,
                'email_scan': scan_emails_for_subscriptions,
                'slack': sync_slack,
                'okta': sync_okta,
                'azure_ad': sync_azure_ad,
            }
            
            handler = handlers.get(integration.type)
            if handler:
                result = handler(integration)
                sync.items_synced = result.get('items', 0)
                sync.sync_data = result.get('data', {})
                sync.status = 'completed'
            else:
                sync.status = 'failed'
                sync.errors = [f"No handler for integration type: {integration.type}"]
            
            sync.completed_at = timezone.now()
            sync.save()
            
            # Update integration
            integration.last_sync_at = timezone.now()
            integration.error_message = None
            integration.save()
            
        except Exception as e:
            sync.status = 'failed'
            sync.errors = [str(e)]
            sync.completed_at = timezone.now()
            sync.save()
            
            integration.error_message = str(e)
            integration.save()
            
            raise
        
    except Integration.DoesNotExist:
        logger.error(f"Integration {integration_id} not found")
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        self.retry(countdown=_backoff_seconds(self.request.retries))


@shared_task(bind=True, max_retries=3)
def test_integration(self, integration_id):
    """Test an integration connection"""
    from integrations.models import Integration
    
    try:
        integration = Integration.objects.get(id=integration_id)
        
        # Test based on type
        if integration.type == 'google_workspace':
            result = test_google_workspace(integration)
        elif integration.type == 'microsoft_365':
            result = test_microsoft_365(integration)
        elif integration.type == 'plaid':
            result = test_plaid(integration)
        elif integration.type == 'slack':
            result = test_slack(integration)
        else:
            result = {'success': False, 'error': 'Unknown integration type'}
        
        return result
        
    except Integration.DoesNotExist:
        return {'success': False, 'error': 'Integration not found'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def sync_google_workspace(integration):
    """Sync Google Workspace users and apps"""
    from services.models import Subscription, SoftwareVendor
    
    credentials = integration.credentials or {}
    access_token = credentials.get('access_token')
    
    if not access_token:
        raise ValueError("No access token available")
    
    if credentials.get('refresh_token'):
        access_token = _refresh_google_access_token(integration, credentials)
    
    # Get users from Google Admin API
    headers = {'Authorization': f'Bearer {access_token}'}
    
    response = requests.get(
        'https://admin.googleapis.com/admin/directory/v1/users',
        headers=headers,
        params={'customer': 'my_customer', 'maxResults': 500},
        timeout=30,
    )
    
    if response.status_code == 200:
        data = response.json()
        users = data.get('users', [])
        
        # Get or create Google Workspace subscription
        vendor, _ = SoftwareVendor.objects.get_or_create(
            name='Google Workspace',
            defaults={'category': 'productivity'}
        )
        
        subscription, _ = Subscription.objects.get_or_create(
            organization=integration.organization,
            name='Google Workspace',
            defaults={
                'vendor': vendor,
                'status': 'active',
                'billing_cycle': 'monthly',
                'total_licenses': len(users)
            }
        )
        
        subscription.total_licenses = len(users)
        subscription.save()
        
        return {
            'items': len(users),
            'data': {'total_users': len(users)}
        }
    
    raise ValueError(f"Google API error: {response.status_code}")


def sync_microsoft_365(integration):
    """Sync Microsoft 365 users and apps"""
    from services.models import Subscription, SoftwareVendor
    
    credentials = integration.credentials or {}
    access_token = credentials.get('access_token')
    
    if not access_token:
        raise ValueError("No access token available")

    if credentials.get('refresh_token'):
        access_token = _refresh_microsoft_access_token(integration, credentials)
    
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Get users
    response = requests.get(
        'https://graph.microsoft.com/v1.0/users',
        headers=headers,
        params={'$top': 999},
        timeout=30,
    )
    
    if response.status_code == 200:
        data = response.json()
        users = data.get('value', [])
        
        # Get or create M365 subscription
        vendor, _ = SoftwareVendor.objects.get_or_create(
            name='Microsoft 365',
            defaults={'category': 'productivity'}
        )
        
        subscription, _ = Subscription.objects.get_or_create(
            organization=integration.organization,
            name='Microsoft 365',
            defaults={
                'vendor': vendor,
                'status': 'active',
                'billing_cycle': 'monthly',
                'total_licenses': len(users)
            }
        )
        
        subscription.total_licenses = len(users)
        subscription.save()
        
        return {
            'items': len(users),
            'data': {'total_users': len(users)}
        }
    
    raise ValueError(f"Microsoft Graph API error: {response.status_code}")


@shared_task(bind=True, max_retries=3)
def sync_plaid_accounts(self, integration_id):
    """Sync Plaid bank accounts and transactions"""
    from integrations.models import Integration, BankAccount, BankTransaction
    from services.models import Subscription
    
    try:
        integration = Integration.objects.get(id=integration_id)
        
        import plaid
        from plaid.api import plaid_api
        from plaid.model.accounts_get_request import AccountsGetRequest
        from plaid.model.transactions_get_request import TransactionsGetRequest
        
        configuration = plaid.Configuration(
            host=getattr(plaid.Environment, settings.PLAID_ENV, plaid.Environment.Sandbox),
            api_key={
                'clientId': settings.PLAID_CLIENT_ID,
                'secret': settings.PLAID_SECRET,
            }
        )
        
        api_client = plaid.ApiClient(configuration)
        client = plaid_api.PlaidApi(api_client)
        
        credentials = integration.credentials or {}
        access_token = credentials.get('access_token')
        
        if not access_token:
            raise ValueError("No Plaid access token")
        
        # Get accounts
        accounts_request = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_request)
        
        for account_data in accounts_response['accounts']:
            account, _ = BankAccount.objects.update_or_create(
                organization=integration.organization,
                integration=integration,
                plaid_account_id=account_data['account_id'],
                defaults={
                    'institution_name': account_data.get('institution_name', ''),
                    'name': account_data['name'],
                    'account_type': account_data.get('subtype') or account_data['type'],
                    'mask': account_data.get('mask'),
                    'plaid_item_id': credentials.get('item_id'),
                    'is_active': True
                }
            )
        
        # Get transactions from last 30 days
        from datetime import date, timedelta
        
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        
        transactions_request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date,
            end_date=end_date
        )
        transactions_response = client.transactions_get(transactions_request)
        
        known_vendors = [
            'slack', 'zoom', 'salesforce', 'hubspot', 'jira', 'atlassian',
            'github', 'aws', 'azure', 'google', 'microsoft', 'notion',
            'figma', 'adobe', 'dropbox', 'asana', 'monday', 'mailchimp'
        ]
        
        transactions_created = 0
        
        for txn in transactions_response['transactions']:
            # Check if this looks like a subscription payment
            merchant = (txn.get('merchant_name') or txn.get('name', '')).lower()
            is_subscription = any(kw in merchant for kw in known_vendors)
            
            account = BankAccount.objects.filter(
                plaid_account_id=txn['account_id']
            ).first()
            
            if account:
                transaction, created = BankTransaction.objects.update_or_create(
                    organization=integration.organization,
                    bank_account=account,
                    external_id=txn['transaction_id'],
                    defaults={
                        'transaction_date': txn['date'],
                        'amount': abs(txn['amount']),
                        'currency': txn.get('iso_currency_code', 'USD'),
                        'merchant_name': txn.get('merchant_name'),
                        'description': txn.get('name', ''),
                        'category': 'software' if is_subscription else 'uncategorized',
                        'is_subscription_related': is_subscription,
                        'raw_data': txn,
                    }
                )
                
                if created:
                    transactions_created += 1
                
                # Try to match to existing subscription
                if is_subscription and not transaction.subscription:
                    matched = Subscription.objects.filter(
                        organization=integration.organization,
                        name__icontains=merchant
                    ).first()
                    
                    if matched:
                        transaction.subscription = matched
                        transaction.is_matched = True
                        transaction.match_confidence = 0.7
                        transaction.matched_by = 'rule'
                        transaction.save(update_fields=[
                            'subscription', 'is_matched', 'match_confidence', 'matched_by'
                        ])
        
        integration.last_sync_at = timezone.now()
        integration.save()
        
        return {
            'items': transactions_created,
            'data': {
                'accounts': len(accounts_response['accounts']),
                'transactions': transactions_created
            }
        }
        
    except Integration.DoesNotExist:
        logger.error(f"Integration {integration_id} not found")
    except Exception as e:
        logger.error(f"Plaid sync failed: {e}")
        self.retry(countdown=_backoff_seconds(self.request.retries))


@shared_task
def scan_emails(email_config_id):
    """Scan emails for subscription receipts"""
    from integrations.models import EmailScanConfig
    from services.models import Subscription, SoftwareVendor
    
    try:
        config = EmailScanConfig.objects.select_related('integration').get(id=email_config_id)
        integration = config.integration
        
        credentials = integration.credentials or {}
        access_token = credentials.get('access_token')
        
        if not access_token:
            raise ValueError("No access token")
        
        # Determine provider
        if integration.type == 'google_workspace':
            subscriptions = scan_gmail(access_token, config)
        elif integration.type == 'microsoft_365':
            subscriptions = scan_outlook(access_token, config)
        else:
            raise ValueError(f"Unsupported email provider: {integration.type}")
        
        # Create subscriptions from findings
        for sub_data in subscriptions:
            vendor, _ = SoftwareVendor.objects.get_or_create(
                name=sub_data['vendor_name'],
                defaults={'category': sub_data.get('category', 'other')}
            )
            
            Subscription.objects.get_or_create(
                organization=integration.organization,
                name=sub_data['vendor_name'],
                defaults={
                    'vendor': vendor,
                    'status': 'active',
                    'billing_cycle': sub_data.get('billing_cycle', 'monthly'),
                    'monthly_cost': sub_data.get('amount'),
                    'discovery_source': 'email_scan'
                }
            )
        
        config.last_scan_at = timezone.now()
        config.save()
        
        logger.info(f"Email scan found {len(subscriptions)} subscriptions")
        
        return {'items': len(subscriptions)}
        
    except EmailScanConfig.DoesNotExist:
        logger.error(f"Email config {email_config_id} not found")
    except Exception as e:
        logger.error(f"Email scan failed: {e}")


def scan_gmail(access_token, config):
    """Scan Gmail for subscription emails"""
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Build search query
    query_parts = []
    
    for pattern in (config.sender_patterns or []):
        query_parts.append(f"from:{pattern}")
    
    for pattern in (config.subject_patterns or []):
        query_parts.append(f"subject:{pattern}")
    
    if not query_parts:
        query_parts = [
            'subject:receipt',
            'subject:invoice',
            'subject:subscription'
        ]
    
    query = ' OR '.join(query_parts)
    
    response = requests.get(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages',
        headers=headers,
        params={'q': query, 'maxResults': 100}
    )
    
    subscriptions = []
    
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        
        for msg in messages[:50]:  # Limit processing
            msg_response = requests.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}",
                headers=headers,
                params={'format': 'metadata', 'metadataHeaders': ['From', 'Subject']}
            )
            
            if msg_response.status_code == 200:
                msg_data = msg_response.json()
                headers_data = {h['name']: h['value'] for h in msg_data.get('payload', {}).get('headers', [])}
                
                # Extract vendor from sender
                from_header = headers_data.get('From', '')
                vendor_name = extract_vendor_name(from_header)
                
                if vendor_name and vendor_name not in [s['vendor_name'] for s in subscriptions]:
                    subscriptions.append({
                        'vendor_name': vendor_name,
                        'category': 'other'
                    })
    
    return subscriptions


def scan_outlook(access_token, config):
    """Scan Outlook for subscription emails"""
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Build search query
    filter_parts = []
    
    for pattern in (config.subject_patterns or ['receipt', 'invoice', 'subscription']):
        filter_parts.append(f"contains(subject, '{pattern}')")
    
    filter_query = ' or '.join(filter_parts)
    
    response = requests.get(
        'https://graph.microsoft.com/v1.0/me/messages',
        headers=headers,
        params={
            '$filter': filter_query,
            '$top': 100,
            '$select': 'from,subject'
        }
    )
    
    subscriptions = []
    
    if response.status_code == 200:
        messages = response.json().get('value', [])
        
        for msg in messages:
            from_data = msg.get('from', {}).get('emailAddress', {})
            vendor_name = extract_vendor_name(from_data.get('address', ''))
            
            if vendor_name and vendor_name not in [s['vendor_name'] for s in subscriptions]:
                subscriptions.append({
                    'vendor_name': vendor_name,
                    'category': 'other'
                })
    
    return subscriptions


def extract_vendor_name(email_or_name):
    """Extract vendor name from email address or name"""
    import re
    
    # Remove common email suffixes
    email_or_name = re.sub(r'@.*$', '', email_or_name)
    email_or_name = re.sub(r'<.*>', '', email_or_name).strip()
    
    # Known vendor patterns
    vendor_patterns = {
        r'slack': 'Slack',
        r'zoom': 'Zoom',
        r'salesforce': 'Salesforce',
        r'hubspot': 'HubSpot',
        r'atlassian|jira|confluence': 'Atlassian',
        r'github': 'GitHub',
        r'amazon|aws': 'AWS',
        r'google': 'Google',
        r'microsoft': 'Microsoft',
        r'notion': 'Notion',
        r'figma': 'Figma',
        r'adobe': 'Adobe',
        r'dropbox': 'Dropbox',
    }
    
    for pattern, name in vendor_patterns.items():
        if re.search(pattern, email_or_name.lower()):
            return name
    
    # Capitalize and return
    if email_or_name:
        return email_or_name.title()
    
    return None


@shared_task(bind=True, max_retries=3)
def send_webhook(self, webhook_id, event_type, payload):
    """Send webhook to external URL"""
    from integrations.models import Webhook, WebhookDelivery
    import hmac
    import hashlib
    
    try:
        webhook = Webhook.objects.get(id=webhook_id)
        
        if not webhook.is_active:
            return
        
        if event_type not in (webhook.events or []):
            return
        
        # Prepare payload
        payload_json = json.dumps(payload)
        
        # Sign payload
        signature = hmac.new(
            webhook.secret.encode(),
            payload_json.encode(),
            hashlib.sha256
        ).hexdigest()
        
        headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': f'sha256={signature}',
            'X-Event-Type': event_type
        }
        
        # Send request
        start_time = timezone.now()
        
        try:
            response = requests.post(
                webhook.url,
                data=payload_json,
                headers=headers,
                timeout=30
            )
            
            duration = (timezone.now() - start_time).total_seconds() * 1000
            
            # Create delivery record
            WebhookDelivery.objects.create(
                webhook=webhook,
                event_type=event_type,
                payload=payload,
                response_status=response.status_code,
                response_body=response.text[:1000],
                duration_ms=int(duration),
                success=200 <= response.status_code < 300,
                attempt_count=1
            )
            
            if 200 <= response.status_code < 300:
                webhook.failure_count = 0
            else:
                webhook.failure_count += 1
            
            webhook.last_triggered_at = timezone.now()
            webhook.save()
            
        except requests.RequestException as e:
            duration = (timezone.now() - start_time).total_seconds() * 1000
            
            WebhookDelivery.objects.create(
                webhook=webhook,
                event_type=event_type,
                payload=payload,
                response_status=0,
                response_body=str(e),
                duration_ms=int(duration),
                success=False,
                attempt_count=1
            )
            
            webhook.failure_count += 1
            webhook.save()
            
            raise
        
    except Webhook.DoesNotExist:
        logger.error(f"Webhook {webhook_id} not found")
    except Exception as e:
        logger.error(f"Webhook delivery failed: {e}")
        self.retry(countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def send_slack_notification(self, slack_notification_id, message, attachments=None):
    """Send Slack notification"""
    from integrations.models import SlackNotification
    
    try:
        notification = SlackNotification.objects.get(id=slack_notification_id)
        
        if not notification.is_active:
            return
        
        payload = {
            'channel': notification.channel_id or notification.channel_name,
            'text': message
        }
        
        if attachments:
            payload['attachments'] = attachments
        
        response = requests.post(
            notification.webhook_url,
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            raise ValueError(f"Slack API error: {response.text}")
        
        logger.info(f"Slack notification sent to {notification.channel_name}")
        
    except SlackNotification.DoesNotExist:
        logger.error(f"Slack notification {slack_notification_id} not found")
    except Exception as e:
        logger.error(f"Slack notification failed: {e}")
        self.retry(countdown=30)


def sync_slack(integration):
    """Sync Slack workspace data"""
    # Placeholder - would sync workspace users, channels, etc.
    return {'items': 0, 'data': {}}


def sync_okta(integration):
    """Sync Okta users and apps"""
    # Placeholder - would sync via Okta API
    return {'items': 0, 'data': {}}


def sync_azure_ad(integration):
    """Sync Azure AD users and apps"""
    # Placeholder - would sync via Azure AD Graph API
    return {'items': 0, 'data': {}}


def scan_emails_for_subscriptions(integration):
    """Wrapper for email scanning"""
    from integrations.models import EmailScanConfig
    
    configs = EmailScanConfig.objects.filter(integration=integration, enabled=True)
    total_items = 0
    
    for config in configs:
        result = scan_emails(str(config.id))
        total_items += result.get('items', 0) if result else 0
    
    return {'items': total_items, 'data': {}}


def test_google_workspace(integration):
    """Test Google Workspace connection"""
    credentials = integration.credentials or {}
    access_token = credentials.get('access_token')
    
    if not access_token:
        return {'success': False, 'error': 'No access token'}
    
    response = requests.get(
        'https://admin.googleapis.com/admin/directory/v1/users',
        headers={'Authorization': f'Bearer {access_token}'},
        params={'customer': 'my_customer', 'maxResults': 1},
        timeout=15,
    )
    
    if response.status_code == 200:
        return {'success': True, 'message': 'Connection successful'}
    
    return {'success': False, 'error': f'API error: {response.status_code}'}


def test_microsoft_365(integration):
    """Test Microsoft 365 connection"""
    credentials = integration.credentials or {}
    access_token = credentials.get('access_token')
    
    if not access_token:
        return {'success': False, 'error': 'No access token'}
    
    response = requests.get(
        'https://graph.microsoft.com/v1.0/me',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=15,
    )
    
    if response.status_code == 200:
        return {'success': True, 'message': 'Connection successful'}
    
    return {'success': False, 'error': f'API error: {response.status_code}'}


def test_plaid(integration):
    """Test Plaid connection"""
    credentials = integration.credentials or {}
    access_token = credentials.get('access_token')
    
    if not access_token:
        return {'success': False, 'error': 'No access token'}
    
    # Would use Plaid API to test connection
    return {'success': True, 'message': 'Connection configured'}


def test_slack(integration):
    """Test Slack connection"""
    config = integration.config or {}
    webhook_url = config.get('webhook_url')
    
    if not webhook_url:
        return {'success': False, 'error': 'No webhook URL configured'}
    
    response = requests.post(
        webhook_url,
        json={'text': 'Test connection from SWM'},
        timeout=10
    )
    
    if response.status_code == 200:
        return {'success': True, 'message': 'Connection successful'}
    
    return {'success': False, 'error': f'Webhook error: {response.status_code}'}
