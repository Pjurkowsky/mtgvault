from django.db import migrations, models


def copy_pairs(apps, schema_editor):
    """Each old swap_for link becomes one pair (spec 021, AC-13)."""
    DeckCard = apps.get_model('decks', 'DeckCard')
    Pair = DeckCard.swaps_for.through
    Pair.objects.bulk_create([
        Pair(from_deckcard_id=pk, to_deckcard_id=out)
        for pk, out in DeckCard.objects.exclude(swap_for=None).values_list('pk', 'swap_for')
    ])


class Migration(migrations.Migration):

    dependencies = [
        ('decks', '0006_categories'),
    ]

    operations = [
        migrations.AddField(
            model_name='deckcard',
            name='swaps_for',
            field=models.ManyToManyField(blank=True, related_name='candidates', to='decks.deckcard'),
        ),
        migrations.RunPython(copy_pairs, migrations.RunPython.noop),
        migrations.RemoveField(model_name='deckcard', name='swap_for'),
    ]
