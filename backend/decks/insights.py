"""Deck salt and commander themes from EDHREC (spec 022, AC-12 to AC-15)."""

from cards.edhrec import commander_themes, fetch_salts, salt_stale_before
from cards.models import CardInsight

from .legality import COUNTED, FORMATS
from .models import DeckCard

AVERAGE_SALT = 36  # EDHREC's average deck (AC-12)
TOP_SALTY = 5


def _counted(cards) -> dict:
    return {c.oracle_id: c.printing.name for c in cards if c.zone in COUNTED}


def deck_salt(cards) -> dict:
    """Sum of the scores known so far; `pending` cards have none yet or a stale one (AC-14)."""
    counted = _counted(cards)
    rows = {r.oracle_id: r for r in CardInsight.objects.filter(oracle_id__in=list(counted))}
    stale = salt_stale_before()
    pending = sum(1 for o in counted if o not in rows or not rows[o].salt_checked_at or rows[o].salt_checked_at < stale)
    scored = sorted(((counted[o], float(r.salt)) for o, r in rows.items() if r.salt is not None), key=lambda ns: (-ns[1], ns[0]))
    return {
        'total': round(sum(s for _, s in scored), 2), 'average': AVERAGE_SALT, 'pending': pending,
        'top': [{'name': n, 'salt': round(s, 2)} for n, s in scored[:TOP_SALTY]],
    }


def deck_insights(deck, cards) -> dict:
    """Fetch missing salt scores, then the deck salt and the commander's themes."""
    fetch_salts(_counted(cards))
    commanders = [c.printing.name for c in cards if c.zone == DeckCard.Zone.COMMANDER]
    themes = commander_themes(commanders) if FORMATS[deck.format].commander else []
    return {'salt': deck_salt(cards), 'themes': themes}
