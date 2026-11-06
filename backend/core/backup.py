"""Database dumps for self-hosted sites (spec 008, AC-22, AC-23)."""

import os
import subprocess
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db import connection


def run_backup() -> Path:
    """Write a pg_dump to BACKUP_DIR and keep only the newest BACKUP_KEEP."""
    folder = Path(settings.BACKUP_DIR)
    folder.mkdir(parents=True, exist_ok=True)
    db = connection.settings_dict
    target = folder / f'mtgvault-{datetime.now():%Y-%m-%d-%H%M%S}.dump'
    env = {**os.environ, 'PGPASSWORD': str(db['PASSWORD'] or '')}
    command = ['pg_dump', '-Fc', '-f', str(target), '-h', db['HOST'] or 'localhost',
               '-p', str(db['PORT'] or 5432), '-U', db['USER'], db['NAME']]
    subprocess.run(command, env=env, check=True)
    prune(folder, settings.BACKUP_KEEP)
    return target


def prune(folder: Path, keep: int) -> None:
    dumps = sorted(folder.glob('mtgvault-*.dump'), reverse=True)
    for old in dumps[max(keep, 1):]:
        old.unlink()
