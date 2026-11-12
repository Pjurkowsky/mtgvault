"""Branches, versions, compare and fork (spec 027).

A version freezes a branch's list as JSON; restoring it or branching from it builds
DeckCard rows again. Lists are compared by card (oracle id) and zone.
"""

from django.db import transaction
from django.db.models import Max
from rest_framework.exceptions import ValidationError

from cards.models import Printing

from .models import Deck, DeckBranch, DeckCard, DeckVersion


def snapshot(branch: DeckBranch) -> list[dict]:
    """The branch's list as plain data; swap pairs point at positions in the list."""
    cards = list(branch.cards.prefetch_related('swaps_for').order_by('zone', 'id'))
    index = {c.id: i for i, c in enumerate(cards)}
    return [{
        'oracle_id': str(c.oracle_id), 'printing': str(c.printing_id), 'zone': c.zone, 'quantity': c.quantity,
        'categories': c.categories, 'swaps_for': sorted(index[o.id] for o in c.swaps_for.all() if o.id in index),
    } for c in cards]


def write_list(branch: DeckBranch, cards: list[dict]):
    """Make the branch's list exactly `cards` (a snapshot)."""
    branch.cards.all().delete()
    rows = DeckCard.objects.bulk_create([DeckCard(
        deck_id=branch.deck_id, branch=branch, printing_id=c['printing'], oracle_id=c['oracle_id'], zone=c['zone'],
        quantity=c['quantity'], categories=c.get('categories') or [],
    ) for c in cards])
    for row, c in zip(rows, cards):
        if c.get('swaps_for'):
            row.swaps_for.add(*[rows[i] for i in c['swaps_for'] if i < len(rows)])


def check_name(deck: Deck, name: str, exclude: int | None = None) -> str:
    name = ' '.join((name or '').split())
    if not name:
        raise ValidationError({'name': ['Give the branch a name.']})
    if len(name) > 40:
        raise ValidationError({'name': ['At most 40 characters.']})
    taken = deck.branches.filter(name__iexact=name)
    if exclude:
        taken = taken.exclude(pk=exclude)
    if taken.exists():
        raise ValidationError({'name': ['This deck already has a branch with that name.']})
    return name


@transaction.atomic
def new_branch(deck: Deck, name: str, from_branch: DeckBranch | None = None, version: DeckVersion | None = None) -> DeckBranch:
    """AC-3, AC-9: a branch with the list of a branch (as it is now) or of a version."""
    name = check_name(deck, name)
    source = version.branch if version else from_branch
    branch = DeckBranch.objects.create(deck=deck, name=name, from_branch=source, from_version=version)
    write_list(branch, version.cards if version else snapshot(from_branch))
    return branch


@transaction.atomic
def make_main(branch: DeckBranch):
    """AC-4: this branch becomes Main; the old Main an ordinary branch."""
    if branch.is_main:
        return
    DeckBranch.objects.filter(deck_id=branch.deck_id, is_main=True).update(is_main=False)
    branch.is_main = True
    branch.save(update_fields=['is_main'])


def delete_branch(branch: DeckBranch):
    if branch.is_main:
        raise ValidationError({'detail': 'Main can\'t be deleted. Make another branch Main first.'})
    branch.delete()  # its versions and cards go with it


@transaction.atomic
def save_version(branch: DeckBranch, name: str = '', note: str = '') -> DeckVersion:
    """AC-7: freeze the branch's list, numbered v1, v2… per branch."""
    DeckBranch.objects.select_for_update().get(pk=branch.pk)
    number = (branch.versions.aggregate(n=Max('number'))['n'] or 0) + 1
    return DeckVersion.objects.create(branch=branch, number=number, name=' '.join(name.split())[:60], note=note.strip()[:1000],
                                      cards=snapshot(branch))


@transaction.atomic
def restore(version: DeckVersion) -> DeckVersion:
    """AC-10: save the branch's list first, then give it the version's list."""
    before = save_version(version.branch, f'Before restoring v{version.number}')
    write_list(version.branch, version.cards)
    return before


def label(branch: DeckBranch, version: DeckVersion | None = None) -> str:
    return f'{branch.name} v{version.number}' if version else branch.name


# Read-only lists ---------------------------------------------------------------

def version_cards(deck: Deck, version: DeckVersion) -> list[DeckCard]:
    """A version's cards as unsaved DeckCards (negative ids), for the read-only deck page (AC-8)."""
    printings = {str(k): p for k, p in Printing.objects.select_related('set').in_bulk([c['printing'] for c in version.cards]).items()}
    cards = []
    for i, c in enumerate(version.cards):
        printing = printings.get(c['printing']) or Printing.objects.select_related('set').filter(oracle_id=c['oracle_id']).first()
        if printing is None:
            continue
        card = DeckCard(id=-(i + 1), deck=deck, branch=version.branch, printing=printing, oracle_id=printing.oracle_id,
                        zone=c['zone'], quantity=c['quantity'], categories=c.get('categories') or [])
        card.swap_ids = [-(j + 1) for j in c.get('swaps_for', [])]
        cards.append(card)
    return sorted(cards, key=lambda c: c.printing.name)


