"""Binder slots (spec 007). A placed copy is a BinderSlot; a row's other copies
are the binder's Unplaced ones. Every write that changes where copies are goes
through here or through `sync_slots`, which runs after each row save."""

from django.db import transaction
from django.db.models import Count, Max
from rest_framework.exceptions import ValidationError

from .filters import ItemFilterSerializer, apply_filters
from .models import BinderSection, BinderSlot, CollectionItem, Location

MAX_GRID = 6
MAX_PAGES = 500
DIRECTIONS = ('rows', 'columns')
SECTION_FILTER_KEYS = ('color', 'type', 'rarity', 'set', 'finish', 'condition', 'price_min', 'price_max')


def is_binder(location) -> bool:
    return location is not None and location.kind == Location.Kind.BINDER


def sync_slots(item: CollectionItem):
    """A row keeps slots only in its own location, at most one per copy; extra ones go
    from the end of the binder (highest page and slot first). One query for a row without slots."""
    slots = list(BinderSlot.objects.filter(item_id=item.pk).values_list('id', 'location_id', 'page', 'row', 'col', 'position'))
    if not slots:
        return
    keep = [] if item.in_cart or item.location_id is None else [s for s in slots if s[1] == item.location_id]
    keep.sort(key=lambda s: s[2:], reverse=True)
    drop = {s[0] for s in slots} - {s[0] for s in keep[max(0, len(keep) - item.quantity):]}
    if drop:
        BinderSlot.objects.filter(id__in=drop).delete()


def move_slots(source: CollectionItem, target: CollectionItem):
    """A row merging into another hands over its slots (spec assumption)."""
    BinderSlot.objects.filter(item_id=source.pk).update(item_id=target.pk)


# ---------- reading ----------

def in_range(location: Location, page: int, row: int, col: int) -> bool:
    return (1 <= row <= location.binder_rows and 1 <= col <= location.binder_cols and page >= 1
            and (location.binder_pages is None or page <= location.binder_pages))


def page_count(location: Location) -> int:
    """A fixed count, or as many pages as the last placed card needs plus one empty page (AC-9)."""
    if location.binder_pages:
        return location.binder_pages
    last = location.binder_slots.aggregate(m=Max('page'))['m'] or 0
    return last + 1


def binder_items(location: Location):
    return CollectionItem.objects.filter(location=location, in_cart=False)


def unplaced_counts(location: Location) -> dict[int, int]:
    rows = binder_items(location).annotate(placed=Count('slots')).values('id', 'quantity', 'placed')
    return {r['id']: r['quantity'] - r['placed'] for r in rows if r['quantity'] > r['placed']}


def section_filter(raw: dict) -> dict:
    data = ItemFilterSerializer(data={k: v for k, v in (raw or {}).items() if k in SECTION_FILTER_KEYS})
    data.is_valid(raise_exception=True)
    return data.validated_data


def section_matches(location: Location, ctx) -> dict[int, set[int] | None]:
    """Per section: the ids of the binder's rows that match its filter, None without a filter."""
    out = {}
    for section in location.binder_sections.all():
        params = section_filter(section.filter)
        if not any(params.get(k) not in (None, [], '') for k in SECTION_FILTER_KEYS):
            out[section.pk] = None
            continue
        params['location'] = str(location.pk)
        out[section.pk] = set(apply_filters(binder_items(location), params, ctx['currency'], ctx['rates'])
                              .values_list('id', flat=True))
    return out


def mismatched_slots(location: Location, slots, matches: dict) -> set[int]:
    """Slots on a section's pages whose card doesn't match its filter (AC-11)."""
    out = set()
    for section in location.binder_sections.all():
        matching = matches.get(section.pk)
        if matching is None:
            continue
        out |= {s.id for s in slots if section.first_page <= s.page <= section.last_page and s.item_id not in matching}
    return out


# ---------- placing ----------

def _taken(location: Location) -> set[tuple[int, int, int]]:
    return set(location.binder_slots.values_list('page', 'row', 'col'))


def _top(location: Location, page: int, row: int, col: int) -> int:
    top = location.binder_slots.filter(page=page, row=row, col=col).aggregate(m=Max('position'))['m']
    return -1 if top is None else top


def _check_place(location: Location, place: dict):
    if not in_range(location, place['page'], place['row'], place['col']):
        raise ValidationError({'to': ['That slot is outside the binder.']})


def _unplaced_row(location: Location, item_id: int) -> CollectionItem:
    row = binder_items(location).select_for_update().filter(pk=item_id).first()
    if row is None:
        raise ValidationError({'item': ['That card is not in this binder.']})
    if row.slots.count() >= row.quantity:
        raise ValidationError({'item': ['Every copy of this card already has a slot.']})
    return row


@transaction.atomic
def place_new(location: Location, item: CollectionItem, place: dict) -> BinderSlot:
    """Put an unplaced copy of `item` in a slot; a taken slot is shared, the new card on top."""
    _check_place(location, place)
    row = _unplaced_row(location, item.pk)
    return BinderSlot.objects.create(location=location, item=row, position=_top(location, **place) + 1, **place)


