"""Tokens, emblems and markers that printings make (spec 015), their printings and prices (spec 021)."""

from types import SimpleNamespace
from uuid import UUID

from .models import Printing, Token
from .pricing import price, prices_in_all
from .scryfall import PRICE_FIELDS

FIELDS = ('id', 'oracle_id', 'name', 'type_line', 'set_code', 'collector_number', 'image_small', 'image_normal', 'image_large')
EXTRA = ('set_name', 'released_at', 'finishes', *PRICE_FIELDS)


def _printing_rows(queryset) -> list[dict]:
    """A token part Scryfall files as a card (some dungeons), shaped like a Token row."""
    rows = []
    for p in queryset.values(*FIELDS[:4], 'set_id', 'set__name', *FIELDS[5:], 'released_at', 'finishes', *PRICE_FIELDS):
        p['set_code'] = p.pop('set_id')
        p['set_name'] = p.pop('set__name')
        rows.append(p)
    return rows


def tokens_by_id(ids) -> dict:
    """Scryfall id -> token data. Token rows first; a token part Scryfall files as a card
    (some dungeons) comes from Printing."""
    ids = set(ids)
    found = {t['id']: t for t in Token.objects.filter(id__in=ids).values(*FIELDS, *EXTRA)}
    rest = ids - set(found)
    if rest:
        found.update({p['id']: p for p in _printing_rows(Printing.objects.filter(id__in=rest))})
    return found


def kind(token: dict) -> str:
    """Every token of a kind shares an oracle id (all Treasures are one kind)."""
    return str(token['oracle_id']) if token['oracle_id'] else token['name']


def finish_of(token: dict) -> str:
    finishes = token.get('finishes') or []
    return 'nonfoil' if 'nonfoil' in finishes or not finishes else finishes[0]


def with_price(token: dict, ctx: dict) -> dict:
    """Non-foil price, else the only finish's (spec 021, AC-11)."""
    ns, finish = SimpleNamespace(**token), finish_of(token)
    return {**token, 'price': price(ns, finish, ctx['currency'], ctx['rates']), 'prices': prices_in_all(ns, finish, ctx['rates'])}


def tokens_for(printing) -> list[dict]:
    """One per kind, in Scryfall's order."""
    found = tokens_by_id(printing.token_ids)
    out, seen = [], set()
    for token_id in printing.token_ids:
        token = found.get(token_id)
        if token and kind(token) not in seen:
            seen.add(kind(token))
            out.append(token)
    return out


def printings_of(token_id) -> list[dict]:
    """Every printing of this token's kind, newest first (spec 021, AC-10)."""
    token = tokens_by_id([token_id]).get(token_id)
    if token is None:
        return []
    if Token.objects.filter(id=token_id).exists():
        rows = Token.objects.filter(oracle_id=token['oracle_id']) if token['oracle_id'] else Token.objects.filter(name=token['name'])
        rows = list(rows.values(*FIELDS, *EXTRA))
    else:
        rows = _printing_rows(Printing.objects.filter(oracle_id=token['oracle_id']).select_related('set'))
    return sorted(rows, key=lambda t: (t['released_at'] is not None, t['released_at']), reverse=True)


def deck_tokens(cards, chosen: dict | None = None, ctx: dict | None = None) -> list[dict]:
    """One per kind for the given deck cards, with the ids of the cards that make it.
    The first maker by name picks the art (spec 015 AC-2, AC-3), unless the deck's owner
    chose a printing for that kind (spec 021, AC-10)."""
    chosen = {k: UUID(str(v)) for k, v in (chosen or {}).items()}
    cards = sorted(cards, key=lambda c: c.printing.name)
    found = tokens_by_id([i for c in cards for i in c.printing.token_ids] + list(chosen.values()))
    kinds: dict = {}
    for c in cards:
        for token_id in c.printing.token_ids:
            token = found.get(token_id)
            if not token:
                continue
            entry = kinds.setdefault(kind(token), {**token, 'makers': []})
            if c.id not in entry['makers']:
                entry['makers'].append(c.id)
    out = []
    for key, entry in kinds.items():
        pick = found.get(chosen.get(key))
        if pick and kind(pick) == key:
            entry = {**pick, 'makers': entry['makers']}
        entry = {**entry, 'kind': key, 'chosen': bool(pick and kind(pick) == key)}
        out.append(with_price(entry, ctx) if ctx else entry)
    return sorted(out, key=lambda t: t['name'])
