"""Deck stats (spec 004, AC-24)."""

from decimal import Decimal

from cards.pricing import CURRENCIES, price

from .legality import COUNTED

TYPE_ORDER = ['Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land']


def deck_stats(cards, ownership: dict, currency: str, rates: dict) -> dict:
    counted = [c for c in cards if c.zone in COUNTED]
    curve = {str(n): 0 for n in range(7)} | {'7+': 0}
    pips = {c: 0 for c in 'WUBRGC'}
    types = {t: 0 for t in TYPE_ORDER}
    mv_total, nonland = Decimal(0), 0
    values = {key: {cur: Decimal(0) for cur in CURRENCIES} for key in ('total', 'owned', 'missing')}

    for c in counted:
        p, q = c.printing, c.quantity
        front_types = p.types or []
        if 'Land' not in front_types:
            mv = int(p.cmc)
            curve['7+' if mv >= 7 else str(mv)] += q
            mv_total += p.cmc * q
            nonland += q
        for symbol in 'WUBRGC':
            pips[symbol] += p.mana_cost.count('{' + symbol) * q
        for t in front_types:
            if t in types:
                types[t] += q
        own = ownership[c.id]
        owned_copies = min(q, own['in_box'] + own['free'])
        missing_copies = min(q, own['missing'])
        for cur in CURRENCIES:
            unit = price(p, 'nonfoil' if 'nonfoil' in p.finishes else p.finishes[0], cur, rates) or Decimal(0)
            values['total'][cur] += unit * q
            values['owned'][cur] += unit * owned_copies
            values['missing'][cur] += unit * missing_copies

    return {
        'curve': curve,
        'pips': pips,
        'types': {t: n for t, n in types.items() if n},
        'average_mana_value': round(float(mv_total / nonland), 2) if nonland else 0,
        'values': {k: {cur: round(v, 2) for cur, v in vals.items()} for k, vals in values.items()},
        'value': {k: round(vals[currency], 2) for k, vals in values.items()},
    }
