"""Every write to the want list goes through here, so merging (spec 010, AC-5)
and lowering (AC-13) live in one place."""

from django.db import transaction
from django.db.models import Case, IntegerField, Q, Sum, Value, When
from rest_framework.exceptions import ValidationError

from .models import ANY, WantItem

MAX_QUANTITY = 999


def _check(entry: WantItem):
    if not 1 <= entry.quantity <= MAX_QUANTITY:
        raise ValidationError({'quantity': [f'Use 1 to {MAX_QUANTITY}.']})
    if not entry.any_printing and entry.finish != ANY and entry.finish not in entry.printing.finishes:
        raise ValidationError({'finish': [f'This printing has no {entry.finish} version.']})


def _match(entry: WantItem):
    """Another entry for the same card, printing, finish and deck (AC-5)."""
    rows = WantItem.objects.select_for_update().filter(
        user_id=entry.user_id, oracle_id=entry.oracle_id, any_printing=entry.any_printing,
        finish=entry.finish, deck_id=entry.deck_id,
    )
    if not entry.any_printing:
        rows = rows.filter(printing_id=entry.printing_id)
    if entry.pk:
        rows = rows.exclude(pk=entry.pk)
    return rows.order_by('added_at', 'id').first()


def _merge(other: WantItem, quantity: int) -> WantItem:
    other.quantity = min(other.quantity + quantity, MAX_QUANTITY)
    other.save(update_fields=['quantity'])
    return other


@transaction.atomic
def add_want(user, *, printing, any_printing=True, finish=ANY, deck=None, quantity=1):
    """Put copies on the want list. Returns (entry, merged)."""
    entry = WantItem(user=user, oracle_id=printing.oracle_id, printing=printing, any_printing=any_printing,
                     finish=finish, deck=deck, quantity=quantity)
    _check(entry)
    other = _match(entry)
    if other:
        return _merge(other, quantity), True
    entry.save()
    return entry, False


@transaction.atomic
def edit_want(entry: WantItem, **changes):
    """Change an entry; if it now matches another, the two merge. Returns (entry, merged)."""
    entry = WantItem.objects.select_for_update().get(pk=entry.pk)
    if 'printing' in changes and changes['printing'].oracle_id != entry.oracle_id:
        raise ValidationError({'printing': ['Pick a printing of the same card.']})
    for field, value in changes.items():
        setattr(entry, field, value)
    _check(entry)
    other = _match(entry)
    if other is None:
        entry.save()
        return entry, False
    quantity = entry.quantity
    entry.delete()
    return _merge(other, quantity), True


@transaction.atomic
def fulfil(user, printing, finish, quantity, location=None):
    """New copies entered the collection: lower matching entries (AC-13).
    The deck whose box got them goes first, then entries without a deck, then other decks."""
    box_deck = getattr(location, 'deck', None) if location is not None else None
    rows = (
        WantItem.objects.select_for_update()
        .filter(user=user, oracle_id=printing.oracle_id)
        .filter(Q(any_printing=True) | Q(printing=printing))
        .filter(finish__in=[ANY, finish])
        .annotate(rank=Case(
            When(deck_id=box_deck.id if box_deck else -1, then=Value(0)),
            When(deck__isnull=True, then=Value(1)),
            default=Value(2), output_field=IntegerField(),
        ))
        .order_by('rank', 'added_at', 'id')
    )
    left = quantity
    for entry in rows:
        if left <= 0:
            break
        taken = min(entry.quantity, left)
        left -= taken
        if taken == entry.quantity:
            entry.delete()
        else:
            entry.quantity -= taken
            entry.save(update_fields=['quantity'])


def unlink_deck(deck):
    """A deck is being deleted: its entries stay, without a deck (AC-17)."""
    for entry in list(WantItem.objects.filter(deck=deck)):
        edit_want(entry, deck=None)


def wanted_counts(user_id, oracle_ids, deck=None) -> dict:
    """{oracle_id: quantity} on the want list; with `deck`, entries for it or without a deck."""
    rows = WantItem.objects.filter(user_id=user_id, oracle_id__in=oracle_ids)
    if deck is not None:
        rows = rows.filter(Q(deck=deck) | Q(deck__isnull=True))
    return {r['oracle_id']: r['n'] for r in rows.values('oracle_id').annotate(n=Sum('quantity'))}


@transaction.atomic
def want_missing(deck, card=None) -> int:
    """Want a deck's missing cards for the deck, up to the missing count (AC-15, AC-16).
    Returns how many copies were added."""
    from decks.legality import COUNTED
    from decks.ownership import deck_ownership

    cards = list(deck.cards.select_related('printing'))
    ownership = deck_ownership(deck, cards)
    targets = [card] if card is not None else [c for c in cards if c.zone in COUNTED]
    missing: dict = {}
    first: dict = {}
    for c in targets:
        missing[c.oracle_id] = max(missing.get(c.oracle_id, 0), ownership[c.id]['missing'])
        first.setdefault(c.oracle_id, c)
    wanted = {
        r['oracle_id']: r['n'] for r in WantItem.objects.filter(deck=deck, oracle_id__in=missing)
        .values('oracle_id').annotate(n=Sum('quantity'))
    }
    added = 0
    for oracle, count in missing.items():
        short = count - wanted.get(oracle, 0)
        if short > 0:
            add_want(deck.user, printing=first[oracle].printing, deck=deck, quantity=short)
            added += short
    return added
