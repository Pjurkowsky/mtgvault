from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import User


class MeSerializer(serializers.ModelSerializer):
    """The logged-in user's own account data."""

    class Meta:
        model = User
        fields = ['username', 'email', 'currency', 'date_joined']
        read_only_fields = ['username', 'email', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'currency']
        extra_kwargs = {
            # Replaced by the case-insensitive checks below.
            'username': {'validators': User._meta.get_field('username').validators},
        }

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is taken.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, attrs):
        # Run Django's password rules against the would-be user, so
        # "too similar to username/email" works too.
        candidate = User(username=attrs.get('username'), email=attrs.get('email'))
        try:
            password_validation.validate_password(attrs['password'], user=candidate)
        except Exception as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(style={'input_type': 'password'})
    new_password = serializers.CharField(style={'input_type': 'password'})

    def validate_current_password(self, value):
        if not self.context['user'].check_password(value):
            raise serializers.ValidationError('Current password is wrong.')
        return value

    def validate_new_password(self, value):
        try:
            password_validation.validate_password(value, user=self.context['user'])
        except Exception as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class PublicUserSerializer(serializers.ModelSerializer):
    """What anyone may see about a user. Never add private fields here."""

    class Meta:
        model = User
        fields = ['username', 'date_joined']


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField(help_text='Username or email')
    password = serializers.CharField(style={'input_type': 'password'})


class AccessTokenSerializer(serializers.Serializer):
    access = serializers.CharField()


class AuthResponseSerializer(serializers.Serializer):
    """Body returned by register and login. The refresh token goes in a cookie."""

    access = serializers.CharField()
    user = MeSerializer()
