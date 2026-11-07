"""Writes for decks (spec 004). Copies move through collection.services, so
merging rules stay the same everywhere."""

from collections import Counter

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from collection.models import CollectionItem, Location
from collection.services import MAX_QUANTITY, Copies, edit_item, save_item

from .legality import FORMATS
from .models import Deck, DeckCard


def check_zone(deck: Deck, zone: str):
    rules = FORMATS[deck.format]
    if zone == DeckCard.Zone.COMMANDER and not rules.commander:
        raise ValidationError({'zone': [f'{deck.get_format_display()} decks have no commander zone.']})
    if zone == DeckCard.Zone.SIDE and rules.commander:
        raise ValidationError({'zone': [f'{deck.get_format_display()} decks have no sideboard.']})


@transaction.atomic
def add_card(deck: Deck, printing, quantity: int = 1, zone: str = DeckCard.Zone.MAIN) -> DeckCard:
    """Add copies of a card; the same card in the same zone raises its quantity (AC-10)."""
    check_zone(deck, zone)
    card, created = DeckCard.objects.select_for_update().get_or_create(
        deck=deck, oracle_id=printing.oracle_id, zone=zone,
        defaults={'printing': printing, 'quantity': min(quantity, MAX_QUANTITY)},
    )
    if not created:
        card.quantity = min(card.quantity + quantity, MAX_QUANTITY)
        card.save(update_fields=['quantity'])
    return card


def unique_location_name(user, name: str) -> str:
    taken = {n.lower() for n in Location.objects.filter(user=user).values_list('name', flat=True)}
    candidate, n = name, 1
    while candidate.lower() in taken:
        candidate = f'{name} deck' if n == 1 else f'{name} deck {n}'
        n += 1
    return candidate


def sync_location(location: Location, deck_format: str | None = None):
    """A Deck box location is a deck's box (spec 004 AC-4): create its deck, or unlink when it
    stops being one. The box sets its deck's format and shares its visibility (spec 005, AC-18, AC-19)."""
    deck = Deck.objects.filter(location=location).first()
    if location.kind == Location.Kind.DECK_BOX and deck is None:
        Deck.objects.create(user=location.user, name=location.name, format=deck_format or Deck.Format.COMMANDER,
                            is_public=location.is_public, location=location)
        fill_from_box(location.pk)
    elif location.kind == Location.Kind.DECK_BOX:
        changed = []
        if deck.is_public != location.is_public:
            deck.is_public = location.is_public
            changed.append('is_public')
        if changed:
            deck.save(update_fields=changed)
        if deck_format and deck_format != deck.format:
            set_format(deck, deck_format)
    elif location.kind != Location.Kind.DECK_BOX and deck is not None:
        deck.location = None
        deck.save(update_fields=['location'])


def share_visibility(deck: Deck):
    """A deck's box is public exactly when the deck is (spec 005, AC-19)."""
    box = deck.location
    if box is not None and box.is_public != deck.is_public:
        box.is_public = deck.is_public
        box.save(update_fields=['is_public'])


def fit_zone(deck: Deck, zone: str) -> str:
    """A zone this format lacks lands in the closest one (spec 004)."""
    rules = FORMATS[deck.format]
    if zone == DeckCard.Zone.COMMANDER and not rules.commander:
        return DeckCard.Zone.MAIN
    if zone == DeckCard.Zone.SIDE and rules.commander:
        return DeckCard.Zone.MAYBE
    return zone


@transaction.atomic
def set_format(deck: Deck, deck_format: str):
    """Change the format; cards in zones the new format lacks move to the Mainboard."""
    deck.format = deck_format
    deck.save(update_fields=['format'])
    for card in list(deck.cards.all()):
        zone = fit_zone(deck, card.zone)
        if zone != card.zone:
            move_zone(card, zone)


MAX_CATEGORIES = 10
# Suggested to everyone next to the names used in their decks (spec 006, AC-13).
COMMON_CATEGORIES = ['Ramp', 'Draw', 'Removal', 'Board wipe', 'Lands', 'Win condition']


