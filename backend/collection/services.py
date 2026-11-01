"""Every write to collection rows goes through here, so the merge rule (AC-19,
AC-20) lives in one place: add, edit, move, bulk actions and import."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from cards.pricing import CENT, convert, latest_rates, price

from .models import CollectionItem

MAX_QUANTITY = 999
ROW_KEY = ('printing', 'finish', 'condition', 'language', 'location')


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


@transaction.atomic
def save_item(user, *, printing, finish, condition, language, location, copies: Copies, rates=None):
    """Add copies. Returns (row, merged)."""
    check_finish(printing, finish)
    if not 1 <= copies.quantity <= MAX_QUANTITY:
        raise ValidationError({'quantity': [f'Use 1 to {MAX_QUANTITY}.']})
    rates = rates or latest_rates()
    key = dict(printing=printing, finish=finish, condition=condition, language=language, location=location)

    existing = _find_row(user, key)
    if existing:
        return _merge_into(existing, copies, rates), True
    try:
        with transaction.atomic():
            row = CollectionItem.objects.create(
                user=user, **key, quantity=copies.quantity,
                purchase_price=copies.purchase_price,
                purchase_currency=copies.purchase_currency if copies.purchase_price is not None else None,
                **snapshot(printing, finish, rates),
            )
        return row, False
    except IntegrityError:
        # Another request created the same row a moment ago: merge into it.
        return _merge_into(_find_row(user, key), copies, rates), True


@transaction.atomic
def edit_item(row: CollectionItem, rates=None, **changes):
    """Change fields of a row. If it now matches another row, the two merge and
    this one is deleted. Returns (resulting row, merged)."""
    rates = rates or latest_rates()
    row = CollectionItem.objects.select_for_update().get(pk=row.pk)

    if 'printing' in changes and changes['printing'].oracle_id != row.printing.oracle_id:
        raise ValidationError({'printing': ['Pick a printing of the same card.']})
    for field, value in changes.items():
        setattr(row, field, value)
    check_finish(row.printing, row.finish)
    if not 1 <= row.quantity <= MAX_QUANTITY:
        raise ValidationError({'quantity': [f'Use 1 to {MAX_QUANTITY}.']})
    if row.purchase_price is None:
        row.purchase_currency = None

    key = {field: getattr(row, field) for field in ROW_KEY}
    other = _find_row(row.user, key, exclude_id=row.pk)
    if other is None:
        row.save()
        return row, False

    copies = Copies(
        quantity=row.quantity,
        purchase_price=row.purchase_price,
        purchase_currency=row.purchase_currency,
        added_at=row.added_at,
        added={f: getattr(row, f) for f in ('added_usd', 'added_eur', 'added_pln')},
    )
    row.delete()
    return _merge_into(other, copies, rates), True


def move_item(row: CollectionItem, location, rates=None):
    return edit_item(row, rates=rates, location=location)
