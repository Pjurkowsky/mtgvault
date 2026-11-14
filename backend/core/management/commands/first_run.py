from django.core.management.base import BaseCommand

from cards.models import Printing


class Command(BaseCommand):
    help = 'Queue the card sync and scanner bundle download when the catalog is empty (spec 008, AC-18), and the product sync until one succeeds (spec 030, AC-12).'

    def handle(self, *args, **options):
        from cards.tasks import sync_cards
        from products.sync import synced
        from products.tasks import sync_products
        from scanner.tasks import sync_scanner_bundle

        products = not synced()
        if Printing.objects.exists():
            self.stdout.write('Card catalog present')
            if products:
                sync_products.delay()
                self.stdout.write('No product data: product sync queued')
            return
        # Products match printings, so their sync waits for the cards.
        (sync_cards.si() | sync_products.si()).delay() if products else sync_cards.delay()
        sync_scanner_bundle.delay()
        self.stdout.write('Card catalog empty: card sync and scanner bundle download queued')
