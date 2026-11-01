from celery import shared_task

from .sync import sync_cards as run_card_sync
from .sync import sync_rates


@shared_task
def sync_cards(file=None, eur_pln=None, usd_pln=None):
    """Daily catalog refresh (beat schedule in settings). Arguments are for tests."""
    cards = run_card_sync(file)
    sync_rates(eur_pln, usd_pln)
    return cards.rows
