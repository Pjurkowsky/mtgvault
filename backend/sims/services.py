"""Pods, the opponent pool, sim swaps and runs (spec 024)."""

import uuid
from collections import Counter

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, ValidationError

from cards.edhrec import edhrec_for
from cards.models import CardInsight, Printing
from decks import textlist
from decks.models import Deck, DeckBranch, DeckCard, DeckVersion
from decks.versions import version_cards

from . import forge
from .models import PoolDeck, SimRun, SimSeat, SimSwap

PROFILES = ('Default', 'Cautious', 'Reckless', 'Experimental')
MAX_SEATS = 6
SUGGESTIONS = 10


# Decks ---------------------------------------------------------------------

def visible_decks(user):
    """Decks a user can open: their own, and everyone's public ones (AC-1, AC-18)."""
    mine = Q(user=user) if user.is_authenticated else Q(pk__in=[])
    return Deck.objects.filter(mine | Q(is_public=True))


def visible_deck(user, pk) -> Deck:
    return get_object_or_404(visible_decks(user).select_related('user'), pk=pk)


def commander_decks(queryset):
    """Commander decks with a commander (AC-4)."""
    return queryset.filter(format=Deck.Format.COMMANDER, cards__zone=DeckCard.Zone.COMMANDER, cards__branch__is_main=True).distinct()


def deck_cards(deck: Deck, version: DeckVersion | None = None) -> list[dict]:
    """Commander and Mainboard cards as a pod list (AC-8: Sideboard and Maybeboard stay out).
    The deck's shown branch, or a saved version (spec 027, AC-16)."""
    zones = (DeckCard.Zone.COMMANDER, DeckCard.Zone.MAIN)
    rows = ([c for c in version_cards(deck, version) if c.zone in zones] if version is not None
            else deck.list_cards().filter(zone__in=zones).select_related('printing'))
    return merge([{'name': c.printing.name, 'quantity': c.quantity, 'commander': c.zone == DeckCard.Zone.COMMANDER}
                  for c in rows])


def deck_list(deck: Deck, spec: dict) -> tuple[list[dict], str]:
    """The seat's list and its label: "Deck", "Deck · Branch" or "Deck · Branch v1" (spec 027, AC-16)."""
    if spec.get('version'):
        version = DeckVersion.objects.select_related('branch').filter(pk=spec['version'], branch__deck=deck).first()
        if version is None:
            raise NotFound('That version is gone.')
        deck.branch = version.branch
        return deck_cards(deck, version), f'{deck.name} · {version.branch.name} v{version.number}'
    if spec.get('branch'):
        branch = DeckBranch.objects.filter(pk=spec['branch'], deck=deck).first()
        if branch is None:
            raise NotFound('That branch is gone.')
        deck.branch = branch
        return deck_cards(deck), deck.name if branch.is_main else f'{deck.name} · {branch.name}'
    return deck_cards(deck), deck.name


def merge(cards: list[dict]) -> list[dict]:
    """One row per name and role, in name order."""
    counts: Counter = Counter()
    for c in cards:
        counts[(c['name'], bool(c['commander']))] += c['quantity']
    return [{'name': name, 'quantity': n, 'commander': commander}
            for (name, commander), n in sorted(counts.items(), key=lambda kv: (not kv[0][1], kv[0][0]))]


def commanders(cards: list[dict]) -> list[str]:
    return [c['name'] for c in cards if c['commander']]


def printings_by_name(names) -> dict:
    """Name -> newest printing, by full or front name."""
    names = set(names)
    found = {}
    for p in Printing.objects.filter(Q(name__in=names) | Q(front_name__in=names)).order_by('-released_at'):
        for key in (p.name, p.front_name):
            if key in names:
                found.setdefault(key, p)
    return found


def identity(cards: list[dict]) -> list[str]:
    found = printings_by_name(commanders(cards))
    return sorted({c for p in found.values() for c in p.color_identity})


# Seats ---------------------------------------------------------------------

def apply_swaps(cards: list[dict], swaps: dict[str, str]) -> list[dict]:
    return merge([{**c, 'name': swaps.get(c['name'], c['name'])} for c in cards])


def user_swaps(user, deck: Deck) -> dict[str, str]:
    if not user.is_authenticated:
        return {}
    return dict(SimSwap.objects.filter(user=user, deck=deck).values_list('from_name', 'to_name'))


