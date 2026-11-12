"""Plays queued runs one at a time against the Forge service (spec 024, AC-14 to AC-17, AC-22)."""

import gzip
import json
import logging
import random
import time

from django.conf import settings
from django.db import DatabaseError, transaction
from django.utils import timezone

from . import forge
from .models import SimGame, SimRun

log = logging.getLogger(__name__)


def seat_order(seats: int, game: int, mode: str, run_id: int, fixed: list[int] | None = None) -> list[int]:
    """Run seat indexes in turn order for game `game` (0-based); the first goes first (AC-6)."""
    order = list(range(seats))
    if mode == SimRun.SeatMode.FIXED and sorted(fixed or []) == order:
        return list(fixed)
    if mode == SimRun.SeatMode.ROTATE:
        shift = game % seats
        return order[shift:] + order[:shift]
    if mode == SimRun.SeatMode.RANDOM:
        random.Random(f'{run_id}-{game}').shuffle(order)
    return order


def recover():
    """Runs left Playing by a restart wait in the queue again."""
    SimRun.objects.filter(status=SimRun.Status.PLAYING).update(status=SimRun.Status.QUEUED)


def next_run() -> SimRun | None:
    with transaction.atomic():
        run = (SimRun.objects.select_for_update(skip_locked=True)
               .filter(status=SimRun.Status.QUEUED).order_by('created_at', 'id').first())
        if run is None:
            return None
        run.status = SimRun.Status.PLAYING
        run.started_at = run.started_at or timezone.now()
        run.save(update_fields=['status', 'started_at'])
    return run


def own_turns(steps: list[dict], seat: int) -> int:
    """How many turns a runner seat had: its own turn count (spec 024 Terms)."""
    return sum(1 for s in steps if s.get('type') == 'TURN' and s.get('active') == seat)


def cancelled(run: SimRun) -> bool:
    return SimRun.objects.filter(pk=run.pk, cancel_requested=True).exists()


def variant_of(run: SimRun, number: int) -> tuple[int, int]:
    """(list index, game index within that list), both 0-based. Each list of a Compare versions
    run plays the same seat orders and seeds (spec 027, AC-18)."""
    if not run.variants:
        return 0, number - 1
    return (number - 1) // run.per_variant, (number - 1) % run.per_variant


def play_game(run: SimRun, seats, number: int) -> bool:
    """Plays game `number` (1-based) and stores it. False when the run was cancelled meanwhile."""
    variant, game = variant_of(run, number)
    order = seat_order(len(seats), game, run.seat_mode, run.id, run.fixed_order)
    lists = {s.index: (s.label, s.cards) for s in seats}
    if run.variants:
        lists[0] = (run.variants[variant]['label'], run.variants[variant]['cards'])
    decks = [{'dck': forge.to_dck(*lists[i]), 'profile': seats[i].profile} for i in order]
    started = time.monotonic()
    game_id = forge.call('POST', '/games', {'decks': decks, 'timeout': run.minutes * 60, 'seed': run.id * 10_000 + game + 1})['id']
    limit = started + run.minutes * 60 + 120
    try:
        while True:
            time.sleep(settings.SIMS_POLL_SECONDS)
            if cancelled(run):
                return False
            found = forge.call('GET', f'/games/{game_id}')
            if found['status'] == 'done':
                break
            if time.monotonic() > limit:
                found = {'result': {'status': 'draw', 'error': 'timeout'}, 'steps': []}
                break
    finally:
        try:
            forge.call('DELETE', f'/games/{game_id}')
        except forge.ForgeError:
            pass
    result, steps = found['result'], found.get('steps') or []
    status = result.get('status') if result.get('status') in SimGame.Status.values else SimGame.Status.FAILED
    winner = result.get('winner_seat')
    lost_on = {str(order[int(k)]): v for k, v in (result.get('lost_on') or {}).items()}
    SimGame.objects.update_or_create(run=run, number=number, defaults={
        'status': status,
        'variant': variant,
        'seat_order': order,
        'winner_seat': order[winner] if status == SimGame.Status.WON and winner is not None and winner >= 0 else None,
        'turn': result.get('turn') or 0,
        'winner_turn': own_turns(steps, winner) if status == SimGame.Status.WON and winner is not None else None,
        'lost_on': lost_on,
        'error': '' if status != SimGame.Status.FAILED else (result.get('error') or 'Forge could not play this game.')[:4000],
        'duration_ms': int((time.monotonic() - started) * 1000),
        'replay': gzip.compress(json.dumps({'steps': steps, 'log': result.get('log') or []}).encode()),
    })
    return True


def play(run: SimRun):
    seats = list(run.seats.all())
    done = run.played.count()
    try:
        for number in range(done + 1, run.games + 1):
            if cancelled(run) or not play_game(run, seats, number):
                SimRun.objects.filter(pk=run.pk).update(status=SimRun.Status.CANCELLED, finished_at=timezone.now())
                return
        SimRun.objects.filter(pk=run.pk).update(status=SimRun.Status.DONE, finished_at=timezone.now())
    except forge.ForgeError as e:
        log.warning('Run %s stopped: %s', run.id, e)
        SimRun.objects.filter(pk=run.pk).update(status=SimRun.Status.FAILED, error=str(e)[:4000], finished_at=timezone.now())


def loop(stop=lambda: False):
    while not stop():
        try:
            recover()
            break
        except DatabaseError:  # not migrated yet
            time.sleep(settings.SIMS_IDLE_SECONDS)
    while not stop():
        try:
            run = next_run()
        except DatabaseError:
            log.warning('Could not read the queue', exc_info=True)
            time.sleep(settings.SIMS_IDLE_SECONDS)
            continue
        if run is None:
            time.sleep(settings.SIMS_IDLE_SECONDS)
            continue
        play(run)
