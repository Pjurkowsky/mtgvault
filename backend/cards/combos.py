"""Combos from Commander Spellbook (spec 022, AC-7 to AC-11).

Commander Spellbook publishes every combo variant as one daily file and asks
clients to use it rather than page through the API. We keep the variants and
the cards they use, and match decks against them locally.
"""

import gzip
import json
import logging
import shutil
import tempfile
import urllib.request
from collections import defaultdict
from pathlib import Path

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from collection.models import CollectionItem

from .models import Combo, ComboCard, Printing, SyncRun

log = logging.getLogger(__name__)

VARIANTS_URL = 'https://json.commanderspellbook.com/variants.json.gz'
HEADERS = {'User-Agent': 'MTGVault/0.1 (self-hosted MTG collection app)', 'Accept': 'application/json'}
COMBO_URL = 'https://commanderspellbook.com/combo/{id}/'
BATCH = 5000
MAX_MISSING = 2
MAX_COULD = 200


def is_infinite(name: str) -> bool:
    return name.lower().startswith(('infinite', 'near-infinite'))


def is_win(name: str) -> bool:
    lowered = name.lower()
    return lowered.startswith('win the game') or ('opponent' in lowered and 'loses the game' in lowered)


def _load(file: str | None) -> dict:
    if file:
        opener = gzip.open if file.endswith('.gz') else open
        with opener(file, 'rt', encoding='utf-8') as handle:
            return json.load(handle)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'variants.json.gz'
        with urllib.request.urlopen(urllib.request.Request(VARIANTS_URL, headers=HEADERS), timeout=300) as response:
            with path.open('wb') as out:
                shutil.copyfileobj(response, out)
        with gzip.open(path, 'rt', encoding='utf-8') as handle:
            return json.load(handle)


def combo_rows(variant: dict) -> tuple[Combo, list[ComboCard]] | None:
    """A Combo and its ComboCards, or None for variants we can't match (no oracle id, not OK)."""
    if variant.get('status') != 'OK' or not variant.get('uses'):
        return None
    uses = variant['uses']
    if any(not (use.get('card') or {}).get('oracleId') for use in uses):
        return None
    produces = [p['feature']['name'] for p in variant.get('produces') or []]
    prerequisites = '\n'.join(p for p in (variant.get('easyPrerequisites'), variant.get('notablePrerequisites')) if p)
    combo = Combo(
        id=variant['id'], produces=produces,
        infinite=any(is_infinite(n) for n in produces), wins=any(is_win(n) for n in produces),
        identity=(variant.get('identity') or '').replace('C', ''), popularity=variant.get('popularity') or 0,
        card_count=len({use['card']['oracleId'] for use in uses}), prerequisites=prerequisites,
        description=variant.get('description') or '',
        requires=[r['template']['name'] for r in variant.get('requires') or [] if r.get('template')],
    )
    cards, seen = [], set()
    for position, use in enumerate(uses):
        card = use['card']
        if card['oracleId'] in seen:
            continue
        seen.add(card['oracleId'])
        cards.append(ComboCard(combo_id=combo.id, oracle_id=card['oracleId'], name=card['name'],
                               image=card.get('imageUriFrontNormal') or '', position=position))
    return combo, cards


def sync_combos(file: str | None = None) -> SyncRun:
    """Replace every combo. All or nothing: a failure keeps yesterday's combos."""
    run = SyncRun.objects.create(kind=SyncRun.Kind.COMBOS)
    count = 0
    try:
        data = _load(file)
        with transaction.atomic():
            ComboCard.objects.all().delete()
            Combo.objects.all().delete()
            combos, cards = [], []
            for variant in data['variants']:
                rows = combo_rows(variant)
                if rows is None:
                    continue
                combos.append(rows[0])
                cards.extend(rows[1])
                if len(combos) >= BATCH:
                    count += _flush(combos, cards)
                    combos, cards = [], []
            count += _flush(combos, cards)
    except Exception as exc:
        log.exception('Combo sync failed')
        _finish(run, SyncRun.Status.FAILED, 0, str(exc))
        raise
    _finish(run, SyncRun.Status.SUCCESS, count)
    return run


def _flush(combos: list[Combo], cards: list[ComboCard]) -> int:
    Combo.objects.bulk_create(combos)
    ComboCard.objects.bulk_create(cards, batch_size=BATCH)
    return len(combos)


def _finish(run: SyncRun, status: str, rows: int, error: str = '') -> None:
    run.status, run.rows, run.error, run.finished_at = status, rows, error, timezone.now()
    run.save(update_fields=['status', 'rows', 'error', 'finished_at'])


def deck_combos(oracles: set, identity: set[str] | None, viewer_id: int | None) -> dict:
    """Combos in the deck and infinite or win combos it misses 1-2 cards of (AC-7, AC-8).

    `oracles`: the counted cards. `identity`: the commander's colour identity, or None
    for no colour limit. `viewer_id`: whose collection marks missing cards as owned.
    """
    if not oracles:
        return {'in_deck': [], 'could_build': []}
    matched = dict(
        ComboCard.objects.filter(oracle_id__in=oracles).values('combo_id')
        .annotate(n=Count('id')).values_list('combo_id', 'n')
    )
    combos = Combo.objects.filter(id__in=list(matched))
    in_deck, could = [], []
    for combo in combos:
        missing = combo.card_count - matched[combo.id]
        if missing == 0:
            in_deck.append(combo)
        elif missing <= MAX_MISSING and (combo.infinite or combo.wins) and (identity is None or set(combo.identity) <= identity):
            could.append((missing, combo))
    in_deck.sort(key=lambda c: (-c.popularity, c.id))
    could.sort(key=lambda mc: (mc[0], -mc[1].popularity, mc[1].id))
    could = could[:MAX_COULD]
    chosen = in_deck + [c for _, c in could]

    cards = defaultdict(list)
    for card in ComboCard.objects.filter(combo_id__in=[c.id for c in chosen]).order_by('position'):
        cards[card.combo_id].append(card)
    missing_oracles = {card.oracle_id for rows in cards.values() for card in rows} - oracles
    owned = set()
    if viewer_id is not None and missing_oracles:
        owned = set(CollectionItem.objects.filter(user_id=viewer_id, in_cart=False, printing__oracle_id__in=missing_oracles)
                    .values_list('printing__oracle_id', flat=True))
    printings = dict(
        Printing.objects.filter(oracle_id__in=missing_oracles).order_by('oracle_id', '-released_at')
        .distinct('oracle_id').values_list('oracle_id', 'id')
    )

    def out(combo: Combo) -> dict:
        return {
            'id': combo.id, 'produces': combo.produces, 'infinite': combo.infinite, 'wins': combo.wins,
            'prerequisites': combo.prerequisites, 'description': combo.description, 'requires': combo.requires,
            'url': COMBO_URL.format(id=combo.id),
            'cards': [{
                'oracle_id': card.oracle_id, 'name': card.name, 'image': card.image,
                'in_deck': card.oracle_id in oracles, 'owned': card.oracle_id in owned,
                'printing': printings.get(card.oracle_id),
            } for card in cards[combo.id]],
        }

    # The closest and most played first; enough for Show more (AC-8).
    return {'in_deck': [out(c) for c in in_deck], 'could_build': [out(c) for _, c in could[:MAX_COULD]]}
