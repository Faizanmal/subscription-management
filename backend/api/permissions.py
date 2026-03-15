"""
API permissions for Subscription Waste Manager
"""

from rest_framework import permissions
from users.models import Role


class IsAdmin(permissions.BasePermission):
    """Permission for admin users only"""
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role and
            request.user.role.type == Role.RoleType.ADMIN
        )


class IsFinance(permissions.BasePermission):
    """Permission for finance/procurement users"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.type in [Role.RoleType.ADMIN, Role.RoleType.FINANCE]


class IsDepartmentLead(permissions.BasePermission):
    """Permission for department leads"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.type in [
            Role.RoleType.ADMIN,
            Role.RoleType.FINANCE,
            Role.RoleType.DEPARTMENT_LEAD
        ]


class IsOrgMember(permissions.BasePermission):
    """Permission for organization members"""
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.organization is not None
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """Permission for resource owner or admin"""
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin can access everything
        if request.user.role and request.user.role.type == Role.RoleType.ADMIN:
            return True
        
        # Check if user is owner
        if hasattr(obj, 'owner') and obj.owner == request.user:
            return True
        
        if hasattr(obj, 'user') and obj.user == request.user:
            return True
        
        return False


class ReadOnly(permissions.BasePermission):
    """Read-only permission"""
    
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class CanManageSubscriptions(permissions.BasePermission):
    """Permission to manage subscriptions"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read access for all org members
        if request.method in permissions.SAFE_METHODS:
            return request.user.organization is not None
        
        # Write access for admins, finance, and department leads
        if not request.user.role:
            return False
        
        return request.user.role.type in [
            Role.RoleType.ADMIN,
            Role.RoleType.FINANCE,
            Role.RoleType.DEPARTMENT_LEAD
        ]
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check same organization
        if hasattr(obj, 'organization') and obj.organization != request.user.organization:
            return False
        
        # Read access
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write access
        if not request.user.role:
            return False
        
        if request.user.role.type == Role.RoleType.ADMIN:
            return True
        
        if request.user.role.type == Role.RoleType.FINANCE:
            return True
        
        # Department leads can only manage their department's subscriptions
        if request.user.role.type == Role.RoleType.DEPARTMENT_LEAD:
            return hasattr(obj, 'department') and obj.department == request.user.department
        
        return False


class CanApproveWorkflows(permissions.BasePermission):
    """Permission to approve workflows"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        
        return request.user.role.type in [
            Role.RoleType.ADMIN,
            Role.RoleType.FINANCE,
            Role.RoleType.DEPARTMENT_LEAD
        ]


class HasAPIAccess(permissions.BasePermission):
    """Permission for API key access"""
    
    def has_permission(self, request, view):
        # Check for API key in header
        api_key = request.META.get('HTTP_X_API_KEY')
        if not api_key:
            return False
        
        from security.models import APIKey
        key_obj = APIKey.verify_key(api_key)
        
        if not key_obj:
            return False
        
        # Store API key on request for later use
        request.api_key = key_obj
        
        # Check scope
        if view.action in ['create', 'update', 'partial_update', 'destroy']:
            return key_obj.scope in ['write', 'admin']
        
        return True
