"""Deck card categories from Scryfall's Tagger tags (spec 022, AC-1 to AC-3).

Scryfall publishes every oracle tag as a bulk file. Each category below is a set
of tags, child tags included. Tags are keyed by id: Scryfall says slugs can change.
"""

import gzip
import json
import logging
import shutil
import tempfile
import urllib.request
from contextlib import contextmanager
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from .models import CardInsight, Printing, SyncRun

log = logging.getLogger(__name__)

BULK_URL = 'https://api.scryfall.com/bulk-data/oracle-tags'
HEADERS = {'User-Agent': 'MTGVault/0.1', 'Accept': 'application/json'}

# In priority order: a card's first category is its primary one.
CATEGORY_TAGS: dict[str, list[str]] = {
    'Ramp': ['2f3e4ad7-5e60-41b4-bdbc-653f16869cf6'],  # ramp
    'Card draw': [
        'b6448c45-ce65-4848-aa98-2151e4e07437',  # draw
        'a9b682a7-47ed-4d0d-8a2f-30e9d075525f',  # card-advantage
    ],
    'Removal': ['444f824c-f910-4530-9dbe-ede7a84cd7f9'],  # removal
    'Board wipe': ['3fb7e4fd-5304-4120-b7c4-8a89f70ad3f0'],  # sweeper
    'Counterspell': ['690fc968-48ba-4854-a948-3db6bf19d3a9'],  # counterspell
    'Tutor': ['c768d2ec-3264-4a90-a98f-bea8467857d3'],  # tutor
    'Protection': ['6e2cdc7c-b02c-4b59-a171-f93723721b79'],  # protection
    'Recursion': [
        '82b824ad-648f-467f-a190-2e0fa9a795d2',  # recursion
        '524d7da0-9b4b-4567-bf38-a867673e21f3',  # reanimate
    ],
    'Tokens': [
        'a9657a5d-e7f8-4000-a795-7a78b5fb8923',  # repeatable-token-generator
        '9353fde3-59e2-46ab-8dd7-12c699f6e68f',  # synergy-token
    ],
    'Counters': [
        '9cbfd4f0-aa13-4d0e-9e57-11d1d482e8a0',  # counters-matter
        '49e102d4-7074-4942-bdf6-cff4a032e1b1',  # counter-doubler
        'b7cfc923-3a15-4168-876b-525ce37850c5',  # repeatable-proliferate
    ],
    'Sacrifice': ['c7bd55a7-1ea0-49da-b25e-0be470fbe8ec'],  # sacrifice-outlet
    'Graveyard': [
        'bcae5f6a-f68b-4217-8f6c-0b4d31abd045',  # mill-self
        '50ca3b86-4bbb-405c-baf3-40a87f941e2a',  # graveyard-fuel
    ],
    'Lifegain': ['4caab3cc-1d60-44fb-a26a-cc833bc67c97'],  # lifegain
    'Burn': ['0641a74c-4dd5-426d-be58-2ab86d71995d'],  # burn
    'Evasion': ['c7756471-d290-452f-bfc6-24866c841f28'],  # evasion
    'Stax': [
        '2ffad104-2092-410d-9a71-080c57b2e8c5',  # tax
        'd678e4c3-6d99-43e0-8f36-1c085a8fec54',  # lockdown
        'faa8caa6-aa2e-4728-af42-f0917be20616',  # hatebear
    ],
}
CATEGORIES = list(CATEGORY_TAGS)


@contextmanager
def _tag_lines(file: str | None):
    if file:
        opener = gzip.open if file.endswith('.gz') else open
        with opener(file, 'rt', encoding='utf-8') as handle:
            yield handle
        return
    with urllib.request.urlopen(urllib.request.Request(BULK_URL, headers=HEADERS), timeout=30) as response:
        uri = json.load(response)['jsonl_download_uri']
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'tags.jsonl.gz'
        with urllib.request.urlopen(urllib.request.Request(uri, headers=HEADERS), timeout=300) as response:
            with path.open('wb') as out:
                shutil.copyfileobj(response, out)
        with gzip.open(path, 'rt', encoding='utf-8') as handle:
            yield handle


def categories_by_oracle(tags: list[dict]) -> dict[str, list[str]]:
    """oracle_id -> categories in CATEGORY_TAGS order, walking child tags."""
    by_id = {t['id']: t for t in tags}

    def subtree(tag_id: str) -> set[str]:
        seen, stack, oracles = set(), [tag_id], set()
        while stack:
            current = stack.pop()
            if current in seen or current not in by_id:
                continue
            seen.add(current)
            oracles.update(t['oracle_id'] for t in by_id[current].get('taggings') or [])
            stack.extend(by_id[current].get('child_ids') or [])
        return oracles

    result: dict[str, list[str]] = {}
    for category, tag_ids in CATEGORY_TAGS.items():
        oracles = set().union(*(subtree(t) for t in tag_ids))
        for oracle in oracles:
            result.setdefault(oracle, []).append(category)
    return result


def land_oracles() -> set:
    """Cards whose front face is a land: they get no category (AC-1)."""
    return set(Printing.objects.filter(types__contains=['Land']).values_list('oracle_id', flat=True).distinct())


def sync_tags(file: str | None = None) -> SyncRun:
    """Store every card's categories. The first successful run recategorises deck cards (AC-3)."""
    first = not SyncRun.objects.filter(kind=SyncRun.Kind.TAGS, status=SyncRun.Status.SUCCESS).exists()
    run = SyncRun.objects.create(kind=SyncRun.Kind.TAGS)
    try:
        with _tag_lines(file) as lines:
            tags = [json.loads(line) for line in lines if line.strip()]
        found = categories_by_oracle(tags)
        lands = {str(o) for o in land_oracles()}
        with transaction.atomic():
            known = {str(o) for o in CardInsight.objects.values_list('oracle_id', flat=True)}
            rows = [CardInsight(oracle_id=o, categories=[] if o in lands else c) for o, c in found.items()]
            CardInsight.objects.bulk_create(rows, batch_size=2000, update_conflicts=True,
                                            unique_fields=['oracle_id'], update_fields=['categories'])
            # Cards that lost every tag.
            CardInsight.objects.filter(oracle_id__in=known - set(found)).update(categories=[])
            if first:
                recategorize_all()
    except Exception as exc:
        log.exception('Tag sync failed')
        _finish(run, SyncRun.Status.FAILED, 0, str(exc))
        raise
    _finish(run, SyncRun.Status.SUCCESS, len(found))
    return run


def auto_categories(oracle_id) -> list[str]:
    row = CardInsight.objects.filter(oracle_id=oracle_id).values_list('categories', flat=True).first()
    return list(row or [])


def recategorize_all() -> int:
    """Replace every deck card's categories with the automatic ones (AC-3)."""
    from decks.models import DeckCard

    found = dict(CardInsight.objects.values_list('oracle_id', 'categories'))
    cards = list(DeckCard.objects.only('id', 'oracle_id', 'categories'))
    for card in cards:
        card.categories = list(found.get(card.oracle_id) or [])
    DeckCard.objects.bulk_update(cards, ['categories'], batch_size=2000)
    return len(cards)


def _finish(run: SyncRun, status: str, rows: int, error: str = '') -> None:
    run.status, run.rows, run.error, run.finished_at = status, rows, error, timezone.now()
    run.save(update_fields=['status', 'rows', 'error', 'finished_at'])
