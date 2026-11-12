"""Spec 028: swap pairs get a date. Existing pairs are copied without one."""

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


def copy_pairs(apps, schema_editor):
    DeckCard = apps.get_model('decks', 'DeckCard')
    DeckSwap = apps.get_model('decks', 'DeckSwap')
    Old = DeckCard.swaps_for.through
    DeckSwap.objects.bulk_create(
        [DeckSwap(candidate_id=a, out_id=b, created_at=None) for a, b in Old.objects.values_list('from_deckcard_id', 'to_deckcard_id')],
        batch_size=1000)


def copy_back(apps, schema_editor):
    DeckCard = apps.get_model('decks', 'DeckCard')
    DeckSwap = apps.get_model('decks', 'DeckSwap')
    Old = DeckCard.swaps_for.through
    Old.objects.bulk_create([Old(from_deckcard_id=a, to_deckcard_id=b) for a, b in DeckSwap.objects.values_list('candidate_id', 'out_id')],
                            batch_size=1000)


class Migration(migrations.Migration):
    dependencies = [('decks', '0009_deck_versions')]

    operations = [
        migrations.CreateModel(
            name='DeckSwap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(blank=True, default=django.utils.timezone.now, null=True)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='swap_rows', to='decks.deckcard')),
                ('out', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='candidate_rows', to='decks.deckcard')),
            ],
            options={'constraints': [models.UniqueConstraint(fields=('candidate', 'out'), name='deck_swap_unique')]},
        ),
        migrations.RunPython(copy_pairs, copy_back),
        migrations.RemoveField(model_name='deckcard', name='swaps_for'),
        migrations.AddField(
            model_name='deckcard',
            name='swaps_for',
            field=models.ManyToManyField(blank=True, related_name='candidates', through='decks.DeckSwap',
                                         through_fields=('candidate', 'out'), to='decks.deckcard'),
        ),
    ]
