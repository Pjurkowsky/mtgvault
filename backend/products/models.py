"""Sealed products and what they hold, from MTGJSON (spec 030)."""

from django.db import models


class Product(models.Model):
    """A fixed deck (precon, Secret Lair drop …) or a booster type of a set."""

    class Kind(models.TextChoices):
        DECK = 'deck', 'Deck'
        BOOSTER = 'booster', 'Booster'

    code = models.SlugField(max_length=150, unique=True, help_text='e.g. blb-play, blc-animated-army')
    kind = models.CharField(max_length=7, choices=Kind.choices)
    name = models.CharField(max_length=300)
    set_code = models.CharField(max_length=10)
    set_name = models.CharField(max_length=200)
    released_at = models.DateField(null=True, blank=True)
    deck_type = models.CharField(max_length=60, blank=True, help_text="MTGJSON's deck type, e.g. Commander Deck")
    total_weight = models.PositiveBigIntegerField(default=0, help_text='Boosters: sum of the layout weights')

    class Meta:
        indexes = [models.Index(fields=['kind', 'released_at'], name='product_kind_released')]

    def __str__(self):
        return self.name


class ProductCard(models.Model):
    """A printing a product holds: copies in a deck, chance per pack in a booster."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='cards')
    printing = models.ForeignKey('cards.Printing', on_delete=models.CASCADE, related_name='+')
    copies = models.PositiveIntegerField(default=0)
    chance = models.FloatField(null=True, blank=True, help_text='Boosters: chance a pack holds this printing, 0 to 1')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['product', 'printing'], name='product_card_unique')]


class BoosterSheet(models.Model):
    """One slot's pool of cards in a booster; `fixed` sheets always give every card."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sheets')
    name = models.CharField(max_length=100)
    total_weight = models.PositiveBigIntegerField()
    fixed = models.BooleanField(default=False)


class SheetCard(models.Model):
    sheet = models.ForeignKey(BoosterSheet, on_delete=models.CASCADE, related_name='cards')
    printing = models.ForeignKey('cards.Printing', on_delete=models.CASCADE, related_name='+')
    weight = models.PositiveBigIntegerField()


class BoosterLayout(models.Model):
    """One way a pack is made: how many cards from each sheet, and how often."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='layouts')
    weight = models.PositiveBigIntegerField()
    slots = models.JSONField(help_text='{sheet name: cards}')
