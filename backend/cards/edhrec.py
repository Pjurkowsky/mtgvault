"""EDHREC data for the card detail tabs (spec 002, AC-28 to AC-36).

EDHREC has no official API. We read the JSON behind its card pages, keep only
what the tabs need, and cache it, so a format change or outage only empties
the tabs ("No EDHREC data") and never breaks the dialog.
"""

import json
import logging
import re
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q

from .models import Printing

log = logging.getLogger(__name__)

URL = 'https://json.edhrec.com/pages/cards/{slug}.json'
HEADERS = {'User-Agent': 'MTGVault/0.1', 'Accept': 'application/json'}
CACHE_FOUND = 24 * 60 * 60
CACHE_MISSING = 60 * 60
# Lists we don't show as "Played with" groups.
NOT_PLAYED_WITH = {'newcommanders', 'topcommanders', 'newcards', 'topcards'}
UNAVAILABLE = {'available': False, 'commanders': [], 'played_with': [], 'similar': []}


def slug(name: str) -> str:
    """'Jace, the Mind Sculptor' -> 'jace-the-mind-sculptor'. Front face only."""
    front = name.split(' // ')[0]
    ascii_name = unicodedata.normalize('NFKD', front).encode('ascii', 'ignore').decode()
    cleaned = re.sub(r'[^a-z0-9\s-]', '', ascii_name.lower())
    return re.sub(r'[\s-]+', '-', cleaned.strip())


def _fetch(card_slug: str) -> dict | None:
    """Raw EDHREC JSON, or None when EDHREC has no page. Raises on network errors."""
    fixture_dir = settings.EDHREC_FIXTURE_DIR
    if fixture_dir:
        path = Path(fixture_dir) / f'{card_slug}.json'
        return json.loads(path.read_text()) if path.exists() else None
    request = urllib.request.Request(URL.format(slug=card_slug), headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 404):  # EDHREC answers 403 for unknown cards
            return None
        raise


def _convert(raw: dict) -> dict:
    lists = raw['container']['json_dict']['cardlists']
    commanders = []
    for cardlist in lists:
        if cardlist.get('tag') == 'topcommanders':
            for view in cardlist.get('cardviews', []):
                if view.get('potential_decks'):
                    commanders.append({'name': view['name'], 'share': round(view['num_decks'] / view['potential_decks'], 4)})
    played_with = [
        {
            'group': cardlist['header'],
            'cards': sorted(
                ({'name': view['name'], 'synergy': view.get('lift')} for view in cardlist.get('cardviews', [])),
                key=lambda card: -(card['synergy'] or 0),
            ),
        }
        for cardlist in lists
        if cardlist.get('tag') not in NOT_PLAYED_WITH and cardlist.get('cardviews')
    ]
    similar = [{'name': name} for name in raw.get('similar', []) if isinstance(name, str)]
    return {'available': True, 'commanders': commanders, 'played_with': played_with, 'similar': similar}


def _attach_catalog(result: dict) -> dict:
    """Add oracle_id and images for every name we have, in one query."""
    cards = result['commanders'] + result['similar'] + [c for g in result['played_with'] for c in g['cards']]
    names = {card['name'] for card in cards}
    # Partner pairs ("Frodo, Adventurous Hobbit // Sam, Loyal Attendant") are two
    # cards; double-faced cards use " // " too but match by full name first.
    names |= {card['name'].split(' // ')[0] for card in cards}
    found = {}
    printings = (
        Printing.objects.filter(Q(name__in=names) | Q(front_name__in=names))
        .order_by('-released_at')
        .values('name', 'front_name', 'oracle_id', 'image_small', 'image_normal')
    )
    for p in printings:
        for key in (p['name'], p['front_name']):
            found.setdefault(key, p)
    for card in cards:
        match = found.get(card['name']) or found.get(card['name'].split(' // ')[0])
        card['oracle_id'] = str(match['oracle_id']) if match else None
        card['image_small'] = match['image_small'] if match else ''
        card['image_normal'] = match['image_normal'] if match else ''
    return result


def edhrec_for(card_name: str) -> dict:
    card_slug = slug(card_name)
    key = f'edhrec:{card_slug}'
    if (cached := cache.get(key)) is not None:
        return cached
    try:
        raw = _fetch(card_slug)
    except Exception:
        log.warning('EDHREC fetch failed for %s', card_slug, exc_info=True)
        return UNAVAILABLE  # not cached: try again next time
    if raw is None:
        cache.set(key, UNAVAILABLE, CACHE_MISSING)
        return UNAVAILABLE
    try:
        result = _attach_catalog(_convert(raw))
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        log.warning('Unexpected EDHREC format for %s', card_slug, exc_info=True)
        cache.set(key, UNAVAILABLE, CACHE_MISSING)
        return UNAVAILABLE
    cache.set(key, result, CACHE_FOUND)
    return result
