"""Authenticated closure intake; actual erasure is an operator-controlled process."""
import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.models import ClosureRequest, Organization, User, AuditLog


def email_hash(user):
    return hashlib.sha256(user.email.strip().lower().encode()).hexdigest()


class ClosureRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClosureRequest
        fields = ['id', 'scope', 'status', 'identity_verified_at', 'eligible_at', 'public_notes',
                  'billing_closed_at', 'production_data_deleted_at', 'retention_notes',
                  'retained_data_expires_at', 'completed_at', 'created_at', 'updated_at']
        read_only_fields = fields


class ClosureIntakeSerializer(serializers.Serializer):
    scope = serializers.ChoiceField(choices=['account', 'workspace'])
    confirmation = serializers.CharField(max_length=300)


def send_confirmation(closure, user):
    if closure.confirmation_sent_at and closure.confirmation_sent_at > timezone.now() - timedelta(seconds=60):
        raise ValidationError('Wait one minute before requesting another confirmation email.')
    token = secrets.token_urlsafe(32)
    closure.confirmation_hash = hashlib.sha256(token.encode()).hexdigest()
    closure.confirmation_expires_at = timezone.now() + timedelta(hours=24)
    closure.identity_email_hash = email_hash(user)
    closure.confirmation_sent_at = timezone.now()
    closure.save()
    url = f'{settings.FRONTEND_URL.rstrip("/")}/settings/closure?request={closure.pk}&token={token}'
    try:
        send_mail('Confirm your closure request',
                  f'You requested closure of your {closure.scope}. Sign in and confirm using this link within 24 hours:\n{url}\n'
                  'After confirmation there is a 7-day cancellation window. No data has been deleted. '
                  'If you did not request this, cancel it in Settings > Data and closure.',
                  settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
    except Exception:
        return False
    return True


class ClosureRequestViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ClosureRequestSerializer
    pagination_class = None

    def get_queryset(self):
        return ClosureRequest.objects.filter(requested_by=self.request.user)

    def list(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        return Response(self.get_serializer(self.get_object()).data)

    def create(self, request):
        data = ClosureIntakeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        scope = data.validated_data['scope']
        user = request.user
        if scope == 'workspace' and not user.is_admin:
            raise PermissionDenied('Only a workspace admin can request workspace closure.')
        expected = f'DELETE {user.organization.slug}' if scope == 'workspace' and user.organization else 'DELETE ACCOUNT'
        if data.validated_data['confirmation'] != expected:
            raise ValidationError({'confirmation': f'Type {expected} to request closure.'})
        if not user.organization_id:
            raise ValidationError('Contact support to close an account without a workspace.')
        with transaction.atomic():
            Organization.objects.select_for_update().get(pk=user.organization_id)
            if scope == 'account' and user.is_admin and not User.objects.filter(organization=user.organization, is_active=True, role__type='admin').exclude(pk=user.pk).exists():
                raise ValidationError('Assign another active workspace admin before closing your account, or request closure of the whole workspace.')
            if ClosureRequest.objects.filter(status__in=['awaiting_confirmation', 'scheduled', 'processing', 'blocked']).filter(
                    requested_by=user, scope=scope).exists():
                raise ValidationError('An open request already exists. View it below or resend its confirmation.')
            if scope == 'workspace' and ClosureRequest.objects.filter(organization=user.organization, scope=scope, status__in=['awaiting_confirmation', 'scheduled', 'processing', 'blocked']).exists():
                raise ValidationError('A workspace closure request is already open. Contact the requesting admin or support.')
            closure = ClosureRequest.objects.create(organization=user.organization, requested_by=user, scope=scope)
            AuditLog.objects.create(organization=user.organization, user=user, action='closure.requested', resource_type='closure_request', resource_id=str(closure.pk), metadata={'scope': scope})
        sent = send_confirmation(closure, user)
        return Response({**self.get_serializer(closure).data, 'confirmation_email_sent': sent}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        closure = self.get_object()
        if closure.status != 'awaiting_confirmation':
            raise ValidationError('This request no longer needs email confirmation.')
        return Response({'confirmation_email_sent': send_confirmation(closure, request.user)})

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        self.get_object()
        with transaction.atomic():
            closure = self.get_queryset().select_for_update().get(pk=pk)
            token = request.data.get('token')
            if not isinstance(token, str) or len(token) > 200:
                raise ValidationError('Invalid confirmation link.')
            valid = (closure.status == 'awaiting_confirmation' and closure.confirmation_hash
                     and secrets.compare_digest(closure.confirmation_hash, hashlib.sha256(token.encode()).hexdigest())
                     and closure.confirmation_expires_at and closure.confirmation_expires_at > timezone.now()
                     and closure.identity_email_hash == email_hash(request.user))
            if not valid:
                raise ValidationError('This link is expired, used, or does not match your account. Request a new link.')
            if closure.scope == 'workspace' and (not request.user.is_admin or closure.organization_id != request.user.organization_id):
                raise PermissionDenied('Workspace admin access is required.')
            closure.status = 'scheduled'
            closure.identity_verified_at = timezone.now()
            closure.eligible_at = timezone.now() + timedelta(days=7)
            closure.confirmation_hash = ''
            closure.save()
        return Response(self.get_serializer(closure).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        self.get_object()
        with transaction.atomic():
            closure = self.get_queryset().select_for_update().get(pk=pk)
            if closure.status not in ('awaiting_confirmation', 'scheduled', 'blocked'):
                raise ValidationError('This request cannot be cancelled here. Contact support if processing has begun.')
            closure.status = 'cancelled'
            closure.confirmation_hash = ''
            closure.save()
        return Response(self.get_serializer(closure).data)