def merge_categories(*lists) -> list[str]:
    """Trimmed names in order, case-insensitive duplicates dropped, at most MAX_CATEGORIES."""
    out, seen = [], set()
    for names in lists:
        for name in names:
            name = ' '.join(name.split())
            if name and name.lower() not in seen:
                seen.add(name.lower())
                out.append(name)
    return out[:MAX_CATEGORIES]


def category_suggestions(user) -> list[str]:
    """Names from the user's decks, most used first, then the common set."""
    used = Counter()
    for names in DeckCard.objects.filter(deck__user=user).exclude(categories=[]).values_list('categories', flat=True):
        used.update(names)
    out, seen = [], set()
    for name in [n for n, _ in used.most_common()] + COMMON_CATEGORIES:
        if name.lower() not in seen:
            seen.add(name.lower())
            out.append(name)
    return out


@transaction.atomic
def move_zone(card: DeckCard, zone: str) -> DeckCard:
    """Move a card to another zone, merging with that card's entry there. Keeps swap links
    pointing at the card; a card leaving the Maybeboard stops being a candidate (spec 005, AC-12)."""
    if zone == card.zone:
        return card
    check_zone(card.deck, zone)
    target = DeckCard.objects.select_for_update().filter(deck=card.deck, oracle_id=card.oracle_id, zone=zone).first()
    if target is None:
        card.zone = zone
        if zone != DeckCard.Zone.MAYBE:
            card.swap_for = None
        card.save(update_fields=['zone', 'swap_for'])
        if zone == DeckCard.Zone.MAYBE:
            card.candidates.update(swap_for=None)  # a Maybeboard card replaces nothing
        return card
    target.quantity = min(target.quantity + card.quantity, MAX_QUANTITY)
    target.categories = merge_categories(target.categories, card.categories)
    target.save(update_fields=['quantity', 'categories'])
    if zone != DeckCard.Zone.MAYBE:
        card.candidates.update(swap_for=target)
    card.delete()
    return target


@transaction.atomic
def propose_swap(card: DeckCard, printing) -> DeckCard:
    """Put a card in the Maybeboard as a candidate to replace `card` (spec 005, AC-9)."""
    if card.zone == DeckCard.Zone.MAYBE:
        raise ValidationError({'detail': 'Maybeboard cards cannot be swapped out.'})
    if printing.oracle_id == card.oracle_id:
        raise ValidationError({'printing': ['Pick a different card.']})
    candidate = DeckCard.objects.filter(deck=card.deck, oracle_id=printing.oracle_id, zone=DeckCard.Zone.MAYBE).first()
    if candidate is None:
        candidate = DeckCard.objects.create(deck=card.deck, printing=printing, oracle_id=printing.oracle_id,
                                            zone=DeckCard.Zone.MAYBE, quantity=1)
    candidate.swap_for = card
    candidate.save(update_fields=['swap_for'])
    return candidate


@transaction.atomic
def apply_swap(candidate: DeckCard) -> DeckCard:
    """The candidate takes the old card's zone and quantity; the old card becomes a
    Maybeboard candidate for it, so the swap can be undone (spec 005, AC-11)."""
    old = candidate.swap_for
    if candidate.zone != DeckCard.Zone.MAYBE or old is None:
        raise ValidationError({'detail': 'This card is not a swap candidate.'})
    zone, quantity = old.zone, old.quantity
    others = list(old.candidates.exclude(pk=candidate.pk).values_list('pk', flat=True))
    # Old card out first, so the zone it leaves is free for the candidate.
    old_card = move_zone(old, DeckCard.Zone.MAYBE)
    candidate.quantity = quantity
    candidate.save(update_fields=['quantity'])
    new_card = move_zone(candidate, zone)
    old_card.swap_for = new_card
    old_card.save(update_fields=['swap_for'])
    # The other candidates were alternatives for that slot: they now point at the new card.
    DeckCard.objects.filter(pk__in=others).update(swap_for=new_card)
    return new_card


COUNTED_ZONES = (DeckCard.Zone.COMMANDER, DeckCard.Zone.MAIN, DeckCard.Zone.SIDE)


