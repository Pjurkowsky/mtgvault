"""Plays queued runs against the Forge service (spec 024, AC-14 to AC-17, AC-22).

Spec 029: a Forge plays up to its Games at once. Spec 031: Auto runs play on Other while it
answers, otherwise on Main; Main and Other runs only on theirs. Games being played are kept in memory, so after a restart
the unfinished ones play again."""

import gzip
import json
import logging
import random
import threading
import time

from django.conf import settings
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from . import forge
from .models import SimGame, SimPlaying, SimRun

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
    """Runs left Playing by a restart wait in the queue again; their games play again."""
    SimRun.objects.filter(status=SimRun.Status.PLAYING).update(status=SimRun.Status.QUEUED)
    SimPlaying.objects.all().delete()


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


def play_game(run: SimRun, seats, number: int, server: forge.Server, version: str) -> bool:
    """Plays game `number` (1-based) on `server` and stores it. False when the run was cancelled meanwhile."""
    variant, game = variant_of(run, number)
    order = seat_order(len(seats), game, run.seat_mode, run.id, run.fixed_order)
    lists = {s.index: (s.label, s.cards) for s in seats}
    if run.variants:
        lists[0] = (run.variants[variant]['label'], run.variants[variant]['cards'])
    decks = [{'dck': forge.to_dck(*lists[i]), 'profile': seats[i].profile} for i in order]
    started = time.monotonic()
    body = {'decks': decks, 'timeout': run.minutes * 60, 'seed': run.id * 10_000 + game + 1, 'lookahead': run.lookahead}
    game_id = forge.call('POST', '/games', body, server=server)['id']
    limit = started + run.minutes * 60 + 120
    try:
        while True:
            time.sleep(settings.SIMS_POLL_SECONDS)
            if cancelled(run):
                return False
            found = forge.call('GET', f'/games/{game_id}', server=server)
            if found['status'] == 'done':
                break
            if time.monotonic() > limit:
                found = {'result': {'status': 'draw', 'error': 'timeout'}, 'steps': []}
                break
    finally:
        try:
            forge.call('DELETE', f'/games/{game_id}', server=server)
        except forge.ForgeError:
            pass
    result, steps = found['result'], found.get('steps') or []
    status = result.get('status') if result.get('status') in SimGame.Status.values else SimGame.Status.FAILED
    winner = result.get('winner_seat')
    lost_on = {str(order[int(k)]): v for k, v in (result.get('lost_on') or {}).items()}
    SimGame.objects.update_or_create(run=run, number=number, defaults={
        'status': status,
        'variant': variant,
        'forge_version': version,
        'forge_server': server.role,
        'forge_url': forge.host(server.url),
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


class Dispatcher:
    """Starts games up to each Forge's Games at once (spec 029, AC-10, AC-11). Auto runs go to
    Other while it answers, otherwise Main; Main and Other runs only to theirs (spec 031, AC-2 to AC-4)."""

    ACTIVE = [SimRun.Status.QUEUED, SimRun.Status.PLAYING]

    def __init__(self):
        self.lock = threading.Lock()
        # (run id, game number) -> role of the Forge playing it
        self.playing: dict[tuple[int, int], str] = {}

    def busy(self, role: str) -> int:
        with self.lock:
            return sum(1 for r in self.playing.values() if r == role)

    def in_flight(self, run_id: int) -> set[int]:
        with self.lock:
            return {n for (r, n) in self.playing if r == run_id}

    def tick(self) -> None:
        self.finish()
        waiting = set(SimRun.objects.filter(status__in=self.ACTIVE, cancel_requested=False).values_list('forge', flat=True))
        if not waiting:
            return
        # The Forge each choice plays on now, with its version.
        up: dict[str, tuple[forge.Server, str]] = {}
        for role in (SimRun.Forge.MAIN, SimRun.Forge.OTHER):
            if role not in waiting:
                continue
            found = forge.server(role)
            try:
                up[role] = (found, forge.version(found)) if found else None
            except forge.ForgeError:
                up[role] = None
            if up[role] is None:
                self.fail_chosen(role, found)
        auto = forge.active() if SimRun.Forge.AUTO in waiting else None
        for server, version in {s.role: (s, v) for s, v in [x for x in [*up.values(), auto] if x]}.values():
            choices = [server.role] + ([SimRun.Forge.AUTO] if auto and auto[0].role == server.role else [])
            while self.busy(server.role) < server.slots:
                claimed = self.claim(server, choices)
                if claimed is None:
                    break
                threading.Thread(target=self.play, args=(*claimed, server, version), daemon=True).start()

    def fail_chosen(self, role: str, server: forge.Server | None) -> None:
        """Runs set to a Forge that doesn't answer fail, keeping their finished games (AC-4)."""
        error = f'{forge.label(role, server.url if server else "")} is not answering.'
        SimRun.objects.filter(status__in=self.ACTIVE, forge=role, cancel_requested=False).update(
            status=SimRun.Status.FAILED, error=error, finished_at=timezone.now())

    def claim(self, server: forge.Server, choices: list[str]) -> tuple[int, int] | None:
        """The oldest run's lowest game not played or playing; the run turns Playing."""
        runs = (SimRun.objects.filter(status__in=self.ACTIVE, cancel_requested=False, forge__in=choices)
                .order_by('created_at', 'id').values_list('id', 'games'))
        for run_id, games in runs:
            taken = set(SimGame.objects.filter(run_id=run_id).values_list('number', flat=True)) | self.in_flight(run_id)
            number = next((n for n in range(1, games + 1) if n not in taken), None)
            if number is None:
                continue
            with transaction.atomic():
                run = SimRun.objects.select_for_update().filter(pk=run_id, status__in=self.ACTIVE, cancel_requested=False).first()
                if run is None:
                    continue
                if run.status == SimRun.Status.QUEUED:
                    run.status = SimRun.Status.PLAYING
                    run.started_at = run.started_at or timezone.now()
                    run.save(update_fields=['status', 'started_at'])
                # Shown live on the run's page (AC-8).
                SimPlaying.objects.update_or_create(run_id=run_id, number=number, defaults={
                    'role': server.role, 'url': forge.host(server.url), 'started_at': timezone.now()})
            with self.lock:
                self.playing[(run_id, number)] = server.role
            return run_id, number
        return None

    def play(self, run_id: int, number: int, server: forge.Server, version: str) -> None:
        try:
            run = SimRun.objects.get(pk=run_id)
            play_game(run, list(run.seats.all()), number, server, version)
        except forge.ForgeUnreachable as e:
            if run.forge == SimRun.Forge.AUTO:
                # Played again on whichever Forge answers (spec 029, AC-12).
                log.warning('Game %s of run %s goes back to the queue: %s', number, run_id, e)
            else:
                # Its own Forge stopped answering: the run fails (spec 031, AC-4).
                SimRun.objects.filter(pk=run_id, status__in=self.ACTIVE).update(
                    status=SimRun.Status.FAILED, error=f'{forge.label(server.role, server.url)} is not answering.',
                    finished_at=timezone.now())
        except forge.ForgeError as e:
            log.warning('Run %s stopped: %s', run_id, e)
            SimRun.objects.filter(pk=run_id, status=SimRun.Status.PLAYING).update(
                status=SimRun.Status.FAILED, error=str(e)[:4000], finished_at=timezone.now())
        except Exception as e:
            log.exception('Game %s of run %s failed', number, run_id)
            SimRun.objects.filter(pk=run_id, status=SimRun.Status.PLAYING).update(
                status=SimRun.Status.FAILED, error=str(e)[:4000], finished_at=timezone.now())
        finally:
            SimPlaying.objects.filter(run_id=run_id, number=number).delete()
            with self.lock:
                self.playing.pop((run_id, number), None)
            connection.close()

    def finish(self) -> None:
        """Playing runs with nothing in flight: Cancelled when asked, Done when every game is in."""
        for run in SimRun.objects.filter(status=SimRun.Status.PLAYING).only('id', 'games', 'cancel_requested'):
            if self.in_flight(run.id):
                continue
            if run.cancel_requested:
                SimRun.objects.filter(pk=run.pk).update(status=SimRun.Status.CANCELLED, finished_at=timezone.now())
            elif run.played.count() >= run.games:
                SimRun.objects.filter(pk=run.pk).update(status=SimRun.Status.DONE, finished_at=timezone.now())


def loop(stop=lambda: False):
    while not stop():
        try:
            recover()
            break
        except DatabaseError:  # not migrated yet
            time.sleep(settings.SIMS_IDLE_SECONDS)
    dispatcher = Dispatcher()
    while not stop():
        try:
            dispatcher.tick()
        except DatabaseError:
            log.warning('Could not read the queue', exc_info=True)
        time.sleep(settings.SIMS_IDLE_SECONDS)
