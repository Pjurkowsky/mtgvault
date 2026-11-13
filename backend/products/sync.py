"""Weekly product sync from MTGJSON (spec 030, AC-7, AC-12).

Both files are streamed, so memory stays small: AllPrintings one set at a time,
AllDeckFiles one deck at a time.
"""

import json
import logging
import lzma
import shutil
import tarfile
import tempfile
import urllib.request
from collections import defaultdict
from contextlib import contextmanager
from datetime import date
from pathlib import Path

import ijson
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from cards.models import Printing, SyncRun

from .chance import pack_chance
from .models import BoosterLayout, BoosterSheet, Product, ProductCard, SheetCard

log = logging.getLogger(__name__)

PRINTINGS_URL = 'https://mtgjson.com/api/v5/AllPrintings.json.xz'
DECKS_URL = 'https://mtgjson.com/api/v5/AllDeckFiles.tar.xz'
HEADERS = {'User-Agent': 'MTGVault/0.1'}
BATCH_SIZE = 5000
# Deck types only played online (AC-7), besides those naming Arena or MTGO.
DIGITAL_DECKS = {'Historic Brawl Precon Deck', 'Shandalar Enemy Deck', 'Duel Of The Planeswalkers Deck'}
DECK_ZONES = ('commander', 'mainBoard', 'sideBoard')


def is_digital(*names: str) -> bool:
    text = ' '.join(names).lower()
    return 'arena' in text or 'mtgo' in text


@contextmanager
def _download(url: str, name: str):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / name
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=600) as response, path.open('wb') as out:
            shutil.copyfileobj(response, out)
        yield str(path)


def _open(path: str):
    return lzma.open(path, 'rb') if path.endswith('.xz') else open(path, 'rb')


def _sets(path: str):
    with _open(path) as handle:
        yield from ijson.kvitems(handle, 'data', use_float=True)


def _decks(path: str):
    """Deck dicts from AllDeckFiles.tar.xz, or from a JSON list {"data": [...]} (tests)."""
    if path.endswith('.json'):
        with open(path, encoding='utf-8') as handle:
            yield from json.load(handle)['data']
        return
    with tarfile.open(path, 'r|xz') as tar:
        for member in tar:
            if member.isfile() and member.name.endswith('.json'):
                yield json.load(tar.extractfile(member))['data']


class _Codes:
    """Unique product codes: `blb-play`, then `blb-play-2` …"""

    def __init__(self):
        self.seen = set()

    def __call__(self, *parts: str) -> str:
        base = slugify('-'.join(parts))[:140] or 'product'
        code, n = base, 1
        while code in self.seen:
            n += 1
            code = f'{base}-{n}'
        self.seen.add(code)
        return code


def _date(value):
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def _read(printings_file: str, decks_file: str):
    """Products as plain dicts, with their cards mapped to our printings."""
    known = {str(i) for i in Printing.objects.values_list('id', flat=True)}
    # Pass 1: every MTGJSON card's Scryfall id (sheets may use other sets' cards) and set names.
    scryfall, set_names = {}, {}
    for code, data in _sets(printings_file):
        set_names[code] = data.get('name') or code
        for card in data.get('cards') or ():
            sid = (card.get('identifiers') or {}).get('scryfallId')
            if sid in known:
                scryfall[card['uuid']] = sid

    codes = _Codes()
    products = []
    # Pass 2: booster types.
    for code, data in _sets(printings_file):
        if data.get('isOnlineOnly'):
            continue
        for key, config in (data.get('booster') or {}).items():
            kind = '' if key == 'default' else f" {key.replace('-', ' ').title()}"
            name = config.get('name') or f'{set_names[code]}{kind} Booster'
            if is_digital(key, name):
                continue
            sheets = {}
            for sheet_name, sheet in config['sheets'].items():
                cards = defaultdict(int)
                for uuid, weight in sheet['cards'].items():
                    if uuid in scryfall:
                        cards[scryfall[uuid]] += int(weight)
                sheets[sheet_name] = {'total': int(sheet.get('totalWeight') or sum(sheet['cards'].values())),
                                      'fixed': bool(sheet.get('fixed')), 'cards': cards}
            layouts = [(int(b['weight']), {s: int(n) for s, n in b['contents'].items() if s in sheets}) for b in config['boosters']]
            if not any(s['cards'] for s in sheets.values()):
                continue
            products.append({
                'kind': Product.Kind.BOOSTER, 'code': codes(code, key), 'name': name, 'set_code': code.lower(),
                'set_name': set_names[code], 'released_at': _date(data.get('releaseDate')),
                'sheets': sheets, 'layouts': layouts,
            })

    # Fixed decks.
    for deck in _decks(decks_file):
        if is_digital(deck.get('type') or '') or deck.get('type') in DIGITAL_DECKS:
            continue
        copies = defaultdict(int)
        for zone in DECK_ZONES:
            for card in deck.get(zone) or ():
                sid = (card.get('identifiers') or {}).get('scryfallId')
                if sid in known:
                    copies[sid] += int(card.get('count') or 1)
        if not copies:
            continue
        set_code = deck.get('code') or ''
        products.append({
            'kind': Product.Kind.DECK, 'code': codes(set_code, deck['name']), 'name': deck['name'],
            'set_code': set_code.lower(), 'set_name': set_names.get(set_code, set_code),
            'released_at': _date(deck.get('releaseDate')), 'deck_type': deck.get('type') or '', 'copies': copies,
        })
    return products


