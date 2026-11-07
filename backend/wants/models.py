from django.conf import settings
from django.db import models

from cards.models import Finish, Printing

ANY = 'any'
FINISH_CHOICES = [(ANY, 'Any'), *Finish.choices]


class WantItem(models.Model):
    """One line of a user's want list (spec 010, AC-5). Not part of the collection."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wants')
    oracle_id = models.UUIDField(db_index=True)
    # The printing shown and priced. With any_printing it's only the one the card was added from (AC-8).
    printing = models.ForeignKey(Printing, on_delete=models.PROTECT, related_name='+')
    any_printing = models.BooleanField(default=True)
    finish = models.CharField(max_length=10, choices=FINISH_CHOICES, default=ANY)
    deck = models.ForeignKey('decks.Deck', on_delete=models.SET_NULL, null=True, blank=True, related_name='wants')
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'oracle_id'], name='want_user_oracle')]

    def __str__(self):
        return f'{self.quantity}x {self.printing.name}'
