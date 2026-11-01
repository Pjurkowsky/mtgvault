from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from .serializers import (
    AccessTokenSerializer,
    AuthResponseSerializer,
    LoginSerializer,
    MeSerializer,
    RegisterSerializer,
)

# One message for every failed login, so it never reveals whether an account
# exists (spec 000, AC-8).
LOGIN_FAILED = 'Wrong username/email or password.'


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


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=LoginSerializer,
        responses={200: AuthResponseSerializer, 401: OpenApiResponse(description=LOGIN_FAILED)},
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            # Explicit 401: with no authentication classes DRF would send 403.
            return Response({'detail': LOGIN_FAILED}, status=status.HTTP_401_UNAUTHORIZED)
        return auth_response(user)


class RefreshView(APIView):
    """Swap the refresh cookie for a new access token and a rotated cookie."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=None,
        responses={200: AccessTokenSerializer, 401: OpenApiResponse(description='Not logged in')},
    )
    def post(self, request):
        serializer = TokenRefreshSerializer(
            data={'refresh': request.COOKIES.get(REFRESH_COOKIE_NAME, '')}
        )
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, ValidationError, AuthenticationFailed):
            response = Response({'detail': 'Not logged in.'}, status=status.HTTP_401_UNAUTHORIZED)
            clear_refresh_cookie(response)
            return response

        response = Response({'access': serializer.validated_data['access']})
        set_refresh_cookie(response, serializer.validated_data['refresh'])
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # Already invalid; clearing the cookie is enough.
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response
