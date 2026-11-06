import time

from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = 'Wait until the database and Redis answer (spec 008, AC-17).'

    def add_arguments(self, parser):
        parser.add_argument('--timeout', type=int, default=120)

    def handle(self, *args, timeout, **options):
        deadline = time.monotonic() + timeout
        for name, check in (('database', connection.ensure_connection), ('Redis', lambda: cache.get('ping'))):
            while True:
                try:
                    check()
                    break
                except Exception as error:
                    if time.monotonic() > deadline:
                        raise CommandError(f'{name} not reachable: {error}')
                    connection.close()
                    time.sleep(1)
            self.stdout.write(f'{name} is up')
