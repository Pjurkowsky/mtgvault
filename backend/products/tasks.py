from celery import shared_task


@shared_task
def sync_products():
    """Weekly product refresh from MTGJSON (spec 030, AC-12)."""
    from .sync import sync_products as run_sync

    return run_sync().rows
