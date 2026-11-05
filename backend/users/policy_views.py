from django.conf import settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.policies import agreements_required, current_versions, record_acceptance, validate_acceptance


class PolicyVersionsView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from users.management.commands.check_launch_ready import complete
        return Response({**current_versions(), 'social_providers': {
            'google': all(complete(value) for value in (settings.SOCIAL_AUTH_GOOGLE_OAUTH2_KEY, settings.SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET)),
            'microsoft': all(complete(value) for value in (settings.SOCIAL_AUTH_MICROSOFT_GRAPH_KEY, settings.SOCIAL_AUTH_MICROSOFT_GRAPH_SECRET)),
        }})


class PolicyAcceptanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({**current_versions(), 'agreements_required': agreements_required(request.user)})

    def post(self, request):
        validate_acceptance(request.data)
        acceptance, created = record_acceptance(request.user, 'account')
        return Response({**current_versions(), 'accepted_at': acceptance.accepted_at, 'agreements_required': False}, status=201 if created else 200)
