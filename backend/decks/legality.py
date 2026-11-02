"""Format rules and deck legality (spec 004, AC-12, AC-22, AC-23)."""

import re
from dataclasses import dataclass

COUNTED = ('commander', 'main', 'side')


@dataclass(frozen=True)
class Rules:
    label: str
    key: str | None          # Scryfall legalities key; None = no card legality check
    size: int | None         # deck size (mainboard + commanders)
    exact: bool              # size must match exactly (otherwise: at least)
    copies: int | None       # max copies of a card; None = no limit
    sideboard: int | None    # max sideboard cards
    commander: bool          # has a commander zone
    commander_types: tuple = ('Creature',)


FORMATS = {
    'commander': Rules('Commander', 'commander', 100, True, 1, None, True),
    'brawl': Rules('Brawl', 'standardbrawl', 60, True, 1, None, True, ('Creature', 'Planeswalker')),
    'standard': Rules('Standard', 'standard', 60, False, 4, 15, False),
    'pioneer': Rules('Pioneer', 'pioneer', 60, False, 4, 15, False),
    'modern': Rules('Modern', 'modern', 60, False, 4, 15, False),
    'legacy': Rules('Legacy', 'legacy', 60, False, 4, 15, False),
    'vintage': Rules('Vintage', 'vintage', 60, False, 4, 15, False),
    'pauper': Rules('Pauper', 'pauper', 60, False, 4, 15, False),
    'casual': Rules('Casual', None, None, False, None, None, False),
}


def unlimited(printing) -> bool:
    """Basic lands and 'A deck can have any number of cards named …' cards."""
    return printing.type_line.startswith('Basic ') or 'deck can have any number of cards named' in printing.oracle_text


def can_be_commander(printing, rules: Rules) -> bool:
    front = printing.type_line.split(' // ')[0]
    if 'Legendary' in front and any(t in front for t in rules.commander_types):
        return True
    return 'can be your commander' in printing.oracle_text


def _partner_with(a, b) -> bool:
    return bool(re.search(r'Partner with ' + re.escape(b.front_name), a.oracle_text))


def can_pair(a, b) -> bool:
    """Two commanders are allowed together (AC-12)."""
    ka, kb = set(a.keywords), set(b.keywords)
    if 'Partner' in ka and 'Partner' in kb:
        return True
    if 'Partner with' in ka and _partner_with(a, b) and _partner_with(b, a):
        return True
    if 'Friends forever' in ka and 'Friends forever' in kb:
        return True
    for x, y in ((a, b), (b, a)):
        if 'Choose a background' in x.keywords and 'Background' in y.type_line:
            return True
        if "Doctor's companion" in x.keywords and 'Doctor' in y.type_line:
            return True
    return False


def issues(deck, cards) -> list[dict]:
    """Every rule the deck breaks. `cards` are DeckCards with printings loaded."""
    rules = FORMATS[deck.format]
    if rules.key is None:
        return []
    counted = [c for c in cards if c.zone in COUNTED]
    problems = []

    def add(code, message, names=()):
        problems.append({'code': code, 'message': message, 'cards': sorted(set(names))})

    # Card legality from Scryfall
    for status, label in (('banned', 'Banned'), ('not_legal', 'Not legal')):
        names = [c.printing.name for c in counted if c.printing.legalities.get(rules.key, 'not_legal') == status]
        if names:
            add(status, f'{label} in {rules.label}: {len(set(names))} {"card" if len(set(names)) == 1 else "cards"}.', names)

    # Copies per card (restricted = 1)
    per_card = {}
    for c in counted:
        per_card.setdefault(c.oracle_id, [c.printing, 0])[1] += c.quantity
    too_many = []
    for printing, quantity in per_card.values():
        limit = 1 if printing.legalities.get(rules.key) == 'restricted' else rules.copies
        if limit is not None and quantity > limit and not unlimited(printing):
            too_many.append(f'{printing.name} ({quantity}/{limit})')
    if too_many:
        add('copies', f'Too many copies: {", ".join(sorted(too_many))}.', [t.rsplit(' (', 1)[0] for t in too_many])

    # Deck size (mainboard + commanders) and sideboard
    size = sum(c.quantity for c in counted if c.zone in ('commander', 'main'))
    if rules.size is not None:
        if rules.exact and size != rules.size:
            add('size', f'{rules.label} decks have exactly {rules.size} cards; this one has {size}.')
        elif not rules.exact and size < rules.size:
            add('size', f'{rules.label} decks have at least {rules.size} cards in the mainboard; this one has {size}.')
    side = sum(c.quantity for c in counted if c.zone == 'side')
    if rules.sideboard is not None and side > rules.sideboard:
        add('sideboard', f'The sideboard has {side} cards; at most {rules.sideboard}.')

    # Commander and color identity
    if rules.commander:
        commanders = [c.printing for c in counted if c.zone == 'commander' for _ in range(c.quantity)]
        if not commanders:
            add('commander', 'Choose a commander.')
        elif len(commanders) > 2:
            add('commander', 'A deck has at most two commanders.')
        else:
            bad = [p.name for p in commanders if not can_be_commander(p, rules)]
            if bad:
                add('commander', f'{", ".join(bad)} cannot be a commander.', bad)
            if len(commanders) == 2 and not can_pair(*commanders):
                add('commander', f'{commanders[0].name} and {commanders[1].name} cannot be commanders together.',
                    [p.name for p in commanders])
            identity = {color for p in commanders for color in p.color_identity}
            outside = [c.printing.name for c in counted if c.zone != 'commander' and not set(c.printing.color_identity) <= identity]
            if outside:
                add('colors', f'Outside the commander\'s colors: {len(set(outside))} {"card" if len(set(outside)) == 1 else "cards"}.', outside)
    return problems
