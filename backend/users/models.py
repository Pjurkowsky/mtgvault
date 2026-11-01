from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom user model. Add profile fields here as the app grows."""
