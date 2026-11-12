"""Pod simulation with Forge (spec 024)."""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models

from decks.models import Deck


class PoolDeck(models.Model):
    """A deck in the shared opponent pool: a copy, apart from any player's deck (AC-8 to AC-10)."""

    name = models.CharField(max_length=120)
    # [{"name": "Sol Ring", "quantity": 1, "commander": false}]
    cards = models.JSONField(default=list)
    # Null for Forge's precons.
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    precon = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SimSwap(models.Model):
    """A supported card standing in for an unsupported one in one user's simulations of a deck (AC-13)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name='+')
    from_name = models.CharField(max_length=300)
    to_name = models.CharField(max_length=300)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'deck', 'from_name'], name='sim_swap_unique')]


class SimRun(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        PLAYING = 'playing', 'Playing'
        DONE = 'done', 'Done'
        CANCELLED = 'cancelled', 'Cancelled'
        FAILED = 'failed', 'Failed'

    class SeatMode(models.TextChoices):
        ROTATE = 'rotate', 'Rotate'
        RANDOM = 'random', 'Random'
        FIXED = 'fixed', 'Fixed'

    # The tested deck when it is a player's deck; null for a pool deck (spec 025, AC-10).
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, null=True, blank=True, related_name='sim_runs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sim_runs')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED)
    games = models.PositiveIntegerField()
    minutes = models.PositiveIntegerField()
    seat_mode = models.CharField(max_length=6, choices=SeatMode.choices, default=SeatMode.ROTATE)
    # Fixed mode: seat indexes in turn order, as arranged in the form (AC-6).
    fixed_order = ArrayField(models.PositiveSmallIntegerField(), default=list, blank=True)
    cancel_requested = models.BooleanField(default=False)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    # Lower-cased deck and commander names of every seat, for the run search (spec 025, AC-7).
    search = models.TextField(blank=True, default='')
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['status', 'created_at'], name='sim_run_queue')]


class SimSeat(models.Model):
    """A deck at the table, copied when the run started (AC-15). Seat 0 is the simulated deck."""

    class Source(models.TextChoices):
        DECK = 'deck', 'Deck'
        POOL = 'pool', 'Opponent pool'

    run = models.ForeignKey(SimRun, on_delete=models.CASCADE, related_name='seats')
    index = models.PositiveSmallIntegerField()
    label = models.CharField(max_length=120)
    source = models.CharField(max_length=4, choices=Source.choices)
    source_id = models.PositiveIntegerField(null=True, blank=True)
    owner = models.CharField(max_length=150, blank=True)
    profile = models.CharField(max_length=12, default='Default')
    cards = models.JSONField(default=list)

    class Meta:
        ordering = ['index']
        constraints = [models.UniqueConstraint(fields=['run', 'index'], name='sim_seat_unique')]


class SimGame(models.Model):
    class Status(models.TextChoices):
        WON = 'won', 'Won'
        DRAW = 'draw', 'Draw'
        FAILED = 'failed', 'Failed'

    run = models.ForeignKey(SimRun, on_delete=models.CASCADE, related_name='played')
    number = models.PositiveIntegerField()
    status = models.CharField(max_length=6, choices=Status.choices)
    # Run seat indexes in turn order; the first went first.
    seat_order = ArrayField(models.PositiveSmallIntegerField())
    winner_seat = models.PositiveSmallIntegerField(null=True, blank=True)
    # Forge's game turn, and the winner's own turn count (AC-19 to AC-21).
    turn = models.PositiveIntegerField(default=0)
    winner_turn = models.PositiveIntegerField(null=True, blank=True)
    # Run seat index -> game turn it lost on.
    lost_on = models.JSONField(default=dict)
    error = models.TextField(blank=True)
    duration_ms = models.PositiveIntegerField(default=0)
    # Gzipped JSON {"steps": [...], "log": [...]} from MTG Vault's Forge runner.
    replay = models.BinaryField(default=bytes)

    class Meta:
        ordering = ['number']
        constraints = [models.UniqueConstraint(fields=['run', 'number'], name='sim_game_unique')]
