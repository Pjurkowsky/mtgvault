"""Daily catalog sync: Scryfall cards and NBP exchange rates."""

import gzip
import json
import logging
import shutil
import tempfile
import urllib.request
from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from .models import ExchangeRate, Printing, Set, SyncRun
from .scryfall import PRICE_FIELDS, printing_fields, set_fields, should_skip

log = logging.getLogger(__name__)

SCRYFALL_BULK_URL = 'https://api.scryfall.com/bulk-data/default-cards'
NBP_RATE_URL = 'https://api.nbp.pl/api/exchangerates/rates/a/{code}/?format=json'
# Scryfall asks every client to send these.
HEADERS = {'User-Agent': 'MTGVault/0.1', 'Accept': 'application/json'}
BATCH_SIZE = 2000

PRINTING_UPDATE_FIELDS = [
    'oracle_id', 'name', 'front_name', 'set', 'collector_number', 'lang', 'released_at',
    'rarity', 'colors', 'types', 'type_line', 'mana_cost', 'cmc', 'finishes', 'illustration_id', 'promo', 'legalities', 'color_identity', 'keywords', 'produced_mana', 'oracle_text',
    'image_small', 'image_normal', 'image_large', *PRICE_FIELDS,
]


def _get_json(url: str) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as response:
        return json.load(response)


@contextmanager
def _card_lines(file: str | None):
    """Yield an iterator over JSON lines from a local file or a fresh download."""
    if file:
        opener = gzip.open if file.endswith('.gz') else open
        with opener(file, 'rt', encoding='utf-8') as handle:
            yield handle
        return

    uri = _get_json(SCRYFALL_BULK_URL)['jsonl_download_uri']
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'cards.jsonl.gz'
        with urllib.request.urlopen(urllib.request.Request(uri, headers=HEADERS), timeout=300) as response:
            with path.open('wb') as out:
                shutil.copyfileobj(response, out)
        with gzip.open(path, 'rt', encoding='utf-8') as handle:
            yield handle


def _flush(sets: dict, printings: list[dict]) -> None:
    Set.objects.bulk_create(
        [Set(**fields) for fields in sets.values()],
        update_conflicts=True, unique_fields=['code'], update_fields=['name', 'set_type'],
    )
    Printing.objects.bulk_create(
        [Printing(**fields) for fields in printings],
        update_conflicts=True, unique_fields=['id'], update_fields=PRINTING_UPDATE_FIELDS,
    )


def sync_cards(file: str | None = None) -> SyncRun:
    """Upsert every paper printing. All or nothing: a failure keeps yesterday's data."""
    run = SyncRun.objects.create(kind=SyncRun.Kind.CARDS)
    count = 0
    try:
        with _card_lines(file) as lines, transaction.atomic():
            sets, batch = {}, []
            for line_number, line in enumerate(lines, start=1):
                if not line.strip():
                    continue
                try:
                    card = json.loads(line)
                    if should_skip(card):
                        continue
                    sets.setdefault(card['set'], set_fields(card))
                    batch.append(printing_fields(card))
                except (ValueError, KeyError, TypeError) as exc:
                    raise ValueError(f'line {line_number}: {exc!r}') from exc
                if len(batch) >= BATCH_SIZE:
                    _flush(sets, batch)
                    count += len(batch)
                    sets, batch = {}, []
            if batch:
                _flush(sets, batch)
                count += len(batch)
    except Exception as exc:
        log.exception('Card sync failed')
        _finish(run, SyncRun.Status.FAILED, 0, str(exc))
        raise
    _finish(run, SyncRun.Status.SUCCESS, count)
    return run


def sync_rates(eur_pln: Decimal | None = None, usd_pln: Decimal | None = None) -> SyncRun:
    """Store today's NBP mid rates, or the given fixed rates (tests, offline)."""
    run = SyncRun.objects.create(kind=SyncRun.Kind.RATES)
    try:
        fixed = {'EUR': eur_pln, 'USD': usd_pln}
        for code, value in fixed.items():
            if value is not None:
                rate, day = Decimal(value), date.today()
            else:
                entry = _get_json(NBP_RATE_URL.format(code=code.lower()))['rates'][0]
                rate, day = Decimal(str(entry['mid'])), date.fromisoformat(entry['effectiveDate'])
            ExchangeRate.objects.update_or_create(
                currency=code, effective_date=day, defaults={'rate_to_pln': rate},
            )
    except Exception as exc:
        log.exception('Rate sync failed')
        _finish(run, SyncRun.Status.FAILED, 0, str(exc))
        raise
    _finish(run, SyncRun.Status.SUCCESS, len(fixed))
    return run


def _finish(run: SyncRun, status: str, rows: int, error: str = '') -> None:
    run.status, run.rows, run.error, run.finished_at = status, rows, error, timezone.now()
    run.save(update_fields=['status', 'rows', 'error', 'finished_at'])
