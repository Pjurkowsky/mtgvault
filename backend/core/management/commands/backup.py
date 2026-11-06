from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.backup import run_backup


class Command(BaseCommand):
    help = 'Write a pg_dump of the database to BACKUP_DIR now (spec 008, AC-23).'

    def handle(self, *args, **options):
        if not settings.BACKUP_DIR:
            raise CommandError('Set BACKUP_DIR first')
        self.stdout.write(f'Backup written to {run_backup()}')