def seat_source(user, spec: dict) -> dict:
    """A seat from `{"deck": id}` or `{"pool": id}`: label, source, cards (raw) and saved swaps."""
    if spec.get('pool'):
        pool = PoolDeck.objects.filter(pk=spec['pool']).select_related('added_by').first()
        if pool is None:
            raise NotFound('That opponent pool deck is gone.')
        return {'label': pool.name, 'source': SimSeat.Source.POOL, 'source_id': pool.id,
                'owner': pool.added_by.username if pool.added_by else 'Forge', 'cards': pool.cards, 'swaps': {}}
    deck = commander_decks(visible_decks(user)).filter(pk=spec.get('deck')).select_related('user').first()
    if deck is None:
        raise NotFound('That deck is not available.')
    cards, label = deck_list(deck, spec)
    if not commanders(cards):
        raise ValidationError({'seats': f'{label} has no commander.'})
    return {'label': label, 'source': SimSeat.Source.DECK, 'source_id': deck.id, 'owner': deck.user.username,
            'cards': cards, 'swaps': user_swaps(user, deck)}


def unsupported(cards: list[dict], supported: frozenset[str]) -> list[str]:
    return sorted({c['name'] for c in cards if forge.forge_name(c['name'], supported) is None})


def check_pod(user, seats: list[dict]) -> list[dict]:
    """Each seat's unsupported cards, with the user's saved swap for each (AC-11, AC-13)."""
    supported = forge.supported_names()
    out = []
    for index, spec in enumerate(seats):
        seat = seat_source(user, spec)
        missing = unsupported(seat['cards'], supported)
        out.append({
            'index': index, 'label': seat['label'], 'source': seat['source'], 'id': seat['source_id'],
            'unsupported': [{'name': name, 'swap': swap if (swap := seat['swaps'].get(name)) and forge.forge_name(swap, supported) else None}
                            for name in missing],
        })
    return out


def save_swaps(user, spec: dict, swaps: list[dict]):
    """Sim swaps for a player's deck (this user only) or edits to a pool copy (everyone) (AC-13)."""
    supported = forge.supported_names()
    for s in swaps:
        if forge.forge_name(s['to'], supported) is None:
            raise ValidationError({'to': f"Forge doesn't support {s['to']}."})
    if spec.get('pool'):
        with transaction.atomic():
            pool = PoolDeck.objects.select_for_update().filter(pk=spec['pool']).first()
            if pool is None:
                raise NotFound('That opponent pool deck is gone.')
            pool.cards = apply_swaps(pool.cards, {s['from']: s['to'] for s in swaps})
            pool.save(update_fields=['cards'])
        return
    if not user.is_authenticated:
        raise NotFound()
    deck = visible_deck(user, spec.get('deck'))
    for s in swaps:
        SimSwap.objects.update_or_create(user=user, deck=deck, from_name=s['from'], defaults={'to_name': s['to']})


def suggestions(name: str, colours: list[str]) -> list[dict]:
    """Forge-supported stand-ins: EDHREC's similar cards, then cards sharing the first category (AC-12)."""
    supported = forge.supported_names()
    picked: list[str] = []

    def fits(p) -> bool:
        return set(p.color_identity) <= set(colours)

    similar = [c['name'] for c in edhrec_for(name).get('similar', [])]
    found = printings_by_name(similar)
    for n in similar:
        p = found.get(n)
        if p and fits(p) and forge.forge_name(p.name, supported) and p.name not in picked and len(picked) < SUGGESTIONS:
            picked.append(p.name)
    first = printings_by_name([name]).get(name)
    insight = CardInsight.objects.filter(oracle_id=first.oracle_id).first() if first else None
    if insight and insight.categories:
        oracles = CardInsight.objects.filter(categories__contains=[insight.categories[0]]).exclude(oracle_id=first.oracle_id).values('oracle_id')
        rows = (Printing.objects.filter(oracle_id__in=oracles, color_identity__contained_by=colours)
                .order_by('name', '-released_at').distinct('name'))
        count = 0
        for p in rows:
            if count >= SUGGESTIONS:
                break
            if forge.forge_name(p.name, supported) and p.name not in picked:
                picked.append(p.name)
                count += 1
    found = printings_by_name(picked)
    return [{'name': n, 'image_small': found[n].image_small if n in found else '',
             'image_normal': found[n].image_normal if n in found else ''} for n in picked]


