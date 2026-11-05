from rest_framework.exceptions import AuthenticationFailed
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


class MFAJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result:
            from users.policies import agreements_required
            allowed = {
                '/api/v1/auth/me/', '/api/v1/auth/me/password/', '/api/v1/auth/logout/',
                '/api/v1/auth/verification/request/', '/api/v1/auth/verification/confirm/',
                '/api/v1/auth/agreements/', '/api/v1/security/password/reset/',
                '/api/v1/security/password/reset/confirm/',
            }
            from users.verification import verification_required
            if request.path not in allowed and verification_required(result[0]):
                raise PermissionDenied({'detail': 'Verify your email address to continue.', 'code': 'email_verification_required'})
            if request.path not in allowed and agreements_required(result[0]):
                raise PermissionDenied({'detail': 'Review the current Terms and Privacy Policy to continue.', 'code': 'agreements_required'})
        return result

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.mfa_devices.filter(device_type='totp', is_verified=True).exists() and validated_token.get('mfa') is not True:
            raise AuthenticationFailed('Sign in with your password and authenticator code.', code='mfa_required')
        return user
