from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    responses={
        200: inline_serializer('Health', {'status': serializers.CharField()}),
        503: inline_serializer('HealthDown', {'status': serializers.CharField()}),
    },
)
@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    """Answers only when the database is reachable (spec 008, AC-21)."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception:
        return Response({'status': 'database unavailable'}, status=503)
    return Response({'status': 'ok'})
