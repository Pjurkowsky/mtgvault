"""MTG Vault's Forge service (specs 024, 029): a small HTTP API around MtgvaultSim.

With FORGE_KEY set, every request must send it as X-Forge-Key (else 401).

GET  /health          {"version": "2.0.16"}
GET  /cards           names of every card Forge implements
GET  /precons         Forge's Commander precons: [{"name", "dck"}]
POST /games           {"decks": [{"dck", "profile"}], "timeout": s, "seed": n, "lookahead": "normal"} -> {"id"}
GET  /games/<id>      {"status": "playing"} or {"status": "done", "result", "steps"}
DELETE /games/<id>    stop a game
"""

import hmac
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

FORGE = Path(os.environ.get('FORGE_HOME', '/forge'))
VERSION = os.environ.get('FORGE_VERSION', '')
MEMORY = os.environ.get('FORGE_MEMORY', '2g')
KEY = os.environ.get('FORGE_KEY', '')
JAR = next(FORGE.glob('forge-gui-desktop-*-jar-with-dependencies.jar'))
PROFILES = {'Default', 'Cautious', 'Reckless', 'Experimental', 'Hard', 'Hardest'}
LOOKAHEAD = {'off', 'light', 'normal', 'max'}
GAMES: dict[str, dict] = {}
LOCK = threading.Lock()


def card_names() -> list[str]:
    names = set()
    with zipfile.ZipFile(FORGE / 'res/cardsfolder/cardsfolder.zip') as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            for line in z.read(info).decode('utf-8', 'replace').splitlines():
                if line.startswith('Name:'):
                    names.add(line[5:].strip())
                    break
    return sorted(names)


def precons() -> list[dict]:
    folder = FORGE / 'res/quest/commanderprecons'
    out = []
    for path in sorted(folder.glob('*.dck')):
        text = path.read_text('utf-8', 'replace')
        name = re.search(r'^Name=(.*)$', text, re.M)
        out.append({'name': name.group(1).strip() if name else path.stem, 'dck': text})
    return out


CARDS = card_names()
PRECONS = precons()


def start(body: dict) -> str:
    decks = body.get('decks') or []
    if len(decks) < 2:
        raise ValueError('At least two decks are needed.')
    game_id = uuid.uuid4().hex
    folder = Path(tempfile.mkdtemp(prefix='game-'))
    args = ['java', f'-Xmx{MEMORY}', '-Dfile.encoding=UTF-8', '-cp', f'{JAR}:/opt/mtgvault', 'MtgvaultSim',
            '--out', str(folder / 'game.jsonl'), '--timeout', str(int(body.get('timeout') or 300))]
    if body.get('seed') is not None:
        args += ['--seed', str(int(body['seed']))]
    lookahead = body.get('lookahead') or 'off'
    if lookahead not in LOOKAHEAD:
        raise ValueError(f'Unknown look-ahead {lookahead}.')
    args += ['--lookahead', lookahead]
    for i, deck in enumerate(decks):
        profile = deck.get('profile') or 'Default'
        if profile not in PROFILES:
            raise ValueError(f'Unknown AI profile {profile}.')
        path = folder / f'seat{i}.dck'
        path.write_text(deck['dck'], 'utf-8')
        args.append(f'{path}:{profile}')
    proc = subprocess.Popen(args, cwd=FORGE, stdout=subprocess.DEVNULL, stderr=open(folder / 'stderr.txt', 'w'))
    with LOCK:
        GAMES[game_id] = {'proc': proc, 'folder': folder}
    return game_id


def poll(game_id: str) -> dict | None:
    with LOCK:
        game = GAMES.get(game_id)
    if game is None:
        return None
    if game['proc'].poll() is None:
        return {'status': 'playing'}
    lines = (game['folder'] / 'game.jsonl').read_text('utf-8').splitlines() if (game['folder'] / 'game.jsonl').exists() else []
    rows = [json.loads(line) for line in lines if line.strip()]
    result = rows[-1]['result'] if rows and 'result' in rows[-1] else None
    if result is None:
        err = (game['folder'] / 'stderr.txt').read_text('utf-8', 'replace')[-2000:]
        result = {'status': 'failed', 'error': err or f'Forge exited with {game["proc"].returncode}'}
    return {'status': 'done', 'result': result, 'steps': [r for r in rows if 'result' not in r]}


def stop(game_id: str) -> bool:
    with LOCK:
        game = GAMES.pop(game_id, None)
    if game is None:
        return False
    if game['proc'].poll() is None:
        game['proc'].kill()
        game['proc'].wait()
    shutil.rmtree(game['folder'], ignore_errors=True)
    return True


class Handler(BaseHTTPRequestHandler):
    def send(self, status: int, body) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def allowed(self) -> bool:
        if KEY and not hmac.compare_digest(self.headers.get('X-Forge-Key', ''), KEY):
            self.send(401, {'error': 'Wrong Forge key.'})
            return False
        return True

    def do_GET(self):
        if not self.allowed():
            return
        if self.path == '/health':
            return self.send(200, {'version': VERSION})
        if self.path == '/cards':
            return self.send(200, CARDS)
        if self.path == '/precons':
            return self.send(200, PRECONS)
        if self.path.startswith('/games/'):
            found = poll(self.path.removeprefix('/games/'))
            return self.send(200, found) if found else self.send(404, {'error': 'No such game.'})
        self.send(404, {'error': 'Not found.'})

    def do_POST(self):
        if not self.allowed():
            return
        if self.path != '/games':
            return self.send(404, {'error': 'Not found.'})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
            self.send(201, {'id': start(body)})
        except (ValueError, KeyError) as e:
            self.send(400, {'error': str(e)})

    def do_DELETE(self):
        if not self.allowed():
            return
        if self.path.startswith('/games/') and stop(self.path.removeprefix('/games/')):
            return self.send(204, {})
        self.send(404, {'error': 'No such game.'})

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print(f'Forge {VERSION}: {len(CARDS)} cards, {len(PRECONS)} precons, port 8790, key {"on" if KEY else "off"}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', 8790), Handler).serve_forever()
