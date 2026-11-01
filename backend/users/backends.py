from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class UsernameOrEmailBackend(ModelBackend):
    """Log in with username or email, ignoring letter case.

    Accepts `login=` (our API) or `username=` (Django admin).
    """

    def authenticate(self, request, login=None, password=None, username=None, **kwargs):
        identifier = login or username
        if not identifier or password is None:
            return None

        User = get_user_model()
        # Usernames can't contain "@", so one identifier never matches two users.
        user = User._default_manager.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()

        if user is None:
            # Hash anyway so a missing user takes as long as a wrong password.
            User().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
