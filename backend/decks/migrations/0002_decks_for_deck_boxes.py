"""Every existing Deck box location becomes a Casual deck built from its cards (spec 004, AC-4)."""

from django.db import migrations


def create_decks(apps, schema_editor):
    Location = apps.get_model('collection', 'Location')
    CollectionItem = apps.get_model('collection', 'CollectionItem')
    Deck = apps.get_model('decks', 'Deck')
    DeckCard = apps.get_model('decks', 'DeckCard')
    for box in Location.objects.filter(kind='deck_box'):
        deck = Deck.objects.create(user_id=box.user_id, name=box.name, format='casual',
                                   is_public=box.is_public, location=box)
        per_card = {}
        for row in CollectionItem.objects.filter(location=box).select_related('printing').order_by('-printing__released_at'):
            entry = per_card.setdefault(row.printing.oracle_id, [row.printing_id, 0])
            entry[1] += row.quantity
        DeckCard.objects.bulk_create([
            DeckCard(deck=deck, printing_id=printing_id, oracle_id=oracle_id, zone='main', quantity=min(quantity, 999))
            for oracle_id, (printing_id, quantity) in per_card.items()
        ])


class Migration(migrations.Migration):
    dependencies = [
        ('decks', '0001_initial'),
        ('collection', '0002_cart'),
    ]
    operations = [migrations.RunPython(create_decks, migrations.RunPython.noop)]
