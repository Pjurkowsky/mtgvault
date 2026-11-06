from django.core.management.base import BaseCommand

from cards.models import Printing


class Command(BaseCommand):
    help = 'Queue the card sync and scanner bundle download when the catalog is empty (spec 008, AC-18).'

    def handle(self, *args, **options):
        if Printing.objects.exists():
            self.stdout.write('Card catalog present')
            return
        from cards.tasks import sync_cards
        from scanner.tasks import sync_scanner_bundle

        sync_cards.delay()
        sync_scanner_bundle.delay()
        self.stdout.write('Card catalog empty: card sync and scanner bundle download queued')
