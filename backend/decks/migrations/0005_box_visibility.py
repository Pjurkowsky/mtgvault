"""Spec 005, AC-19: a deck box takes its deck's visibility."""

from django.db import migrations


def align(apps, schema_editor):
    Deck = apps.get_model('decks', 'Deck')
    Location = apps.get_model('collection', 'Location')
    for deck in Deck.objects.exclude(location=None):
        Location.objects.filter(pk=deck.location_id).exclude(is_public=deck.is_public).update(is_public=deck.is_public)


class Migration(migrations.Migration):
    dependencies = [('decks', '0004_swap_for')]
    operations = [migrations.RunPython(align, migrations.RunPython.noop)]
