"""Proof of mailbox ownership; legacy is_verified flags alone are not proof."""
import hashlib
import logging
import secrets
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from users.models import EmailVerification, User

logger = logging.getLogger('swm')

def verification_required(user):
    return getattr(settings, 'ENFORCE_EMAIL_VERIFICATION', True) and not user.email_verified_at

def send_verification(user):
    """Serialize sends per user. Never store or log the raw link token."""
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        if user.email_verified_at:
            return 'verified'
        now = timezone.now()
        if user.email_verifications.filter(created_at__gt=now - timedelta(seconds=60)).exists():
            return 'cooldown'
        user.email_verifications.filter(expires_at__lt=now - timedelta(days=7)).delete()
        code = secrets.token_urlsafe(32)
        EmailVerification.objects.create(user=user, email=user.email, code_hash=hashlib.sha256(code.encode()).hexdigest(), expires_at=now + timedelta(hours=24))
        try:
            sent = send_mail('Verify your SWM email address', f'Confirm your email address to continue using Subscription Waste Manager. This link expires in 24 hours.\n\n{settings.FRONTEND_URL}/verify-email?token={code}\n\nIf you did not create this account, ignore this email.', settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            if not sent:
                raise RuntimeError('No email accepted')
        except Exception:
            # Keep the cooldown record to prevent a failing sender being flooded.
            logger.warning('Verification email delivery failed; retry is available after cooldown')
            return 'failed'
        return 'sent'

def send_initial_verification(user_id):
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user:
        send_verification(user)

class VerificationRequestView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        outcome = send_verification(request.user)
        if outcome == 'cooldown':
            response = Response({'error': 'Wait one minute before requesting another email.'}, status=429)
            response['Retry-After'] = '60'
            return response
        if outcome == 'failed':
            return Response({'error': 'Email could not be sent. Wait one minute, then retry or contact support.'}, status=503)
        return Response({'message': 'Your address is already verified.' if outcome == 'verified' else 'Verification email sent. Check your inbox and spam folder.'})

class VerificationConfirmView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    @transaction.atomic
    def post(self, request):
        code = request.data.get('token')
        if not isinstance(code, str) or len(code) != 43:
            return Response({'error': 'This verification link is invalid or expired. Request a new email.'}, status=400)
        record = EmailVerification.objects.select_for_update().filter(pk=hashlib.sha256(code.encode()).hexdigest()).first()
        if not record or record.used_at or record.expires_at <= timezone.now():
            return Response({'error': 'This verification link is invalid or expired. Request a new email.'}, status=400)
        user = User.objects.select_for_update().get(pk=record.user_id)
        if not user.is_active or user.email != record.email:
            return Response({'error': 'This verification link is invalid or expired. Request a new email.'}, status=400)
        now = timezone.now()
        user.email_verified_at = now
        user.is_verified = True
        user.save(update_fields=['email_verified_at', 'is_verified'])
        record.used_at = now
        record.save(update_fields=['used_at'])
        response = Response({'message': 'Email address verified. You can continue in the account that requested this email.'})
        response['Cache-Control'] = 'no-store'
        return response
