from django.contrib.auth import authenticate, get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken, UntypedToken

from .cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from .serializers import (
    AccessTokenSerializer,
    AuthResponseSerializer,
    LoginSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    PublicUserSerializer,
    RegisterSerializer,
)
from .models import User

# One message for every failed login, so it never reveals whether an account
# exists (spec 000, AC-8).
LOGIN_FAILED = 'Wrong username/email or password.'

# A refresh rotates the token. If the browser leaves the page before it stores
# the new cookie, it still holds the old one; accept that one for a short while
# instead of logging the user out.
ROTATION_GRACE_SECONDS = 30


def _rotated_key(jti: str) -> str:
    return f'auth:rotated:{jti}'


def _payload(raw: str) -> dict | None:
    """Signature- and expiry-checked claims, ignoring the blacklist."""
    try:
        return UntypedToken(raw).payload
    except TokenError:
        return None


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
        raw = request.COOKIES.get(REFRESH_COOKIE_NAME, '')
        payload = _payload(raw) if raw else None
        serializer = TokenRefreshSerializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, ValidationError, AuthenticationFailed):
            return self._grace(payload) or self._logged_out()

        if payload:
            cache.set(_rotated_key(payload['jti']), True, ROTATION_GRACE_SECONDS)
        response = Response({'access': serializer.validated_data['access']})
        set_refresh_cookie(response, serializer.validated_data['refresh'])
        return response

    @staticmethod
    def _grace(payload):
        """A token rotated moments ago: issue a fresh pair instead of a 401."""
        if not payload or not cache.get(_rotated_key(payload['jti'])):
            return None
        user = get_user_model().objects.filter(pk=payload.get('user_id'), is_active=True).first()
        if user is None:
            return None
        refresh = RefreshToken.for_user(user)
        response = Response({'access': str(refresh.access_token)})
        set_refresh_cookie(response, refresh)
        return response

    @staticmethod
    def _logged_out():
        response = Response({'detail': 'Not logged in.'}, status=status.HTTP_401_UNAUTHORIZED)
        clear_refresh_cookie(response)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if token:
            if payload := _payload(token):
                cache.delete(_rotated_key(payload['jti']))
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # Already invalid; clearing the cookie is enough.
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


class MeView(generics.RetrieveUpdateAPIView):
    """The logged-in user's account. PATCH changes only the currency."""

    serializer_class = MeSerializer
    http_method_names = ['get', 'patch', 'options', 'head']

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    @extend_schema(request=PasswordChangeSerializer, responses={204: None})
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicUserView(generics.RetrieveAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_object(self):
        return get_object_or_404(User, username__iexact=self.kwargs['username'])