def list_rows(side) -> dict:
    """{(oracle id, zone): {quantity, printing, name}} for a branch (now) or a version."""
    rows: dict = {}
    if isinstance(side, DeckVersion):
        printings = {str(k): p for k, p in Printing.objects.in_bulk([c['printing'] for c in side.cards]).items()}
        for c in side.cards:
            p = printings.get(c['printing'])
            if p is not None:
                rows[(c['oracle_id'], c['zone'])] = {'quantity': c['quantity'], 'printing': p}
    else:
        for c in side.cards.select_related('printing'):
            rows[(str(c.oracle_id), c.zone)] = {'quantity': c.quantity, 'printing': c.printing}
    return rows


def compare(a, b) -> dict:
    """AC-13: from list `a` to list `b`: added, removed, quantity changed, moved to another zone."""
    old, new = list_rows(a), list_rows(b)
    added, removed, changed, moved = [], [], [], []
    old_zones: dict = {}
    new_zones: dict = {}
    for (oracle, zone), r in old.items():
        old_zones.setdefault(oracle, {})[zone] = r
    for (oracle, zone), r in new.items():
        new_zones.setdefault(oracle, {})[zone] = r
    for oracle in sorted(set(old_zones) | set(new_zones), key=lambda o: next(iter((new_zones.get(o) or old_zones[o]).values()))['printing'].name):
        before, after = old_zones.get(oracle, {}), new_zones.get(oracle, {})
        gone = {z: r for z, r in before.items() if z not in after}
        came = {z: r for z, r in after.items() if z not in before}
        # A card that left one zone and arrived in another moved (the smaller count moves, the rest is added or removed).
        for z_from, r_from in list(gone.items()):
            for z_to, r_to in list(came.items()):
                n = min(r_from['quantity'], r_to['quantity'])
                moved.append({'printing': r_to['printing'], 'quantity': n, 'zone': z_to, 'from_zone': z_from})
                r_from = {**r_from, 'quantity': r_from['quantity'] - n}
                r_to = {**r_to, 'quantity': r_to['quantity'] - n}
                gone[z_from], came[z_to] = r_from, r_to
                if r_to['quantity'] == 0:
                    del came[z_to]
                if r_from['quantity'] == 0:
                    del gone[z_from]
                    break
        for z, r in gone.items():
            removed.append({'printing': r['printing'], 'quantity': r['quantity'], 'zone': z, 'from_zone': None})
        for z, r in came.items():
            added.append({'printing': r['printing'], 'quantity': r['quantity'], 'zone': z, 'from_zone': None})
        for z in before.keys() & after.keys():
            if before[z]['quantity'] != after[z]['quantity']:
                changed.append({'printing': after[z]['printing'], 'quantity': after[z]['quantity'], 'zone': z,
                                'from_zone': None, 'from_quantity': before[z]['quantity']})
    total_added = sum(c['quantity'] for c in added) + sum(max(0, c['quantity'] - c['from_quantity']) for c in changed)
    total_removed = sum(c['quantity'] for c in removed) + sum(max(0, c['from_quantity'] - c['quantity']) for c in changed)
    return {'added': added, 'removed': removed, 'changed': changed, 'moved': moved,
            'total_added': total_added, 'total_removed': total_removed}


# Fork -------------------------------------------------------------------------

def unique_deck_name(user, name: str) -> str:
    taken = {n.lower() for n in Deck.objects.filter(user=user).values_list('name', flat=True)}
    candidate, n = name, 2
    while candidate.lower() in taken:
        candidate = f'{name} ({n})'
        n += 1
    return candidate[:100]


@transaction.atomic
def fork(source: Deck, user, branch: DeckBranch | None = None, version: DeckVersion | None = None) -> Deck:
    """AC-15: a private copy with every branch and version. Forked from a branch or version,
    that list becomes Main; the source's Main stays as a branch under its own name."""
    deck = Deck(user=user, name=unique_deck_name(user, source.name), format=source.format, is_public=False, forked_from=source)
    deck._no_main = True
    deck.save()
    copies: dict[int, DeckBranch] = {}
    version_copies: dict[int, DeckVersion] = {}
    new_main = None
    for old in source.branches.order_by('-is_main', 'created_at'):
        copy = DeckBranch.objects.create(deck=deck, name=old.name, is_main=False)
        write_list(copy, snapshot(old))
        copies[old.id] = copy
        for v in old.versions.order_by('number'):
            version_copies[v.id] = DeckVersion.objects.create(branch=copy, number=v.number, name=v.name, note=v.note, cards=v.cards)
    for old in source.branches.all():
        copy = copies[old.id]
        copy.from_branch = copies.get(old.from_branch_id)
        copy.from_version = version_copies.get(old.from_version_id)
        copy.save(update_fields=['from_branch', 'from_version'])
    if version is not None:
        name = check_name(deck, f'{version.branch.name} v{version.number}')
        new_main = DeckBranch.objects.create(deck=deck, name=name, from_branch=copies[version.branch_id],
                                             from_version=version_copies[version.id])
        write_list(new_main, version.cards)
    else:
        new_main = copies[(branch or source.branch).id]
    new_main.is_main = True
    new_main.save(update_fields=['is_main'])
    deck.branch = new_main
    return deck
