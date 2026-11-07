"""Tokens, emblems and markers that printings make (spec 015)."""

from .models import Printing, Token

FIELDS = ('id', 'oracle_id', 'name', 'type_line', 'set_code', 'collector_number', 'image_small', 'image_normal', 'image_large')


def tokens_by_id(ids) -> dict:
    """Scryfall id -> token data. Token rows first; a token part Scryfall files as a card
    (some dungeons) comes from Printing."""
    ids = set(ids)
    found = {t['id']: t for t in Token.objects.filter(id__in=ids).values(*FIELDS)}
    rest = ids - set(found)
    if rest:
        for p in Printing.objects.filter(id__in=rest).values(*FIELDS[:4], 'set_id', *FIELDS[5:]):
            p['set_code'] = p.pop('set_id')
            found[p['id']] = p
    return found


def kind(token: dict):
    """Every token of a kind shares an oracle id (all Treasures are one kind)."""
    return token['oracle_id'] or token['name']


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


def deck_tokens(cards) -> list[dict]:
    """One per kind for the given deck cards, with the ids of the cards that make it.
    The first maker by name picks the art (AC-2, AC-3)."""
    cards = sorted(cards, key=lambda c: c.printing.name)
    found = tokens_by_id(i for c in cards for i in c.printing.token_ids)
    kinds: dict = {}
    for c in cards:
        for token_id in c.printing.token_ids:
            token = found.get(token_id)
            if not token:
                continue
            entry = kinds.setdefault(kind(token), {**token, 'makers': []})
            if c.id not in entry['makers']:
                entry['makers'].append(c.id)
    return sorted(kinds.values(), key=lambda t: t['name'])