@transaction.atomic
def fill_from_box(location_id: int, oracle_id=None):
    """AC-29: copies in a deck box that its list doesn't cover join the Mainboard.

    Only adds; taking cards out of a box never changes the list. `oracle_id`
    limits the check to one card (the row that just changed).
    """
    deck = Deck.objects.filter(location_id=location_id).first()
    if deck is None:
        return
    rows = CollectionItem.objects.filter(location_id=location_id, in_cart=False)
    if oracle_id is not None:
        rows = rows.filter(printing__oracle_id=oracle_id)
    in_box = {r['printing__oracle_id']: r['n'] for r in rows.values('printing__oracle_id').annotate(n=Sum('quantity'))}
    if not in_box:
        return
    listed = {
        r['oracle_id']: r['n']
        for r in deck.cards.filter(oracle_id__in=in_box, zone__in=COUNTED_ZONES).values('oracle_id').annotate(n=Sum('quantity'))
    }
    for oracle, count in in_box.items():
        short = count - listed.get(oracle, 0)
        if short > 0:
            # A new entry shows the newest printing among the box's copies.
            row = rows.filter(printing__oracle_id=oracle).select_related('printing').order_by('-printing__released_at').first()
            add_card(deck, row.printing, short, DeckCard.Zone.MAIN)


def move_copies(row: CollectionItem, quantity: int, location) -> CollectionItem:
    """Move `quantity` copies of a row to `location`, merging there; the rest stays."""
    if quantity >= row.quantity:
        return edit_item(row, location=location)[0]
    row.quantity -= quantity
    row.save(update_fields=['quantity'])
    moved, merged = save_item(
        row.user, printing=row.printing, finish=row.finish, condition=row.condition, language=row.language,
        location=location, copies=Copies(quantity, row.purchase_price, row.purchase_currency,
                                         added_at=row.added_at,
                                         added={f: getattr(row, f) for f in ('added_usd', 'added_eur', 'added_pln')}),
    )
    if not merged:  # a new row keeps the original's date and price-when-added
        moved.added_at = row.added_at
        moved.added_usd, moved.added_eur, moved.added_pln = row.added_usd, row.added_eur, row.added_pln
        moved.save(update_fields=['added_at', 'added_usd', 'added_eur', 'added_pln'])
    return moved


def free_row(deck: Deck, item_id: int) -> CollectionItem:
    """An owned copy the deck may take: not in the cart, not in any deck's box."""
    row = CollectionItem.objects.select_related('printing', 'location').filter(
        pk=item_id, user=deck.user, in_cart=False,
    ).first()
    if row is None or (row.location_id and Deck.objects.filter(location_id=row.location_id).exists()):
        raise ValidationError({'item_id': ['That copy is not free.']})
    return row


@transaction.atomic
def create_box(deck: Deck, moves: list[dict]) -> Location:
    """Give a deck its box and move the chosen free copies into it (AC-5)."""
    if deck.location_id:
        raise ValidationError({'detail': 'This deck already has a deck box.'})
    box = Location.objects.create(user=deck.user, name=unique_location_name(deck.user, deck.name),
                                  kind=Location.Kind.DECK_BOX, is_public=deck.is_public)
    deck.location = box
    deck.save(update_fields=['location'])
    for move in moves:
        row = free_row(deck, move['item_id'])
        move_copies(row, min(move['quantity'], row.quantity), box)
    return box


@transaction.atomic
def delete_deck(deck: Deck, box_action: str | None):
    """AC-6: keep the box as a Box, move its cards to Unfiled, or delete them too."""
    box = deck.location
    from wants.services import unlink_deck  # its want list entries stay (spec 010, AC-17)
    unlink_deck(deck)
    if box is not None:
        if box_action not in ('keep', 'unfile', 'delete'):
            raise ValidationError({'box': ['Choose what happens to the deck box.']})
        deck.location = None
        deck.save(update_fields=['location'])
        if box_action == 'keep':
            box.kind = Location.Kind.BOX
            box.save(update_fields=['kind'])
        else:
            for row in list(box.items.all()):
                if box_action == 'delete':
                    row.delete()
                else:
                    edit_item(row, location=None)
            box.delete()
    deck.delete()
