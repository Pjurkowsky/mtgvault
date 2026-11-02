from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower
from django.utils import timezone

from cards.models import Finish, Printing
from users.models import Currency


class Location(models.Model):
    class Kind(models.TextChoices):
        BINDER = 'binder', 'Binder'
        BOX = 'box', 'Box'
        DECK_BOX = 'deck_box', 'Deck box'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='locations')
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                F('user'), Lower('name'),
                name='location_name_unique_per_user',
                violation_error_message='You already have a location with this name.',
            ),
        ]

    def __str__(self):
        return self.name


class Condition(models.TextChoices):
    NEAR_MINT = 'NM', 'Near Mint'
    LIGHTLY_PLAYED = 'LP', 'Lightly Played'
    MODERATELY_PLAYED = 'MP', 'Moderately Played'
    HEAVILY_PLAYED = 'HP', 'Heavily Played'
    DAMAGED = 'DMG', 'Damaged'


class Language(models.TextChoices):
    """Scryfall's language codes."""

    ENGLISH = 'en', 'English'
    SPANISH = 'es', 'Spanish'
    FRENCH = 'fr', 'French'
    GERMAN = 'de', 'German'
    ITALIAN = 'it', 'Italian'
    PORTUGUESE = 'pt', 'Portuguese'
    JAPANESE = 'ja', 'Japanese'
    KOREAN = 'ko', 'Korean'
    RUSSIAN = 'ru', 'Russian'
    CHINESE_SIMPLIFIED = 'zhs', 'Simplified Chinese'
    CHINESE_TRADITIONAL = 'zht', 'Traditional Chinese'
    HEBREW = 'he', 'Hebrew'
    LATIN = 'la', 'Latin'
    ANCIENT_GREEK = 'grc', 'Ancient Greek'
    ARABIC = 'ar', 'Arabic'
    SANSKRIT = 'sa', 'Sanskrit'
    PHYREXIAN = 'ph', 'Phyrexian'
    QUENYA = 'qya', 'Quenya'


class CollectionItem(models.Model):
    """One collection row: copies of a printing in one finish, condition, language and place."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='items')
    printing = models.ForeignKey(Printing, on_delete=models.PROTECT, related_name='+')
    # Null means Unfiled. PROTECT: deleting a location must decide what happens to its cards (AC-11).
    location = models.ForeignKey(Location, on_delete=models.PROTECT, null=True, blank=True, related_name='items')
    # Scanned cards waiting in the user's cart: not part of the collection (spec 003, AC-18).
    in_cart = models.BooleanField(default=False)
    quantity = models.PositiveSmallIntegerField()
    finish = models.CharField(max_length=10, choices=Finish.choices)
    condition = models.CharField(max_length=3, choices=Condition.choices, default=Condition.NEAR_MINT)
    language = models.CharField(max_length=3, choices=Language.choices, default=Language.ENGLISH)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    purchase_currency = models.CharField(max_length=3, choices=Currency.choices, null=True, blank=True)
    # Market price per copy when the row was first added (AC-14).
    added_usd = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    added_eur = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    added_pln = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    added_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            # AC-19. nulls_distinct=False so two Unfiled rows also collide.
            models.UniqueConstraint(
                fields=['user', 'printing', 'finish', 'condition', 'language', 'location', 'in_cart'],
                nulls_distinct=False,
                name='collection_item_unique_row',
            ),
            models.CheckConstraint(
                condition=Q(in_cart=False) | Q(location__isnull=True),
                name='collection_item_cart_has_no_location',
            ),
            models.CheckConstraint(
                condition=Q(quantity__gte=1, quantity__lte=999),
                name='collection_item_quantity_range',
            ),
            models.CheckConstraint(
                condition=Q(purchase_price__isnull=True, purchase_currency__isnull=True)
                | Q(purchase_price__isnull=False, purchase_currency__isnull=False),
                name='collection_item_purchase_price_has_currency',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'location'], name='item_user_location'),
            models.Index(fields=['user', 'added_at'], name='item_user_added_at'),
        ]
