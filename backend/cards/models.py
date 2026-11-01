from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex, OpClass
from django.db import models
from django.db.models.functions import Upper


class Rarity(models.TextChoices):
    COMMON = 'common', 'Common'
    UNCOMMON = 'uncommon', 'Uncommon'
    RARE = 'rare', 'Rare'
    MYTHIC = 'mythic', 'Mythic'
    SPECIAL = 'special', 'Special'
    BONUS = 'bonus', 'Bonus'


class Finish(models.TextChoices):
    NONFOIL = 'nonfoil', 'Nonfoil'
    FOIL = 'foil', 'Foil'
    ETCHED = 'etched', 'Etched'


class Set(models.Model):
    code = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=200)
    released_at = models.DateField(null=True, blank=True)
    set_type = models.CharField(max_length=40, blank=True)

    def __str__(self):
        return f'{self.name} ({self.code.upper()})'


class Printing(models.Model):
    """One specific version of a card, as listed by Scryfall."""

    id = models.UUIDField(primary_key=True, help_text='Scryfall id')
    oracle_id = models.UUIDField(db_index=True, help_text='Same for every printing of a card')
    name = models.CharField(max_length=300)
    front_name = models.CharField(max_length=200, help_text='Front face name for double-faced cards')
    set = models.ForeignKey(Set, on_delete=models.PROTECT, related_name='printings')
    collector_number = models.CharField(max_length=20)
    lang = models.CharField(max_length=5)
    released_at = models.DateField()
    rarity = models.CharField(max_length=10, choices=Rarity.choices)
    colors = ArrayField(models.CharField(max_length=1), default=list, blank=True)
    types = ArrayField(models.CharField(max_length=20), default=list, blank=True)
    type_line = models.CharField(max_length=300, blank=True)
    mana_cost = models.CharField(max_length=100, blank=True)
    cmc = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    finishes = ArrayField(models.CharField(max_length=10, choices=Finish.choices), default=list)
    image_small = models.URLField(max_length=500, blank=True)
    image_normal = models.URLField(max_length=500, blank=True)
    image_large = models.URLField(max_length=500, blank=True)
    usd = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    usd_foil = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    usd_etched = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    eur = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    eur_foil = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    eur_etched = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        indexes = [
            # Django's icontains runs UPPER(col) LIKE UPPER(...), so index that.
            GinIndex(OpClass(Upper('name'), name='gin_trgm_ops'), name='printing_name_trgm'),
            GinIndex(OpClass(Upper('front_name'), name='gin_trgm_ops'), name='printing_front_name_trgm'),
            models.Index(fields=['released_at'], name='printing_released_at'),
        ]

    def __str__(self):
        return f'{self.name} ({self.set_id.upper()}) {self.collector_number}'


class ExchangeRate(models.Model):
    """NBP mid rate: 1 unit of `currency` = `rate_to_pln` PLN."""

    currency = models.CharField(max_length=3)
    rate_to_pln = models.DecimalField(max_digits=10, decimal_places=4)
    effective_date = models.DateField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['currency', 'effective_date'], name='exchange_rate_unique_day'),
        ]


class SyncRun(models.Model):
    class Kind(models.TextChoices):
        CARDS = 'cards', 'Cards'
        RATES = 'rates', 'Rates'

    class Status(models.TextChoices):
        RUNNING = 'running', 'Running'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'

    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.RUNNING)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    rows = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=['kind', 'status', '-finished_at'], name='sync_run_latest')]
