"""Which deck cards you own, and where (spec 004, AC-13, AC-14)."""

from collections import defaultdict

from collection.models import CollectionItem

from .legality import COUNTED


def deck_ownership(deck, cards) -> dict[int, dict]:
    """{deck_card_id: ownership} for the given DeckCards of `deck`."""
    oracles = {c.oracle_id for c in cards}
    rows = (
        CollectionItem.objects.filter(user_id=deck.user_id, in_cart=False, printing__oracle_id__in=oracles)
        .select_related('printing', 'location__deck')
    )
    in_box = defaultdict(int)
    other = defaultdict(lambda: defaultdict(int))
    free = defaultdict(list)
    for row in rows:
        oracle = row.printing.oracle_id
        location = row.location
        if location is not None and location.id == deck.location_id:
            in_box[oracle] += row.quantity
        elif location is not None and hasattr(location, 'deck'):
            other[oracle][location.deck.name] += row.quantity
        else:
            free[oracle].append({
                'item_id': row.id, 'quantity': row.quantity, 'location': location.name if location else 'Unfiled',
                'location_id': location.id if location else None, 'set_code': row.printing.set_id,
                'collector_number': row.printing.collector_number, 'finish': row.finish,
            })

    # Copies needed per card across Commander, Mainboard and Sideboard (Maybeboard on its own).
    needed = defaultdict(int)
    for c in cards:
        if c.zone in COUNTED:
            needed[c.oracle_id] += c.quantity

    result = {}
    for c in cards:
        need = needed[c.oracle_id] if c.zone in COUNTED else c.quantity
        box_n = in_box[c.oracle_id]
        free_n = sum(f['quantity'] for f in free[c.oracle_id])
        other_n = sum(other[c.oracle_id].values())
        if box_n >= need:
            state = 'in_box'
        elif box_n + free_n >= need:
            state = 'owned'
        elif box_n + free_n + other_n >= need:
            state = 'other_decks'
        else:
            state = 'missing'
        result[c.id] = {
            'state': state,
            'needed': need,
            'in_box': box_n,
            'free': free_n,
            'in_other_decks': other_n,
            'missing': max(0, need - box_n - free_n - other_n),
            'free_copies': free[c.oracle_id],
            'other_decks': [{'deck': name, 'quantity': q} for name, q in other[c.oracle_id].items()],
        }
    return result
