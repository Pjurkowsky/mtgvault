import logging

from celery import shared_task

from .sync import sync_cards as run_card_sync
from .sync import sync_rates
from .tags import sync_tags

log = logging.getLogger(__name__)


@shared_task
def sync_cards(file=None, eur_pln=None, usd_pln=None):
    """Daily catalog refresh (beat schedule in settings). Arguments are for tests."""
    cards = run_card_sync(file)
    try:
        sync_tags()
    except Exception:  # yesterday's categories stay; prices and rates still refresh
        log.exception('Tag sync failed')
    sync_rates(eur_pln, usd_pln)
    return cards.rows
