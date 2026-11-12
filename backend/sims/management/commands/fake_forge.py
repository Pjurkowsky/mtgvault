"""A stand-in for the Forge service in e2e tests (spec 024): the same API, answered from
fixtures recorded with the real runner. Games take about a second.

The fixtures were recorded with spec 026's runner: game-2 is "Krenko Forest" against
"Piper Forest" (seed 2), game-4 four Forge precons (seed 7)."""

import gzip
import json
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from django.core.management.base import BaseCommand

FIXTURES = Path(__file__).resolve().parents[2] / 'fixtures' / 'forge'
GAMES: dict[str, dict] = {}
LOCK = threading.Lock()
GAME_SECONDS = 1.0
# A deck named "Hangs" plays this long, so a run can be seen playing and cancelled.
HANG_SECONDS = 8.0


def load(name):
    path = FIXTURES / name
    return json.loads(gzip.decompress(path.read_bytes()) if name.endswith('.gz') else path.read_text())


def recorded(players: int) -> dict:
    """The recorded game for this many players (2 or 4; others reuse the 4-player one, cut down)."""
    game = load('game-2.json.gz' if players == 2 else 'game-4.json.gz')
    if players in (3, 5, 6):
        game = cut(game, players)
    return game


def cut(game: dict, players: int) -> dict:
    """Fit a recorded game to another table size: missing seats sit out, extra seats get nothing."""
    size = len(game['result']['players'])
    steps = []
    for step in game['steps']:
        if step.get('active') is not None and step['active'] >= players:
            continue
        step = dict(step)
        if 'board' in step:
            board = step['board'][:players]
            while len(board) < players:
                board.append({'life': 40, 'lost': False, 'hand': 7, 'library': 92, 'battlefield': [], 'graveyard': [], 'exile': [], 'command': []})
            step['board'] = board
        steps.append(step)
    result = dict(game['result'])
    if result.get('winner_seat') is not None and result['winner_seat'] >= players:
        result['winner_seat'] = 0
    result['lost_on'] = {k: v for k, v in result['lost_on'].items() if int(k) < players and int(k) != result.get('winner_seat')}
    result['players'] = result['players'][:players] + [f'Player {i + 1}' for i in range(size, players)]
    return {'steps': steps, 'result': result}


def rename(game: dict, names: list[str]) -> dict:
    """Put the posted deck names where the recorded ones were."""
    text = json.dumps(game)
    for old, new in zip(game['result']['players'], names):
        text = text.replace(json.dumps(old)[1:-1], json.dumps(new)[1:-1])
    return json.loads(text)


def unrecorded(game: dict) -> dict:
    """A game as the runner recorded it before spec 026: no hand, library or combat details."""
    steps = []
    for step in game['steps']:
        if 'board' in step:
            board = [{k: v for k, v in seat.items() if k not in ('hand_cards', 'library_cards')} for seat in step['board']]
            for seat in board:
                seat['battlefield'] = [{k: v for k, v in c.items() if k not in ('attacking', 'blocking')} for c in seat['battlefield']]
            step = {**step, 'board': board}
        steps.append(step)
    return {**game, 'steps': steps}


def deck_name(dck: str) -> str:
    for line in dck.splitlines():
        if line.startswith('Name='):
            return line[5:]
    return ''


def outcome(decks: list[dict]) -> dict:
    names = [deck_name(d['dck']) for d in decks]
    game = rename(recorded(len(decks)), names)
    if any('Broken' in n for n in names):
        return {'result': {'status': 'failed', 'error': 'java.lang.IllegalStateException: Broken deck', 'log': []}, 'steps': []}
    # A deck named "Unrecorded" gets a game like those recorded before spec 026.
    if any('Unrecorded' in n for n in names):
        game = unrecorded(game)
    if any('Stalls' in n for n in names):
        game['result'] = {**game['result'], 'status': 'draw', 'winner_seat': None, 'error': 'timeout', 'lost_on': {}}
    return game


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/health':
            return self.send(200, {'version': 'fake'})
        if self.path == '/cards':
            return self.send(200, load('cards.json'))
        if self.path == '/precons':
            return self.send(200, load('precons.json'))
        if self.path.startswith('/games/'):
            with LOCK:
                game = GAMES.get(self.path.removeprefix('/games/'))
            if game is None:
                return self.send(404, {'error': 'No such game.'})
            if time.monotonic() < game['ready']:
                return self.send(200, {'status': 'playing'})
            return self.send(200, {'status': 'done', **game['outcome']})
        self.send(404, {'error': 'Not found.'})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        decks = body.get('decks') or []
        if len(decks) < 2:
            return self.send(400, {'error': 'At least two decks are needed.'})
        game_id = uuid.uuid4().hex
        with LOCK:
            hangs = any('Hangs' in deck_name(d['dck']) for d in decks)
            GAMES[game_id] = {'ready': time.monotonic() + (HANG_SECONDS if hangs else GAME_SECONDS), 'outcome': outcome(decks)}
        self.send(201, {'id': game_id})

    def do_DELETE(self):
        with LOCK:
            found = GAMES.pop(self.path.removeprefix('/games/'), None)
        self.send(204 if found else 404, {})

    def log_message(self, *args):
        pass


class Command(BaseCommand):
    help = 'Serve a fake Forge service from fixtures (e2e tests).'

    def add_arguments(self, parser):
        parser.add_argument('--port', type=int, default=8790)

    def handle(self, *args, **options):
        self.stdout.write(f"Fake Forge on port {options['port']}")
        ThreadingHTTPServer(('127.0.0.1', options['port']), Handler).serve_forever()
