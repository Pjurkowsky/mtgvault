from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q
from django.db.models.signals import post_save
from django.dispatch import receiver

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
    # Token kind (oracle id, else name) -> the token printing shown for it (spec 021, AC-10).
    token_printings = models.JSONField(default=dict, blank=True)
    # Spec 027, AC-15: the public deck this one was forked from.
    forked_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='forks')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    # Spec 027: the branch a request works on; Main unless a view picked another.
    @property
    def branch(self) -> 'DeckBranch':
        if getattr(self, '_branch', None) is None:
            self._branch = self.branches.get(is_main=True)
        return self._branch

    @branch.setter
    def branch(self, value: 'DeckBranch'):
        self._branch = value

    def list_cards(self):
        """The cards of the branch this deck object works on (Main unless set)."""
        return self.cards.filter(branch=self.branch)


class DeckBranch(models.Model):
    """One editable list of a deck (spec 027). Every deck has exactly one Main."""

    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=40)
    is_main = models.BooleanField(default=False)
    # The version it was made from, for "from Main v2" (AC-3).
    from_version = models.ForeignKey('DeckVersion', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    from_branch = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['deck', 'name'], name='deck_branch_unique_name'),
            models.UniqueConstraint(fields=['deck'], condition=Q(is_main=True), name='deck_branch_one_main'),
        ]

    def __str__(self):
        return self.name


class DeckVersion(models.Model):
    """A frozen copy of a branch's list (spec 027, AC-7). `cards` holds each card's oracle id,
    printing id, zone, quantity, categories and swap pairs (positions in the list)."""

    branch = models.ForeignKey(DeckBranch, on_delete=models.CASCADE, related_name='versions')
    number = models.PositiveIntegerField()
    name = models.CharField(max_length=60, blank=True)
    note = models.TextField(blank=True, max_length=1000)
    cards = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['branch', 'number'], name='deck_version_unique_number')]
        ordering = ['-number']

    def __str__(self):
        return f'v{self.number}'


class DeckCard(models.Model):
    """A card in a decklist. Any printing counts as owned; `printing` is the preferred one."""

    class Zone(models.TextChoices):
        COMMANDER = 'commander', 'Commander'
        MAIN = 'main', 'Mainboard'
        SIDE = 'side', 'Sideboard'
        MAYBE = 'maybe', 'Maybeboard'

    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name='cards')
    # Spec 027: the branch whose list this card is in.
    branch = models.ForeignKey(DeckBranch, on_delete=models.CASCADE, related_name='cards')
    printing = models.ForeignKey(Printing, on_delete=models.PROTECT, related_name='+')
    oracle_id = models.UUIDField(db_index=True)
    zone = models.CharField(max_length=10, choices=Zone.choices, default=Zone.MAIN)
    quantity = models.PositiveSmallIntegerField(default=1)
    # Deck cards this Maybeboard card is proposed to replace (spec 005 AC-9, spec 021 AC-13).
    swaps_for = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='candidates')
    # Your own names for the card in this deck; the first is the primary one (spec 006, AC-12).
    categories = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['branch', 'oracle_id', 'zone'], name='deck_card_unique_per_zone'),
            models.CheckConstraint(condition=Q(quantity__gte=1, quantity__lte=999), name='deck_card_quantity_range'),
        ]


@receiver(post_save, sender=Deck)
def give_main_branch(sender, instance, created, raw=False, **kwargs):
    """Every deck has a Main branch from the start (spec 027)."""
    if created and not raw and not getattr(instance, '_no_main', False):
        instance.branch = DeckBranch.objects.create(deck=instance, name='Main', is_main=True)