# Opponent pool -------------------------------------------------------------

def ensure_precons():
    """Forge's Commander precons start the pool, once (AC-8)."""
    if PoolDeck.objects.filter(precon=True).exists():
        return
    try:
        decks = forge.precons()
    except forge.ForgeError:
        return
    PoolDeck.objects.bulk_create(
        PoolDeck(name=d['name'][:120], cards=merge(forge.parse_dck(d['dck'])), precon=True)
        for d in decks if any(c['commander'] for c in forge.parse_dck(d['dck'])))


def pool_from_text(user, name: str, text: str) -> PoolDeck:
    rows, errors = textlist.parse(text)
    if errors:
        raise ValidationError({'text': [f'Line {e.line}: {e.reason}' for e in errors][:10]})
    cards = merge([{'name': r.printing.name, 'quantity': r.quantity, 'commander': zone == 'commander'}
                   for zone, r in rows if zone in ('commander', 'main')])
    if not commanders(cards):
        raise ValidationError({'text': 'The list needs a Commander section.'})
    return PoolDeck.objects.create(name=name, cards=cards, added_by=user)


def pool_from_deck(user, deck: Deck) -> PoolDeck:
    cards = deck_cards(deck)
    if not commanders(cards):
        raise ValidationError({'deck': 'The deck needs a commander.'})
    return PoolDeck.objects.create(name=deck.name[:120], cards=cards, added_by=user)


# Runs ----------------------------------------------------------------------

def unique_labels(labels: list[str]) -> list[str]:
    """Forge names players after their decks, so names must differ."""
    seen: Counter = Counter()
    out = []
    for label in labels:
        seen[label] += 1
        out.append(label if seen[label] == 1 else f'{label} ({seen[label]})')
    return out


def run_search(seats) -> str:
    """Deck and commander names of every seat, for the run search (spec 025, AC-7)."""
    names = []
    for seat in seats:
        names.append(seat['label'])
        names.extend(commanders(seat['cards']))
    return '\n'.join(names).lower()


def build_seat(user, spec: dict, supported, check: list[dict]) -> dict:
    """A seat with swaps applied and Forge's names; refuses unsupported cards (AC-11)."""
    seat = seat_source(user, spec)
    cards = apply_swaps(seat['cards'], seat['swaps'])
    if unsupported(cards, supported):
        raise ValidationError({'unsupported': check_pod(user, check)})
    cards = merge([{**c, 'name': forge.forge_name(c['name'], supported)} for c in cards])
    profile = spec.get('profile') or 'Default'
    if profile not in PROFILES:
        raise ValidationError({'profile': f'Unknown AI profile {profile}.'})
    return {**seat, 'cards': cards, 'profile': profile}


def list_specs(tested: dict, compare: dict | None) -> list[dict]:
    """The tested seat once per list it plays (spec 027, AC-17)."""
    if not compare:
        return [tested]
    lists = compare.get('lists') or []
    if not tested.get('deck'):
        raise ValidationError({'compare': 'Compare versions needs one of your or a public deck in the tested seat.'})
    if not 2 <= len(lists) <= 4:
        raise ValidationError({'compare': 'Pick 2 to 4 lists.'})
    keys = [(item.get('branch'), item.get('version')) for item in lists]
    if len(set(keys)) != len(keys):
        raise ValidationError({'compare': 'Pick each list once.'})
    plain = {k: v for k, v in tested.items() if k not in ('branch', 'version')}
    return [{**plain, **{k: v for k, v in item.items() if k in ('branch', 'version') and v}} for item in lists]