def _store(products: list[dict]) -> int:
    Product.objects.all().delete()
    rows = [Product(
        code=p['code'], kind=p['kind'], name=p['name'][:300], set_code=p['set_code'][:10], set_name=p['set_name'][:200],
        released_at=p['released_at'], deck_type=p.get('deck_type', '')[:60],
        total_weight=sum(w for w, _ in p.get('layouts', ())),
    ) for p in products]
    Product.objects.bulk_create(rows, batch_size=BATCH_SIZE)
    cards, sheet_rows, layouts = [], [], []
    for row, p in zip(rows, products):
        if p['kind'] == Product.Kind.DECK:
            cards += [ProductCard(product=row, printing_id=sid, copies=n) for sid, n in p['copies'].items()]
            continue
        layouts += [BoosterLayout(product=row, weight=w, slots=s) for w, s in p['layouts']]
        sheet_info = {name: (s['total'], s['fixed']) for name, s in p['sheets'].items()}
        layout_list = p['layouts']
        # Each printing's own chance per pack (AC-10), summed over the sheets it is on.
        on_sheets = defaultdict(dict)
        for name, s in p['sheets'].items():
            sheet = BoosterSheet(product=row, name=name, total_weight=s['total'], fixed=s['fixed'])
            sheet_rows.append((sheet, s['cards']))
            for sid, weight in s['cards'].items():
                on_sheets[sid][name] = weight
        cards += [ProductCard(product=row, printing_id=sid, chance=pack_chance(layout_list, sheet_info, wanted))
                  for sid, wanted in on_sheets.items()]
    ProductCard.objects.bulk_create(cards, batch_size=BATCH_SIZE)
    BoosterLayout.objects.bulk_create(layouts, batch_size=BATCH_SIZE)
    BoosterSheet.objects.bulk_create([s for s, _ in sheet_rows], batch_size=BATCH_SIZE)
    SheetCard.objects.bulk_create(
        (SheetCard(sheet=s, printing_id=sid, weight=w) for s, sheet_cards in sheet_rows for sid, w in sheet_cards.items()),
        batch_size=BATCH_SIZE)
    return len(rows)


def sync_products(printings_file: str | None = None, decks_file: str | None = None) -> SyncRun:
    """Replace every product. All or nothing: a failure keeps last week's data."""
    run = SyncRun.objects.create(kind=SyncRun.Kind.PRODUCTS)
    try:
        with (_download(PRINTINGS_URL, 'AllPrintings.json.xz') if not printings_file else _given(printings_file)) as printings, \
                (_download(DECKS_URL, 'AllDeckFiles.tar.xz') if not decks_file else _given(decks_file)) as decks:
            products = _read(printings, decks)
        with transaction.atomic():
            count = _store(products)
    except Exception as exc:
        log.exception('Product sync failed')
        _finish(run, SyncRun.Status.FAILED, 0, str(exc))
        raise
    _finish(run, SyncRun.Status.SUCCESS, count)
    return run


@contextmanager
def _given(path: str):
    yield path


def _finish(run: SyncRun, status: str, rows: int, error: str = '') -> None:
    run.status, run.rows, run.error, run.finished_at = status, rows, error, timezone.now()
    run.save(update_fields=['status', 'rows', 'error', 'finished_at'])


def synced() -> bool:
    """Whether any product sync has succeeded (AC-12)."""
    return SyncRun.objects.filter(kind=SyncRun.Kind.PRODUCTS, status=SyncRun.Status.SUCCESS).exists()
