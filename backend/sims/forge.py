"""The Forge service (specs 024, 029, 031): an HTTP API around MTG Vault's Forge runner (docker/forge),
on the server itself (Main) or on another PC (Other)."""

import json
import logging
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

from django.core.cache import cache

log = logging.getLogger(__name__)
TIMEOUT = 10
CARDS_KEY = 'sims:forge-cards'
STATUS_KEY = 'sims:forge-status'


class ForgeError(Exception):
    pass


class ForgeUnreachable(ForgeError):
    """The Forge didn't answer, is failing or refused the key: try the other one (spec 029, AC-12)."""


@dataclass(frozen=True)
class Server:
    role: str
    url: str
    key: str = ''
    slots: int = 1


def servers() -> list[Server]:
    """Other, then Main: Auto's order (spec 031, AC-3); those with an address."""
    from .models import ForgeServer

    main, other = ForgeServer.pair()
    return [Server(s.role, s.url.strip(), s.key, s.slots) for s in (other, main) if s.url.strip()]


def server(role: str) -> Server | None:
    """Main or Other, when it has an address."""
    return next((s for s in servers() if s.role == role), None)


def label(role: str, url: str) -> str:
    """"Other (192.168.1.20:8790)" (spec 031, AC-4)."""
    return f'{role.title()} ({host(url)})' if url else role.title()


def host(url: str) -> str:
    """The address without its scheme: 192.168.1.20:8790 (spec 031, AC-7)."""
    return re.sub(r'^\w+://', '', url.strip()).rstrip('/')


def call(method: str, path: str, body=None, timeout: float = TIMEOUT, server: Server | None = None):
    """One request to `server`, or to the Forge answering now."""
    if server is None:
        server = (active() or (None, ''))[0]
    if server is None:
        raise ForgeUnreachable('Forge is not set up on this server.' if not servers() else 'No Forge is answering.')
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Content-Type': 'application/json'}
    if server.key:
        headers['X-Forge-Key'] = server.key
    request = urllib.request.Request(server.url.rstrip('/') + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content = response.read()
    except urllib.error.HTTPError as e:
        try:
            message = json.loads(e.read()).get('error')
        except ValueError:
            message = None
        if e.code == 401:
            raise ForgeUnreachable('Wrong Forge key.') from e
        if e.code >= 500:
            raise ForgeUnreachable(message or f'Forge answered {e.code}.') from e
        raise ForgeError(message or f'Forge answered {e.code}.') from e
    except (urllib.error.URLError, OSError, ValueError) as e:
        reason = getattr(e, 'reason', e)
        raise ForgeUnreachable(f"Forge is not reachable: {getattr(reason, 'strerror', None) or reason}") from e
    return json.loads(content) if content else None


def version(server: Server, timeout: float = 3) -> str:
    """The Forge version `server` reports; raises when it doesn't answer (spec 029, AC-8)."""
    return str(call('GET', '/health', timeout=timeout, server=server).get('version', ''))


def answering() -> list[tuple[Server, str]]:
    """Each Forge that answers now, Other first, with its version."""
    found = []
    for server in servers():
        try:
            found.append((server, version(server)))
        except ForgeError:
            continue
    return found


def active() -> tuple[Server, str] | None:
    """Auto's Forge: Other while it answers, otherwise Main, with its version (spec 031, AC-3)."""
    for server in servers():
        try:
            return server, version(server)
        except ForgeError:
            continue
    return None


def status() -> dict:
    """{available, version}; checked once a minute (spec 024 AC-1, spec 029 AC-10)."""
    if not servers():
        return {'available': False, 'version': ''}
    if (cached := cache.get(STATUS_KEY)) is not None:
        return cached
    up = answering()
    found = {'available': bool(up), 'version': up[0][1] if up else ''}
    cache.set(STATUS_KEY, found, 60)
    return found


def forget_status():
    cache.delete(STATUS_KEY)


def supported_names() -> frozenset[str]:
    """Every card Forge implements, cached for a day (AC-11)."""
    if (cached := cache.get(CARDS_KEY)) is not None:
        return frozenset(cached)
    names = call('GET', '/cards', timeout=60)
    cache.set(CARDS_KEY, names, 24 * 3600)
    return frozenset(names)


def forge_name(name: str, supported: frozenset[str]) -> str | None:
    """The name Forge knows the card by: the full name, else the front face's (AC-11)."""
    if name in supported:
        return name
    front = name.split(' // ')[0]
    return front if front in supported else None


def precons() -> list[dict]:
    return call('GET', '/precons', timeout=60)


SECTION = re.compile(r'^\[(\w+)\]\s*$')
LINE = re.compile(r'^\s*(\d+)\s+([^|]+?)\s*(?:\|.*)?$')


def parse_dck(text: str) -> list[dict]:
    """Cards of a Forge .dck file: [Commander] and [Main] sections."""
    section, cards = None, []
    for raw in text.splitlines():
        if m := SECTION.match(raw):
            section = m.group(1).lower()
            continue
        if section in ('commander', 'main') and (m := LINE.match(raw)):
            cards.append({'name': m.group(2), 'quantity': int(m.group(1)), 'commander': section == 'commander'})
    return cards


def to_dck(name: str, cards: list[dict]) -> str:
    lines = ['[metadata]', f'Name={name}', '[Commander]']
    lines += [f"{c['quantity']} {c['name']}" for c in cards if c['commander']]
    lines.append('[Main]')
    lines += [f"{c['quantity']} {c['name']}" for c in cards if not c['commander']]
    return '\n'.join(lines) + '\n'
