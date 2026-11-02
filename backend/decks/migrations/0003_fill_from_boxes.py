"""Spec 004, AC-29: decks pick up cards already sitting in their deck boxes."""

from django.db import migrations
from django.db.models import Sum

COUNTED = ('commander', 'main', 'side')


def fill(apps, schema_editor):
    Deck = apps.get_model('decks', 'Deck')
    DeckCard = apps.get_model('decks', 'DeckCard')
    CollectionItem = apps.get_model('collection', 'CollectionItem')
    for deck in Deck.objects.exclude(location=None):
        rows = CollectionItem.objects.filter(location_id=deck.location_id, in_cart=False)
        in_box = {r['printing__oracle_id']: r['n'] for r in rows.values('printing__oracle_id').annotate(n=Sum('quantity'))}
        listed = {r['oracle_id']: r['n'] for r in DeckCard.objects.filter(deck=deck, zone__in=COUNTED)
                  .values('oracle_id').annotate(n=Sum('quantity'))}
        for oracle, count in in_box.items():
            short = count - listed.get(oracle, 0)
            if short <= 0:
                continue
            printing = rows.filter(printing__oracle_id=oracle).order_by('-printing__released_at').first().printing
            card, created = DeckCard.objects.get_or_create(
                deck=deck, oracle_id=oracle, zone='main', defaults={'printing': printing, 'quantity': min(short, 999)})
            if not created:
                card.quantity = min(card.quantity + short, 999)
                card.save(update_fields=['quantity'])


class Migration(migrations.Migration):
    dependencies = [('decks', '0002_decks_for_deck_boxes')]
    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
