from decimal import Decimal

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MaxValueValidator
from django.db import models


class ScannerSettings(models.Model):
    """Per-account scanner preferences (spec 003, AC-12, AC-15, AC-16; spec 019)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scanner_settings')
    fast = models.BooleanField(default=True, help_text='Multi-threaded recognition (cross-origin isolated page)')
    sounds = models.BooleanField(default=True)
    ding_low = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1'))
    ding_high = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('10'))
    show_total = models.BooleanField(default=True)
    locked_sets = ArrayField(models.CharField(max_length=10), default=list, blank=True)
    # Spec 019: glare, combined frames, guesses.
    glare_hint = models.BooleanField(default=False)
    glare_sensitivity = models.PositiveSmallIntegerField(default=50, validators=[MaxValueValidator(100)])
    combine_frames = models.BooleanField(default=False)
    suggest_guesses = models.BooleanField(default=False)

    @classmethod
    def for_user(cls, user):
        return cls.objects.get_or_create(user=user)[0]


class ScannerSource(models.Model):
    """Where the scanner's recognition model comes from (spec 020). One row, pk 1."""

    GITHUB = 'github'
    FOLDER = 'folder'
    KINDS = [(GITHUB, 'GitHub releases'), (FOLDER, 'Server folder')]
    DEFAULT_REPO = 'cfbender/manavault'

    kind = models.CharField(max_length=10, choices=KINDS, default=GITHUB)
    repo = models.CharField(max_length=200, default=DEFAULT_REPO, blank=True, help_text='owner/name, for GitHub releases')
    path = models.CharField(max_length=500, blank=True, help_text='Absolute folder of bundles on the server')
    syncing = models.BooleanField(default=False)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    @classmethod
    def get(cls):
        return cls.objects.get_or_create(pk=1)[0]

    @property
    def installed_bundle(self) -> dict | None:
        from .bundles import current_version, manifest

        version = current_version()
        return {'version': version, 'created': manifest(version).get('created', '')} if version else None
