"""A one-use, browser-bound handoff from provider OAuth to frontend JWT auth."""

import base64
import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import logout
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import Role, SocialLoginCode, User
from users.serializers import OrganizationCreateSerializer, OrganizationSerializer, UserSerializer


def verifier_challenge(verifier):
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')


def social_complete(request):
    challenge = request.session.pop('swm_challenge', '')
    user = request.user
    target = f'{settings.FRONTEND_URL}/login?social=error'
    if user.is_authenticated and user.is_active and re.fullmatch(r'[A-Za-z0-9_-]{43}', challenge):
        if user.mfa_devices.filter(device_type='totp', is_verified=True).exists():
            target = f'{settings.FRONTEND_URL}/login?social=mfa'
        else:
            code = secrets.token_urlsafe(32)
            now = timezone.now()
            SocialLoginCode.objects.filter(expires_at__lt=now - timedelta(days=1)).delete()
            SocialLoginCode.objects.create(code_hash=hashlib.sha256(code.encode()).hexdigest(), user=user, challenge=challenge, expires_at=now + timedelta(seconds=90))
            target = f'{settings.FRONTEND_URL}/auth/callback?code={code}'
    logout(request)
    response = HttpResponseRedirect(target)
    response['Cache-Control'] = 'no-store'
    response['Referrer-Policy'] = 'no-referrer'
    return response


class SocialExchangeView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        code, verifier = request.data.get('code', ''), request.data.get('verifier', '')
        if not isinstance(code, str) or not isinstance(verifier, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', code) or not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', verifier):
            return Response({'error': 'Restart social sign-in from this browser.'}, status=400)
        record = SocialLoginCode.objects.select_for_update().select_related('user').filter(pk=hashlib.sha256(code.encode()).hexdigest()).first()
        if not record or record.used_at or record.expires_at <= timezone.now() or not constant_time_compare(record.challenge, verifier_challenge(verifier)):
            return Response({'error': 'Social sign-in expired or could not be verified. Start again.'}, status=400)
        user = record.user
        if not user.is_active or user.mfa_devices.filter(device_type='totp', is_verified=True).exists():
            return Response({'error': 'Use email and authenticator sign-in for this account.'}, status=400)
        record.used_at = timezone.now()
        record.save(update_fields=['used_at'])
        refresh = RefreshToken.for_user(user)
        refresh['mfa'] = False
        response = Response({'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}, 'user': UserSerializer(user).data})
        response['Cache-Control'] = 'no-store'
        return response


class StartOrganizationView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if user.organization_id:
            return Response({'error': 'This account already belongs to an organization.'}, status=409)
        serializer = OrganizationCreateSerializer(data={'name': request.data.get('name'), 'default_currency': request.data.get('currency', 'USD')})
        serializer.is_valid(raise_exception=True)
        org = serializer.save()
        for role_type, name in [('admin', 'Admin'), ('finance', 'Finance'), ('department_lead', 'Department lead'), ('member', 'Member'), ('viewer', 'Viewer')]:
            role = Role.objects.create(organization=org, type=role_type, name=name, is_system_role=True)
            if role_type == 'admin':
                user.role = role
        user.organization = org
        user.save(update_fields=['role', 'organization'])
        return Response({'organization': OrganizationSerializer(org).data, 'user': UserSerializer(user).data}, status=201)
