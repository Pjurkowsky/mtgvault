from celery import shared_task

from .backup import run_backup


@shared_task
def backup_database():
    """Nightly dump (beat schedule in settings)."""
    return str(run_backup())
