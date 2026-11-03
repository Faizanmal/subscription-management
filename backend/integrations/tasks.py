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
        credentials['expires_in'] = str(payload['expires_in'])
    integration.save_credentials(credentials)
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
        credentials['expires_in'] = str(payload['expires_in'])
    integration.save_credentials(credentials)
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
                'teams': sync_teams,
                'quickbooks': sync_quickbooks,
                'xero': sync_xero,
                'workday': sync_workday,
                'bamboohr': sync_bamboohr,
                'gusto': sync_gusto,
                'rippling': sync_rippling,
                'concur': sync_concur,
                'expensify': sync_expensify,
                'brex': sync_brex,
                'ramp': sync_ramp,
                'onelogin': sync_onelogin,
                'jumpcloud': sync_jumpcloud,
            }
            
            handler = handlers.get(integration.type)
            if handler:
                result = handler(integration) or {}
                sync.records_processed = result.get('items', 0)
                sync.sync_data = result.get('data', {})
                sync.status = IntegrationSync.Status.COMPLETED
            else:
                sync.status = IntegrationSync.Status.FAILED
                sync.error_message = f"No handler for integration type: {integration.type}"
            
            sync.completed_at = timezone.now()
            sync.save()
            
            integration.last_sync = timezone.now()
            integration.last_sync_status = 'success' if sync.status == IntegrationSync.Status.COMPLETED else 'failed'
            integration.last_sync_error = sync.error_message
            integration.save(update_fields=['last_sync', 'last_sync_status', 'last_sync_error', 'updated_at'])
            
        except Exception as e:
            sync.status = IntegrationSync.Status.FAILED
            sync.error_message = str(e)
            sync.completed_at = timezone.now()
            sync.save()
            
            integration.last_sync_error = str(e)
            integration.last_sync_status = 'failed'
            integration.save(update_fields=['last_sync_error', 'last_sync_status', 'updated_at'])
            
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
        elif integration.type == 'teams':
            result = test_teams(integration)
        elif integration.type == 'okta':
            result = {'success': bool(integration.get_decrypted_credentials()), 'message': 'Credentials present'}
        elif integration.type == 'azure_ad':
            result = {'success': bool(integration.get_decrypted_credentials()), 'message': 'Credentials present'}
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
    
    credentials = integration.get_decrypted_credentials()
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
    
    credentials = integration.get_decrypted_credentials()
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
        
        credentials = integration.get_decrypted_credentials()
        access_token = credentials.get('access_token')
        
        if not access_token:
            raise ValueError("No Plaid access token")
        
        # Get accounts
        accounts_request = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_request)
        
        for account_data in accounts_response['accounts']:
            raw_type = str(
                account_data.get('subtype') or account_data.get('type') or 'checking'
            ).lower().replace(' ', '_')
            if raw_type not in {'checking', 'savings', 'credit_card', 'debit_card', 'corporate_card'}:
                if 'credit' in raw_type:
                    raw_type = 'credit_card'
                elif 'saving' in raw_type:
                    raw_type = 'savings'
                else:
                    raw_type = 'checking'
            account, _ = BankAccount.objects.update_or_create(
                organization=integration.organization,
                integration=integration,
                plaid_account_id=account_data['account_id'],
                defaults={
                    'institution_name': account_data.get('institution_name') or '',
                    'name': account_data['name'],
                    'account_type': raw_type,
                    'mask': account_data.get('mask') or '',
                    'plaid_item_id': credentials.get('item_id'),
                    'is_active': True,
                    'last_sync': timezone.now(),
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
        
        integration.last_sync = timezone.now()
        integration.save(update_fields=['last_sync', 'updated_at'])
        
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
        
        credentials = integration.get_decrypted_credentials()
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
        
        config.last_scan = timezone.now()
        config.save(update_fields=['last_scan', 'updated_at'])
        
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
            ok = 200 <= response.status_code < 300

            WebhookDelivery.objects.create(
                webhook=webhook,
                event_type=event_type,
                payload=payload,
                status=WebhookDelivery.Status.SUCCESS if ok else WebhookDelivery.Status.FAILED,
                response_status=response.status_code,
                response_body=response.text[:1000],
                attempts=1,
                delivered_at=timezone.now() if ok else None,
            )

            webhook.total_deliveries += 1
            if ok:
                webhook.successful_deliveries += 1
                webhook.last_success = timezone.now()
            else:
                webhook.failed_deliveries += 1
                webhook.last_failure = timezone.now()
                webhook.last_error = response.text[:500]
            webhook.last_triggered = timezone.now()
            webhook.save()
            
        except requests.RequestException as e:
            duration = (timezone.now() - start_time).total_seconds() * 1000
            
            WebhookDelivery.objects.create(
                webhook=webhook,
                event_type=event_type,
                payload=payload,
                status=WebhookDelivery.Status.FAILED,
                response_status=0,
                response_body=str(e)[:1000],
                attempts=1,
            )

            webhook.total_deliveries += 1
            webhook.failed_deliveries += 1
            webhook.last_failure = timezone.now()
            webhook.last_error = str(e)[:500]
            webhook.last_triggered = timezone.now()
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
        notification = SlackNotification.objects.select_related('integration').get(id=slack_notification_id)
        
        if not notification.is_active:
            return
        
        payload = {
            'channel': notification.channel_id or notification.channel_name,
            'text': message
        }
        
        if attachments:
            payload['attachments'] = attachments
        
        integration = notification.integration
        creds = integration.get_decrypted_credentials() if integration else {}
        webhook_url = (creds or {}).get('webhook_url') or (integration.config or {}).get('webhook_url')
        if not webhook_url:
            raise ValueError('No Slack webhook URL configured')

        response = requests.post(
            webhook_url,
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
    # Incoming-webhook integrations have no directory sync.
    return {'items': 0, 'data': {'status': 'webhook_only'}}


def sync_teams(integration):
    """Sync Microsoft Teams — webhook-only connector has no directory sync."""
    return {'items': 0, 'data': {'status': 'webhook_only'}}


def sync_okta(integration):
    """Sync Okta apps into SSO connections."""
    from integrations.models import SSOConnection

    credentials = integration.get_decrypted_credentials()
    domain = credentials.get('domain') or (integration.config or {}).get('domain')
    api_token = credentials.get('api_token')
    if not domain or not api_token:
        raise ValueError('Okta domain or API token missing')

    response = requests.get(
        f'https://{domain}/api/v1/apps',
        headers={'Authorization': f'SSWS {api_token}', 'Accept': 'application/json'},
        params={'limit': 200},
        timeout=30,
    )
    if response.status_code != 200:
        raise ValueError(f'Okta API error: {response.status_code}')

    apps = response.json() if isinstance(response.json(), list) else []
    created = 0
    for app in apps:
        app_id = str(app.get('id') or '')[:255]
        if not app_id:
            continue
        _, was_created = SSOConnection.objects.update_or_create(
            organization=integration.organization,
            integration=integration,
            app_id=app_id,
            defaults={
                'app_name': app.get('label') or app.get('name') or 'Okta app',
                'app_type': app.get('signOnMode') or '',
                'is_active': app.get('status') == 'ACTIVE',
            },
        )
        if was_created:
            created += 1
    return {'items': len(apps), 'data': {'apps': len(apps), 'created': created}}


def sync_azure_ad(integration):
    """Sync Azure AD enterprise apps into SSO connections."""
    from integrations.models import SSOConnection

    credentials = integration.get_decrypted_credentials()
    tenant_id = credentials.get('tenant_id')
    client_id = credentials.get('client_id')
    client_secret = credentials.get('client_secret')
    access_token = credentials.get('access_token')

    if client_id and client_secret and tenant_id:
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
        if token_response.status_code == 200:
            access_token = token_response.json().get('access_token')
            credentials['access_token'] = access_token
            integration.save_credentials(credentials)

    if not access_token:
        raise ValueError('No Azure AD access token available')

    response = requests.get(
        'https://graph.microsoft.com/v1.0/servicePrincipals',
        headers={'Authorization': f'Bearer {access_token}'},
        params={
            '$top': 100,
            '$select': 'id,appDisplayName,appId,accountEnabled,preferredSingleSignOnMode',
        },
        timeout=30,
    )
    if response.status_code != 200:
        raise ValueError(f'Microsoft Graph error: {response.status_code}')

    principals = response.json().get('value') or []
    created = 0
    for app in principals:
        name = app.get('appDisplayName') or ''
        if not name:
            continue
        app_id = str(app.get('appId') or app.get('id') or '')[:255]
        _, was_created = SSOConnection.objects.update_or_create(
            organization=integration.organization,
            integration=integration,
            app_id=app_id,
            defaults={
                'app_name': name[:255],
                'app_type': app.get('preferredSingleSignOnMode') or 'azure_ad',
                'is_active': bool(app.get('accountEnabled', True)),
            },
        )
        if was_created:
            created += 1
    return {'items': len(principals), 'data': {'apps': len(principals), 'created': created}}


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
    credentials = integration.get_decrypted_credentials()
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
    credentials = integration.get_decrypted_credentials()
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
    credentials = integration.get_decrypted_credentials()
    access_token = credentials.get('access_token')
    
    if not access_token:
        return {'success': False, 'error': 'No access token'}
    
    # Would use Plaid API to test connection
    return {'success': True, 'message': 'Connection configured'}


def _integration_webhook_url(integration):
    creds = integration.get_decrypted_credentials() or {}
    return creds.get('webhook_url') or (integration.config or {}).get('webhook_url')


def test_slack(integration):
    """Test Slack connection"""
    webhook_url = _integration_webhook_url(integration)
    
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


def test_teams(integration):
    """Test Microsoft Teams incoming webhook"""
    webhook_url = _integration_webhook_url(integration)
    if not webhook_url:
        return {'success': False, 'error': 'No webhook URL configured'}
    response = requests.post(
        webhook_url,
        json={'text': 'Test connection from SWM'},
        timeout=10,
    )
    if response.status_code in (200, 202):
        return {'success': True, 'message': 'Connection successful'}
    return {'success': False, 'error': f'Webhook error: {response.status_code}'}

def sync_workday(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_bamboohr(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_gusto(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_rippling(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_concur(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_expensify(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_brex(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_ramp(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_onelogin(integration): return {'items': 0, 'data': {'status': 'mocked'}}
def sync_jumpcloud(integration): return {'items': 0, 'data': {'status': 'mocked'}}


@shared_task
def sync_all_integrations():
    """Periodic sync for all connected, sync-enabled launch integrations."""
    from integrations.models import Integration
    from users.plans import FEATURE_DISCOVERY_SYNC, has_feature

    launch_types = [
        'google_workspace',
        'microsoft_365',
        'plaid',
        'okta',
        'azure_ad',
    ]
    integrations = Integration.objects.filter(
        status=Integration.Status.CONNECTED,
        sync_enabled=True,
        type__in=launch_types,
    ).select_related('organization')
    queued = 0
    for integration in integrations:
        if not has_feature(integration.organization, FEATURE_DISCOVERY_SYNC):
            continue
        sync_integration.delay(str(integration.id))
        queued += 1
    logger.info('Queued sync for %s integrations', queued)
    return {'queued': queued}
