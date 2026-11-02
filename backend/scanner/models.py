from decimal import Decimal

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class ScannerSettings(models.Model):
    """Per-account scanner preferences (spec 003, AC-12, AC-15, AC-16)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scanner_settings')
    fast = models.BooleanField(default=False, help_text='Multi-threaded recognition (cross-origin isolated page)')
    sounds = models.BooleanField(default=True)
    ding_low = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1'))
    ding_high = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('10'))
    show_total = models.BooleanField(default=True)
    locked_sets = ArrayField(models.CharField(max_length=10), default=list, blank=True)

    @classmethod
    def for_user(cls, user):
        return cls.objects.get_or_create(user=user)[0]
