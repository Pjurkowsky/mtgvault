from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower


class Currency(models.TextChoices):
    USD = 'USD', 'US Dollar'
    EUR = 'EUR', 'Euro'
    PLN = 'PLN', 'Polish Złoty'


username_validator = RegexValidator(
    regex=r'^[A-Za-z0-9_-]{3,30}$',
    message='Use 3 to 30 characters: letters, digits, "_" or "-".',
)


class User(AbstractUser):
    username = models.CharField(
        max_length=30,
        unique=True,
        validators=[username_validator],
        error_messages={'unique': 'This username is taken.'},
    )
    email = models.EmailField()
    currency = models.CharField(max_length=3, choices=Currency.choices)

    REQUIRED_FIELDS = ['email', 'currency']

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(
                Lower('username'),
                name='users_user_username_ci_unique',
                violation_error_message='This username is taken.',
            ),
            models.UniqueConstraint(
                Lower('email'),
                name='users_user_email_ci_unique',
                violation_error_message='An account with this email already exists.',
            ),
        ]
