"""
Social auth pipeline for users app
"""

from users.models import Organization, Role, User


def get_or_create_user(strategy, details, backend, user=None, *args, **kwargs):
    """Create or reuse a local user from social-auth details (email is the username)."""
    if user:
        return {'is_new': False}

    email = (details.get('email') or '').strip().lower()
    if not email:
        return None

    existing = User.objects.filter(email__iexact=email).first()
    if existing:
        return {'is_new': False, 'user': existing}

    new_user = User.objects.create_user(
        email=email,
        password=None,
        first_name=details.get('first_name') or '',
        last_name=details.get('last_name') or '',
    )
    new_user.set_unusable_password()
    new_user.save(update_fields=['password'])
    return {'is_new': True, 'user': new_user}


def save_organization_info(backend, user, response, *args, **kwargs):
    """
    Pipeline step to handle organization info from social login.
    Called after user is created/updated.
    """
    if backend.name == 'google-oauth2':
        # Get domain from email for organization matching
        email = response.get('email', '')
        domain = email.split('@')[1] if '@' in email else None
        
        if domain and not user.organization:
            # Try to find existing organization with this domain
            try:
                org = Organization.objects.get(domain=domain)
                user.organization = org
                user.save()
            except Organization.DoesNotExist:
                pass
        
        # Update user info
        if not user.first_name and response.get('given_name'):
            user.first_name = response.get('given_name')
        if not user.last_name and response.get('family_name'):
            user.last_name = response.get('family_name')
        if response.get('picture'):
            user.avatar_url = response.get('picture')
        
        user.save()
    
    elif backend.name in ('azuread-oauth2', 'microsoft-graph', 'microsoft-oauth2'):
        # Microsoft login
        email = response.get('mail') or response.get('userPrincipalName', '')
        domain = email.split('@')[1] if '@' in email else None
        
        if domain and not user.organization:
            try:
                org = Organization.objects.get(domain=domain)
                user.organization = org
                user.save()
            except Organization.DoesNotExist:
                pass
        
        # Update user info
        if not user.first_name and response.get('givenName'):
            user.first_name = response.get('givenName')
        if not user.last_name and response.get('surname'):
            user.last_name = response.get('surname')
        
        user.save()


def assign_default_role(backend, user, is_new, *args, **kwargs):
    """
    Pipeline step to assign default role to new users.
    """
    if is_new and user.organization and not user.role:
        default_role = Role.objects.filter(
            organization=user.organization,
            type=Role.RoleType.MEMBER,
        ).first()
        if default_role is None:
            default_role = Role.objects.create(
                organization=user.organization,
                name='Member',
                type=Role.RoleType.MEMBER,
                permissions={
                    'view_subscriptions': True,
                    'view_usage': True
                },
            )
        user.role = default_role
        user.save(update_fields=['role'])


def check_sso_connection(backend, user, response, *args, **kwargs):
    """
    Pipeline step to verify user is allowed via SSO configuration.
    """
    from integrations.models import SSOConnection
    
    if backend.name in ['google-oauth2', 'azuread-oauth2', 'microsoft-graph', 'microsoft-oauth2']:
        email = response.get('email', '') or response.get('mail', '')
        domain = email.split('@')[1] if '@' in email else None
        
        if domain:
            # Check if there's an SSO connection for this domain
            try:
                sso_conn = SSOConnection.objects.get(
                    domain=domain,
                    is_active=True
                )
                
                # Auto-provision user if enabled
                if sso_conn.auto_provision_users:
                    if not user.organization:
                        user.organization = sso_conn.organization
                    
                    if not user.role and sso_conn.default_role:
                        user.role = sso_conn.default_role
                    
                    if not user.department and sso_conn.default_department:
                        user.department = sso_conn.default_department
                    
                    user.save()
            except SSOConnection.DoesNotExist:
                pass


def create_audit_log(backend, user, is_new, *args, **kwargs):
    """
    Pipeline step to log social auth events.
    """
    from users.models import AuditLog
    
    if user.organization:
        action = 'user_registered' if is_new else 'user_login'
        AuditLog.objects.create(
            organization=user.organization,
            user=user,
            action=action,
            resource_type='User',
            resource_id=str(user.id),
            request_data={
                'backend': backend.name,
                'is_new': is_new
            }
        )


def sync_google_workspace_users(backend, user, response, *args, **kwargs):
    """
    Pipeline step to optionally sync user's Google Workspace info.
    """
    if backend.name == 'google-oauth2' and user.organization:
        from integrations.models import Integration
        
        # Check if org has Google Workspace integration
        try:
            Integration.objects.get(
                organization=user.organization,
                type='google_workspace',
                status='active'
            )
            
            # Update user metadata from Google
            user.metadata = user.metadata or {}
            user.metadata['google_workspace'] = {
                'id': response.get('sub'),
                'email': response.get('email'),
                'verified_email': response.get('email_verified'),
                'hd': response.get('hd')  # Hosted domain
            }
            user.save()
        except Integration.DoesNotExist:
            pass
