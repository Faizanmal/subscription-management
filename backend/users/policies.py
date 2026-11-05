"""Versioned user agreement records and the application access boundary."""

from django.conf import settings
from rest_framework import serializers


def current_versions():
    return {'terms_version': settings.TERMS_VERSION, 'privacy_version': settings.PRIVACY_VERSION}


def agreements_required(user):
    if not getattr(settings, 'ENFORCE_POLICY_ACCEPTANCE', True):
        return False
    return not user.policy_acceptances.filter(**current_versions()).exists()


class PolicyAcceptanceSerializer(serializers.Serializer):
    accept_terms = serializers.BooleanField()
    acknowledge_privacy = serializers.BooleanField()
    terms_version = serializers.CharField(max_length=64)
    privacy_version = serializers.CharField(max_length=64)

    def validate(self, attrs):
        if not attrs['accept_terms'] or not attrs['acknowledge_privacy']:
            raise serializers.ValidationError('Agree to the Terms and acknowledge the Privacy Policy to continue.')
        if any(attrs[key] != value for key, value in current_versions().items()):
            raise serializers.ValidationError('The policies have changed. Reload and review the current versions.')
        return attrs


def validate_acceptance(data):
    serializer = PolicyAcceptanceSerializer(data=data)
    serializer.is_valid(raise_exception=True)


def record_acceptance(user, source):
    from users.models import PolicyAcceptance
    return PolicyAcceptance.objects.get_or_create(user=user, **current_versions(), defaults={'source': source})
