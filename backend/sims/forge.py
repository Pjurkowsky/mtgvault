"""The Forge service (spec 024): an HTTP API around MTG Vault's Forge runner (docker/forge)."""

import json
import logging
import re
import urllib.error
import urllib.request

from django.conf import settings
from django.core.cache import cache

log = logging.getLogger(__name__)
TIMEOUT = 10
CARDS_KEY = 'sims:forge-cards'
STATUS_KEY = 'sims:forge-status'


class ForgeError(Exception):
    pass


def url(path: str) -> str:
    return settings.FORGE_URL.rstrip('/') + path


def call(method: str, path: str, body=None, timeout: float = TIMEOUT):
    if not settings.FORGE_URL:
        raise ForgeError('Forge is not set up on this server.')
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url(path), data=data, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content = response.read()
    except urllib.error.HTTPError as e:
        try:
            message = json.loads(e.read()).get('error')
        except ValueError:
            message = None
        raise ForgeError(message or f'Forge answered {e.code}.') from e
    except (urllib.error.URLError, OSError) as e:
        raise ForgeError(f'Forge is not reachable: {e}') from e
    return json.loads(content) if content else None


def status() -> dict:
    """{available, version}; checked once a minute (AC-1)."""
    if not settings.FORGE_URL:
        return {'available': False, 'version': ''}
    if (cached := cache.get(STATUS_KEY)) is not None:
        return cached
    try:
        found = {'available': True, 'version': call('GET', '/health', timeout=3).get('version', '')}
    except ForgeError:
        found = {'available': False, 'version': ''}
    cache.set(STATUS_KEY, found, 60)
    return found


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