def start_run(user, seats: list[dict], games: int, minutes: int, seat_mode: str, order: list[int] | None = None,
              compare: dict | None = None) -> SimRun:
    """Copy the pod with swaps applied and queue the run (AC-11, AC-14, AC-15).

    Seat 0 is the tested deck: a player's deck or a pool deck (spec 025, AC-3). With `compare`
    (spec 027, AC-17 to AC-19) seat 0 plays 2 to 4 lists: in one run, or one run per list.
    """
    if not 2 <= len(seats) <= MAX_SEATS:
        raise ValidationError({'seats': 'A pod has 2 to 6 decks.'})
    if order and sorted(order) != list(range(len(seats))):
        raise ValidationError({'order': 'The order must name every seat once.'})
    supported = forge.supported_names()
    tested = list_specs(seats[0], compare)
    check = [*tested, *seats[1:]]
    lists = [build_seat(user, spec, supported, check) for spec in tested]
    opponents = [build_seat(user, spec, supported, check) for spec in seats[1:]]
    deck = Deck.objects.get(pk=lists[0]['source_id']) if lists[0]['source'] == SimSeat.Source.DECK else None
    every = [s['label'] for s in lists]

    def create(first: dict, **extra) -> SimRun:
        built = [first, *opponents]
        labels = unique_labels([s['label'] for s in built])
        search = run_search([{**s, 'label': labels[i]} for i, s in enumerate(built)])
        # A comparison is found by any of its lists' names.
        search = '\n'.join([search, *every]).lower() if compare else search
        run = SimRun.objects.create(deck=deck, user=user, games=games, minutes=minutes, seat_mode=seat_mode, fixed_order=order or [],
                                    search=search, **extra)
        SimSeat.objects.bulk_create(
            SimSeat(run=run, index=i, label=labels[i], source=s['source'], source_id=s['source_id'],
                    owner=s['owner'], profile=s['profile'], cards=s['cards'])
            for i, s in enumerate(built))
        return run

    with transaction.atomic():
        if not compare:
            return create(lists[0])
        if compare.get('mode') == 'separate':
            group = uuid.uuid4()
            return [create(seat, group=group) for seat in lists][0]
        # One run: each list plays `games` games; seat 0 holds the first list.
        others = [s['label'] for s in opponents]
        variants = [{'label': unique_labels([s['label'], *others])[0], 'cards': s['cards']} for s in lists]
        run = create(lists[0], variants=variants)
        run.games = games * len(lists)
        run.save(update_fields=['games'])
        return run


def can_cancel(user, run: SimRun) -> bool:
    """Who started it (spec 024 AC-17) or an admin (spec 025, AC-13)."""
    return user.is_authenticated and (run.user_id == user.id or user.is_staff)


def _cancel(user, run: SimRun) -> SimRun:
    """A queued run stops at once; a playing one after its game is killed."""
    run = SimRun.objects.select_for_update().get(pk=run.pk)
    if run.status == SimRun.Status.QUEUED:
        run.status = SimRun.Status.CANCELLED
        run.cancelled_by = user
        run.save(update_fields=['status', 'cancelled_by'])
    elif run.status == SimRun.Status.PLAYING and not run.cancel_requested:
        run.cancel_requested = True
        run.cancelled_by = user
        run.save(update_fields=['cancel_requested', 'cancelled_by'])
    return run


def cancel_run(user, run: SimRun) -> SimRun:
    if not can_cancel(user, run):
        raise NotFound()
    with transaction.atomic():
        return _cancel(user, run)


def cancel_all(user) -> int:
    """An admin stops the playing run and cancels every queued one (spec 025, AC-14)."""
    if not user.is_staff:
        raise NotFound()
    with transaction.atomic():
        runs = list(SimRun.objects.filter(status__in=[SimRun.Status.QUEUED, SimRun.Status.PLAYING]))
        for run in runs:
            _cancel(user, run)
    return len(runs)


def delete_run(user, run: SimRun):
    if run.user_id != user.id:
        raise NotFound()
    if run.status in (SimRun.Status.QUEUED, SimRun.Status.PLAYING):
        raise ValidationError({'status': 'Cancel the run first.'})
    run.delete()


def visible_runs(user):
    """Runs a user can see (spec 025, AC-10, AC-12): a pool deck's, a public deck's or their own; admins all."""
    if not user.is_authenticated:
        return SimRun.objects.none()
    runs = SimRun.objects.all()
    if not user.is_staff:
        runs = runs.filter(Q(deck__isnull=True) | Q(deck__is_public=True) | Q(deck__user=user))
    return runs


def visible_run(user, pk) -> SimRun:
    return get_object_or_404(visible_runs(user).select_related('deck__user', 'user', 'cancelled_by'), pk=pk)
