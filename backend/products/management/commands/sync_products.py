from django.core.management.base import BaseCommand

from products.sync import sync_products


class Command(BaseCommand):
    help = 'Sync sealed products (decks, boosters) from MTGJSON (spec 030).'

    def add_arguments(self, parser):
        parser.add_argument('--printings-file', help='AllPrintings.json(.xz) instead of downloading it')
        parser.add_argument('--decks-file', help='AllDeckFiles.tar.xz, or a JSON {"data": [deck, …]}, instead of downloading it')

    def handle(self, *args, **options):
        run = sync_products(options['printings_file'], options['decks_file'])
        self.stdout.write(f'{run.rows} products')
