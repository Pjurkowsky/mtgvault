"""Cheapest printings for the cards a deck still needs (spec 013)."""

from cards.models import Printing
from cards.pricing import price, prices_in_all

from .legality import COUNTED
from .ownership import deck_ownership

# Cards that lack copies for this deck (AC-2): none anywhere, or only in other decks.
LACKING = ('missing', 'other_decks')


def finish_of(printing) -> str:
    """The finish To buy prices: non-foil, else the printing's only one (decks/stats.py)."""
    return 'nonfoil' if 'nonfoil' in printing.finishes else printing.finishes[0]


def unit_price(printing, currency, rates):
    return price(printing, finish_of(printing), currency, rates) if printing.finishes else None


def cheapest_changes(deck, cards, currency: str, rates: dict) -> list[dict]:
    """Per lacking counted card, its cheapest priced printing when cheaper than the current one."""
    own = deck_ownership(deck, cards)
    lacking = [c for c in cards if c.zone in COUNTED and own[c.id]['state'] in LACKING]
    if not lacking:
        return []
    # Newest first, so the newest wins a tie between other printings.
    by_oracle: dict = {}
    for p in Printing.objects.filter(oracle_id__in={c.oracle_id for c in lacking}).select_related('set').order_by('-released_at'):
        by_oracle.setdefault(p.oracle_id, []).append(p)

    changes = []
    for card in lacking:
        current = unit_price(card.printing, currency, rates)
        best, best_price = None, current
        for p in by_oracle.get(card.oracle_id, []):
            value = unit_price(p, currency, rates)
            if value is not None and (best_price is None or value < best_price):
                best, best_price = p, value
        if best is None or best.id == card.printing_id:
            continue
        changes.append({
            'card': card.id, 'name': card.printing.name, 'zone': card.zone, 'state': own[card.id]['state'],
            # Copies To buy counts: none for cards in other decks (decks/stats.py).
            'copies': min(card.quantity, own[card.id]['missing']),
            'printing': card.printing, 'price': current, 'prices': prices_in_all(card.printing, finish_of(card.printing), rates) if card.printing.finishes else None,
            'cheapest': best, 'cheapest_price': best_price, 'cheapest_prices': prices_in_all(best, finish_of(best), rates),
            'saving': None if current is None else current - best_price,
        })
    return changes