@transaction.atomic
def move(location: Location, *, slot_id: int | None = None, item_id: int | None = None, to: dict | None = None,
         mode: str = 'swap'):
    """Drag and drop and Move to slot (AC-15, AC-17, AC-18). `to=None` unplaces."""
    Location.objects.select_for_update().filter(pk=location.pk).first()  # one move at a time per binder
    source = None
    if slot_id is not None:
        source = location.binder_slots.filter(pk=slot_id).first()
        if source is None:
            raise ValidationError({'slot': ['Unknown slot.']})
    if to is None:
        if source is None:
            raise ValidationError({'to': ['Choose a slot.']})
        source.delete()
        return
    _check_place(location, to)
    here = location.binder_slots.filter(page=to['page'], row=to['row'], col=to['col'])
    if source is not None:
        here = here.exclude(pk=source.pk)
        if (source.page, source.row, source.col) == (to['page'], to['row'], to['col']):
            return
    row = None if source is not None else _unplaced_row(location, item_id)

    if here.exists() and mode == 'share':
        position = _top(location, **to) + 1
    elif here.exists():  # swap
        if source is not None:
            here.update(page=source.page, row=source.row, col=source.col)
        else:
            here.delete()  # a tray card swaps the pocket's cards back to Unplaced
        position = 0
    else:
        position = 0

    if source is not None:
        source.page, source.row, source.col, source.position = to['page'], to['row'], to['col'], position
        source.save(update_fields=['page', 'row', 'col', 'position'])
    else:
        BinderSlot.objects.create(location=location, item=row, position=position, **to)


@transaction.atomic
def order(location: Location, place: dict, slot_ids: list[int]):
    """Order inside a shared pocket, top first (AC-19)."""
    slots = {s.id: s for s in location.binder_slots.filter(page=place['page'], row=place['row'], col=place['col'])}
    if set(slot_ids) != set(slots) or len(slot_ids) != len(slots):
        raise ValidationError({'slots': ['List every card in this slot once.']})
    for index, slot_id in enumerate(slot_ids):
        slots[slot_id].position = len(slot_ids) - 1 - index
    BinderSlot.objects.bulk_update(slots.values(), ['position'])


@transaction.atomic
def update_settings(location: Location, data: dict) -> int:
    """Grid, spreads, page count and sections (AC-6 to AC-10). Slots that no longer fit
    become unplaced; returns how many."""
    for field in ('rows', 'cols', 'spread', 'pages'):
        if field in data:
            setattr(location, f'binder_{field}', data[field])
    location.save(update_fields=['binder_rows', 'binder_cols', 'binder_spread', 'binder_pages'])
    outside = [s.id for s in location.binder_slots.all() if not in_range(location, s.page, s.row, s.col)]
    BinderSlot.objects.filter(id__in=outside).delete()
    if 'sections' in data:
        location.binder_sections.all().delete()
        BinderSection.objects.bulk_create(BinderSection(location=location, **s) for s in data['sections'])
    return len(outside)


def check_sections(sections: list[dict]):
    ranges = sorted((s['first_page'], s['last_page']) for s in sections)
    for (a_first, a_last), (b_first, _) in zip(ranges, ranges[1:]):
        if b_first <= a_last:
            raise ValidationError({'sections': ['Sections may not share pages.']})


# ---------- scan in order ----------

def _index(location: Location, row: int, col: int, direction: str) -> int:
    if direction == 'columns':
        return (col - 1) * location.binder_rows + (row - 1)
    return (row - 1) * location.binder_cols + (col - 1)


def _place_at(location: Location, index: int, direction: str) -> tuple[int, int]:
    if direction == 'columns':
        return index % location.binder_rows + 1, index // location.binder_rows + 1
    return index // location.binder_cols + 1, index % location.binder_cols + 1


def next_free(location: Location, cursor: dict) -> dict | None:
    """The first free slot from the cursor on, along rows or down columns, page by page (AC-20).
    None when a fixed page count has no free slot left (AC-23)."""
    taken = _taken(location)
    direction = cursor.get('direction', 'rows')
    per_page = location.binder_rows * location.binder_cols
    page = max(1, cursor['page'])
    start = _index(location, cursor['row'], cursor['col'], direction) if in_range(location, 1, cursor['row'], cursor['col']) else 0
    last = location.binder_pages or (max((p for p, _, _ in taken), default=0) + 1)
    while page <= max(last, cursor['page']):
        for index in range(start, per_page):
            row, col = _place_at(location, index, direction)
            if (page, row, col) not in taken:
                if location.binder_pages and page > location.binder_pages:
                    return None
                return {'page': page, 'row': row, 'col': col}
        page, start = page + 1, 0
    if location.binder_pages:
        return None
    return {'page': page, 'row': 1, 'col': 1}
