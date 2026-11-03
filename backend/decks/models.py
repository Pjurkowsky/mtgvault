from django.conf import settings
from django.db import models
from django.db.models import Q

from cards.models import Printing
from collection.models import Location


class Deck(models.Model):
    class Format(models.TextChoices):
        COMMANDER = 'commander', 'Commander'
        BRAWL = 'brawl', 'Brawl'
        STANDARD = 'standard', 'Standard'
        PIONEER = 'pioneer', 'Pioneer'
        MODERN = 'modern', 'Modern'
        LEGACY = 'legacy', 'Legacy'
        VINTAGE = 'vintage', 'Vintage'
        PAUPER = 'pauper', 'Pauper'
        CASUAL = 'casual', 'Casual'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='decks')
    name = models.CharField(max_length=100)
    format = models.CharField(max_length=12, choices=Format.choices, default=Format.CASUAL)
    is_public = models.BooleanField(default=False)
    # The deck's box (spec 004, AC-4): every Deck box location is one deck's box.
    location = models.OneToOneField(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name='deck')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class DeckCard(models.Model):
    """A card in a decklist. Any printing counts as owned; `printing` is the preferred one."""

    class Zone(models.TextChoices):
        COMMANDER = 'commander', 'Commander'
        MAIN = 'main', 'Mainboard'
        SIDE = 'side', 'Sideboard'
        MAYBE = 'maybe', 'Maybeboard'

    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name='cards')
    printing = models.ForeignKey(Printing, on_delete=models.PROTECT, related_name='+')
    oracle_id = models.UUIDField(db_index=True)
    zone = models.CharField(max_length=10, choices=Zone.choices, default=Zone.MAIN)
    quantity = models.PositiveSmallIntegerField(default=1)
    # A Maybeboard card proposed to replace another card of the deck (spec 005, AC-9).
    swap_for = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='candidates')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['deck', 'oracle_id', 'zone'], name='deck_card_unique_per_zone'),
            models.CheckConstraint(condition=Q(quantity__gte=1, quantity__lte=999), name='deck_card_quantity_range'),
        ]
