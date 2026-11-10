from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from cards.combos import sync_combos
from cards.sync import sync_cards, sync_rates
from cards.tags import sync_tags


class Command(BaseCommand):
    help = 'Sync the card catalog and tags from Scryfall, combos from Commander Spellbook and exchange rates from NBP.'

    def add_arguments(self, parser):
        parser.add_argument('--file', help='Read cards from a local .jsonl or .jsonl.gz instead of downloading')
        parser.add_argument('--tags-file', help='Read oracle tags from a local .jsonl or .jsonl.gz instead of downloading')
        parser.add_argument('--combos-file', help='Read Commander Spellbook variants from a local .json or .json.gz instead of downloading')
        parser.add_argument('--eur-pln', type=Decimal, help='Tests only: store this EUR->PLN rate (dated today) instead of calling NBP')
        parser.add_argument('--usd-pln', type=Decimal, help='Tests only: store this USD->PLN rate (dated today) instead of calling NBP')

    def handle(self, *args, file=None, tags_file=None, combos_file=None, eur_pln=None, usd_pln=None, **options):
        try:
            cards = sync_cards(file)
            self.stdout.write(f'Cards: {cards.rows} printings synced.')
            tags = sync_tags(tags_file)
            self.stdout.write(f'Tags: {tags.rows} cards categorised.')
            combos = sync_combos(combos_file)
            self.stdout.write(f'Combos: {combos.rows} combos synced.')
            sync_rates(eur_pln, usd_pln)
            self.stdout.write('Rates: EUR and USD synced.')
        except Exception as exc:
            raise CommandError(f'Sync failed: {exc}') from exc
