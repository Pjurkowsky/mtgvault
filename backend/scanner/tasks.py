from celery import shared_task

from .bundles import install_latest


@shared_task
def sync_scanner_bundle():
    """Daily check for a newer recognition model (spec 003, AC-23)."""
    return install_latest()
