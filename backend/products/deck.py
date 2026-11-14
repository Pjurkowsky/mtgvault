"""Which products hold a deck's cards (spec 030, AC-2 to AC-7; spec 032)."""

from collections import defaultdict
from datetime import date

from cards.models import Printing
from decks.legality import COUNTED
from decks.ownership import deck_ownership

from .chance import pack_chance
from .models import BoosterLayout, BoosterSheet, Product, ProductCard, SheetCard

CARDS = ('missing', 'all')
PRINTINGS = ('any', 'chosen')
SINCE = (0, 1, 2, 3, 4)


def cutoff(years: int, today: date | None = None) -> date | None:
    """The first release date `years` back from today; None for Any."""
    if not years:
        return None
    today = today or date.today()
    try:
        return today.replace(year=today.year - years)
    except ValueError:  # 29 February
        return today.replace(year=today.year - years, day=28)


def deck_products(deck, cards, which='missing', printing='any', since=0) -> dict:
    # Basic lands are in every product: never looked for (spec 032, AC-7).
    counted = [c for c in cards if c.zone in COUNTED and not c.printing.type_line.startswith('Basic')]
    if which == 'missing':
        own = deck_ownership(deck, counted)
        counted = [c for c in counted if own[c.id]['state'] == 'missing']
    # One entry per card, however many zones or rows it has.
    wanted: dict = {}
    for c in counted:
        wanted.setdefault(c.oracle_id, c)
    if printing == 'chosen':
        oracle_of = {c.printing_id: c.oracle_id for c in wanted.values()}
    else:
        oracle_of = dict(Printing.objects.filter(oracle_id__in=wanted).values_list('id', 'oracle_id'))

    products = Product.objects.all()
    if first := cutoff(since):
        products = products.filter(released_at__gte=first)
    rows = list(ProductCard.objects.filter(printing_id__in=oracle_of, product__in=products)
                .select_related('product', 'printing__set'))

    decks, boosters = {}, {}
    for row in rows:
        target = decks if row.product.kind == Product.Kind.DECK else boosters
        entry = target.setdefault(row.product_id, {'product': row.product, 'cards': {}, 'commanders': []})
        oracle = oracle_of[row.printing_id]
        best = entry['cards'].get(oracle)
        # The product's own printing; in a booster the likeliest one.
        if best is None or (row.chance or 0) > (best.chance or 0):
            entry['cards'][oracle] = row

    _booster_chances(boosters, oracle_of)
    for e in boosters.values():
        # A card a pack can never hold (weight 0) doesn't count.
        e['cards'] = {o: r for o, r in e['cards'].items() if e['card_chance'][o] > 0}
    _commanders(decks)

    def card(row, chance=None):
        return {'printing': row.printing, 'copies': row.copies, 'chance': chance}

    entries = [
        {'product': e['product'], 'count': len(e['cards']), 'commanders': e['commanders'],
         'cards': sorted((card(r) for r in e['cards'].values()), key=lambda x: x['printing'].name)}
        for e in decks.values()
    ] + [
        {'product': e['product'], 'count': len(e['cards']), 'commanders': [],
         'cards': sorted((card(r, e['card_chance'][o]) for o, r in e['cards'].items()), key=lambda x: (-x['chance'], x['printing'].name))}
        for e in boosters.values() if e['cards']
    ]
    # Most cards first, then the newer product (spec 032, AC-2).
    entries.sort(key=lambda e: (-e['count'], -(e['product'].released_at or date.min).toordinal(), e['product'].name))
    sections = {s.value: [] for s in Product.Section}
    for e in entries:
        sections[e['product'].section].append(e)

    found = {o for e in entries for o in (oracle_of[c['printing'].id] for c in e['cards'])}
    none = sorted((c.printing for o, c in wanted.items() if o not in found), key=lambda p: p.name)
    return {'sections': sections, 'none': none, 'cards': len(wanted)}


def _commanders(decks: dict) -> None:
    """Each deck's commanders (spec 032, AC-3), whether or not the deck needs them."""
    rows = ProductCard.objects.filter(product_id__in=list(decks), commander=True).select_related('printing__set').order_by('printing__name')
    for row in rows:
        decks[row.product_id]['commanders'].append(row.printing)


def _booster_chances(boosters: dict, oracle_of: dict) -> None:
    """Each wanted card's chance per pack in each booster."""
    if not boosters:
        return
    ids = list(boosters)
    layouts, sheets = defaultdict(list), defaultdict(dict)
    for product_id, weight, slots in BoosterLayout.objects.filter(product_id__in=ids).values_list('product_id', 'weight', 'slots'):
        layouts[product_id].append((weight, slots))
    for product_id, name, total, fixed in BoosterSheet.objects.filter(product_id__in=ids).values_list('product_id', 'name', 'total_weight', 'fixed'):
        sheets[product_id][name] = (total, fixed)
    # {product: {oracle: {sheet: weight}}}
    weights = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for product_id, sheet, printing_id, weight in (SheetCard.objects.filter(sheet__product_id__in=ids, printing_id__in=oracle_of)
                                                    .values_list('sheet__product_id', 'sheet__name', 'printing_id', 'weight')):
        weights[product_id][oracle_of[printing_id]][sheet] += weight
    for product_id, entry in boosters.items():
        by_card = weights[product_id]
        entry['card_chance'] = {o: pack_chance(layouts[product_id], sheets[product_id], by_card.get(o, {})) for o in entry['cards']}
