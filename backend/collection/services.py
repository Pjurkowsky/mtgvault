"""Every write to collection rows goes through here, so the merge rule (AC-19,
AC-20) lives in one place: add, edit, move, bulk actions and import."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from cards.pricing import CENT, convert, latest_rates, price

from .models import CollectionItem

MAX_QUANTITY = 999
ROW_KEY = ('printing', 'finish', 'condition', 'language', 'location', 'in_cart')


@dataclass
class Copies:
    """Copies being added to (or merged into) a row."""

    quantity: int
    purchase_price: Decimal | None = None
    purchase_currency: str | None = None
    added_at: object = None  # datetime of the source row, when merging rows
    added: dict | None = None  # its added_usd/eur/pln snapshot


def check_finish(printing, finish):
    if finish not in printing.finishes:
        raise ValidationError({'finish': [f'This printing has no {finish} version.']})


def snapshot(printing, finish, rates) -> dict:
    """Market price per copy right now, in every currency (AC-14)."""
    return {
        f'added_{currency.lower()}': price(printing, finish, currency, rates)
        for currency in ('USD', 'EUR', 'PLN')
    }


def average_purchase(row: CollectionItem, copies: Copies, rates) -> tuple[Decimal | None, str | None]:
    """Quantity-weighted average per copy. Rows without a price don't count (AC-20).
    The existing row's currency wins; the other side is converted into it."""
    parts = []
    if row.purchase_price is not None:
        parts.append((row.purchase_price, row.purchase_currency, row.quantity))
    if copies.purchase_price is not None:
        parts.append((copies.purchase_price, copies.purchase_currency, copies.quantity))
    if not parts:
        return None, None

    currency = parts[0][1]
    total = Decimal(0)
    count = 0
    for amount, source, quantity in parts:
        converted = convert(amount, source, currency, rates)
        if converted is None:  # no rate for this currency: leave it out
            continue
        total += converted * quantity
        count += quantity
    if count == 0:
        return row.purchase_price, row.purchase_currency
    return (total / count).quantize(CENT, ROUND_HALF_UP), currency


def _merge_into(row: CollectionItem, copies: Copies, rates) -> CollectionItem:
    quantity = row.quantity + copies.quantity
    if quantity > MAX_QUANTITY:
        raise ValidationError({'quantity': [f'A row can hold at most {MAX_QUANTITY} copies.']})
    row.purchase_price, row.purchase_currency = average_purchase(row, copies, rates)
    # The older row's date and price-when-added stay (AC-19).
    if copies.added_at and copies.added_at < row.added_at:
        row.added_at = copies.added_at
        for field, value in (copies.added or {}).items():
            setattr(row, field, value)
    row.quantity = quantity
    row.save()
    return row


def _find_row(user, key: dict, exclude_id=None):
    rows = CollectionItem.objects.select_for_update().filter(user=user, **key)
    if exclude_id:
        rows = rows.exclude(id=exclude_id)
    return rows.first()


def _fill_deck(row: CollectionItem):
    """Cards that land in a deck box join its decklist (spec 004, AC-29)."""
    if row.location_id and not row.in_cart:
        from decks.services import fill_from_box  # decks builds on collection
        fill_from_box(row.location_id, row.printing.oracle_id)


@transaction.atomic
def save_item(user, *, printing, finish, condition, language, location, copies: Copies, rates=None, in_cart=False):
    """Add copies (to the cart with in_cart=True). Returns (row, merged)."""
    check_finish(printing, finish)
    if not 1 <= copies.quantity <= MAX_QUANTITY:
        raise ValidationError({'quantity': [f'Use 1 to {MAX_QUANTITY}.']})
    rates = rates or latest_rates()
    key = dict(printing=printing, finish=finish, condition=condition, language=language,
               location=None if in_cart else location, in_cart=in_cart)

    existing = _find_row(user, key)
    if existing:
        row, merged = _merge_into(existing, copies, rates), True
    else:
        try:
            with transaction.atomic():
                row = CollectionItem.objects.create(
                    user=user, **key, quantity=copies.quantity,
                    purchase_price=copies.purchase_price,
                    purchase_currency=copies.purchase_currency if copies.purchase_price is not None else None,
                    **snapshot(printing, finish, rates),
                )
            merged = False
        except IntegrityError:
            # Another request created the same row a moment ago: merge into it.
            row, merged = _merge_into(_find_row(user, key), copies, rates), True
    _fill_deck(row)
    return row, merged


