import itertools

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cards.models import Printing
from cards.pricing import latest_rates
from collection.models import CollectionItem, Condition, Language, Location
from collection.services import snapshot


class Command(BaseCommand):
    help = 'Fill a user\'s collection with many rows, for performance tests. Dev/test only.'

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--rows', type=int, default=20000)

    def handle(self, *args, username, rows, **options):
        if not settings.DEBUG:
            raise CommandError('seed_items only runs with DEBUG on.')
        user = get_user_model().objects.filter(username__iexact=username).first()
        if user is None:
            raise CommandError(f'No user "{username}".')

        rates = latest_rates()
        printings = list(Printing.objects.all())
        locations = [None] + [
            Location.objects.get_or_create(user=user, name=f'Seed {n}', defaults={'kind': 'box'})[0]
            for n in range(1, 5)
        ]
        # Every combination is a distinct row, so the unique constraint holds.
        combos = itertools.product(locations, Language.values, Condition.values, printings)
        snapshots = {p.pk: snapshot(p, p.finishes[0], rates) for p in printings}
        batch = [
            CollectionItem(
                user=user, printing=p, finish=p.finishes[0], condition=condition, language=language,
                location=location, quantity=1 + i % 4, **snapshots[p.pk],
            )
            for i, (location, language, condition, p) in enumerate(itertools.islice(combos, rows))
        ]
        if len(batch) < rows:
            raise CommandError(f'Only {len(batch)} distinct rows possible with this catalog.')
        with transaction.atomic():
            CollectionItem.objects.filter(user=user).delete()
            CollectionItem.objects.bulk_create(batch, batch_size=5000)
        self.stdout.write(f'Created {len(batch)} rows for {user.username}.')
