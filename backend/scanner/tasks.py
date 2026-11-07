from celery import shared_task

from .bundles import sync


@shared_task
def sync_scanner_bundle():
    """Daily check for a newer recognition model from the saved source (spec 003 AC-23, spec 020 AC-8)."""
    return sync()
