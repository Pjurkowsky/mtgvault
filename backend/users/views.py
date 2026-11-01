from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import set_refresh_cookie
from .serializers import AuthResponseSerializer, MeSerializer, RegisterSerializer


def auth_response(user, status_code=status.HTTP_200_OK):
    """Log the user in: access token in the body, refresh token in the cookie."""
    refresh = RefreshToken.for_user(user)
    body = {'access': str(refresh.access_token), 'user': MeSerializer(user).data}
    response = Response(body, status=status_code)
    set_refresh_cookie(response, refresh)
    return response


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=RegisterSerializer, responses={201: AuthResponseSerializer})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            # Two sign-ups with the same name raced past validation.
            raise ValidationError({'username': ['This username or email is taken.']})
        return auth_response(user, status.HTTP_201_CREATED)
