from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from cards.sync import sync_cards, sync_rates


class Command(BaseCommand):
    help = 'Sync the card catalog from Scryfall and exchange rates from NBP.'

    def add_arguments(self, parser):
        parser.add_argument('--file', help='Read cards from a local .jsonl or .jsonl.gz instead of downloading')
        parser.add_argument('--eur-pln', type=Decimal, help='Use this EUR->PLN rate instead of calling NBP')
        parser.add_argument('--usd-pln', type=Decimal, help='Use this USD->PLN rate instead of calling NBP')

    def handle(self, *args, file=None, eur_pln=None, usd_pln=None, **options):
        try:
            cards = sync_cards(file)
            self.stdout.write(f'Cards: {cards.rows} printings synced.')
            sync_rates(eur_pln, usd_pln)
            self.stdout.write('Rates: EUR and USD synced.')
        except Exception as exc:
            raise CommandError(f'Sync failed: {exc}') from exc