@transaction.atomic
def edit_item(row: CollectionItem, rates=None, **changes):
    """Change fields of a row. If it now matches another row, the two merge and
    this one is deleted. Returns (resulting row, merged)."""
    rates = rates or latest_rates()
    row = CollectionItem.objects.select_for_update().get(pk=row.pk)
    was_in_cart = row.in_cart

    # Giving a cart row a location (or Unfiled) moves it into the collection (spec 003, AC-21).
    if 'location' in changes:
        changes['in_cart'] = False
    if 'printing' in changes and changes['printing'].oracle_id != row.printing.oracle_id:
        raise ValidationError({'printing': ['Pick a printing of the same card.']})
    for field, value in changes.items():
        setattr(row, field, value)
    check_finish(row.printing, row.finish)
    if not 1 <= row.quantity <= MAX_QUANTITY:
        raise ValidationError({'quantity': [f'Use 1 to {MAX_QUANTITY}.']})
    if row.purchase_price is None:
        row.purchase_currency = None

    if was_in_cart and not row.in_cart:
        # Bought: copies leaving the cart lower the want list (spec 010, AC-13).
        from wants.services import fulfil
        fulfil(row.user, row.printing, row.finish, row.quantity, row.location)

    key = {field: getattr(row, field) for field in ROW_KEY}
    other = _find_row(row.user, key, exclude_id=row.pk)
    if other is None:
        row.save()
        _fill_deck(row)
        return row, False

    copies = Copies(
        quantity=row.quantity,
        purchase_price=row.purchase_price,
        purchase_currency=row.purchase_currency,
        added_at=row.added_at,
        added={f: getattr(row, f) for f in ('added_usd', 'added_eur', 'added_pln')},
    )
    from .binder import move_slots
    move_slots(row, other)  # the merged row keeps both rows' binder slots (spec 007)
    row.delete()
    merged_row = _merge_into(other, copies, rates)
    _fill_deck(merged_row)
    return merged_row, True


def edit_copies(row: CollectionItem, copies: int, slot_id: int | None = None, rates=None, **changes):
    """Change only `copies` of a row's copies (spec 018). They split off as their own row
    with the changes (or merge into a matching row); the rest keep theirs. A binder pocket
    (`slot_id`) goes with them; otherwise pockets the remaining copies don't need do.
    Returns (resulting row, merged)."""
    rates = rates or latest_rates()
    row = CollectionItem.objects.select_for_update().get(pk=row.pk)
    if copies >= row.quantity:
        return edit_item(row, rates=rates, **changes)
    changes.pop('quantity', None)

    from .models import BinderSlot
    if slot_id is not None:
        slots = list(BinderSlot.objects.filter(item_id=row.pk, pk=slot_id))
        if not slots:
            raise ValidationError({'slot_id': ['That pocket holds another card.']})
    else:
        placed = list(BinderSlot.objects.filter(item_id=row.pk).order_by('-created_at', '-id'))
        slots = placed[:max(0, len(placed) - (row.quantity - copies))]

    part = CollectionItem(**{f.attname: getattr(row, f.attname) for f in CollectionItem._meta.concrete_fields if f.attname != 'id'})
    part.quantity = copies
    if 'location' in changes:
        changes['in_cart'] = False
    if 'printing' in changes and changes['printing'].oracle_id != row.printing.oracle_id:
        raise ValidationError({'printing': ['Pick a printing of the same card.']})
    for field, value in changes.items():
        setattr(part, field, value)
    check_finish(part.printing, part.finish)
    if part.purchase_price is None:
        part.purchase_currency = None
    key = {field: getattr(part, field) for field in ROW_KEY}
    if key == {field: getattr(row, field) for field in ROW_KEY}:
        raise ValidationError({'copies': ['Identical copies share one row: change the finish, condition, '
                                          'language, printing or location of some, or edit all of them.']})

    if row.in_cart and not part.in_cart:
        from wants.services import fulfil  # spec 010, AC-13
        fulfil(row.user, part.printing, part.finish, copies, part.location)
    other = _find_row(row.user, key)
    if other is None:
        part.save()
        target, merged = part, False
    else:
        target = _merge_into(other, Copies(copies, part.purchase_price, part.purchase_currency, part.added_at,
                                           {f: getattr(part, f) for f in ('added_usd', 'added_eur', 'added_pln')}), rates)
        merged = True
    # Pockets move before the row shrinks: saving it trims the slots it can no longer fill.
    BinderSlot.objects.filter(pk__in=[s.pk for s in slots]).update(item_id=target.pk)
    row.quantity -= copies
    row.save()
    from .binder import sync_slots
    sync_slots(target)  # pockets in a place the copies left go (spec 007)
    _fill_deck(target)
    return target, merged


def delete_pocket_copy(row: CollectionItem, slot_id: int):
    """Delete from a binder pocket: only that copy goes (spec 018, AC-3)."""
    from .models import BinderSlot
    row = CollectionItem.objects.select_for_update().get(pk=row.pk)
    slot = BinderSlot.objects.filter(item_id=row.pk, pk=slot_id).first()
    if slot is None:
        raise ValidationError({'slot': ['That pocket holds another card.']})
    if row.quantity <= 1:
        row.delete()
        return
    slot.delete()
    row.quantity -= 1
    row.save()


def move_item(row: CollectionItem, location, rates=None):
    return edit_item(row, rates=rates, location=location)
