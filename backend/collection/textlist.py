"""Plain-text card lists (AC-46, AC-52): `4 Lightning Bolt (2X2) 117 *F*`.

Only the name is required. Quantity defaults to 1, no finish marker means
nonfoil, and without set and number the newest printing (that has the finish)
is used.
"""

import re
from dataclasses import dataclass

from django.db.models import Q
from django.db.models.functions import Lower

from cards.models import Printing

MAX_LINES = 5000
LINE = re.compile(
    r'^(?:(?P<qty>\d+)x?\s+)?'
    r'(?P<name>.+?)'
    r'(?:\s+\((?P<set>[A-Za-z0-9]{2,8})\)(?:\s+(?P<number>[^\s*]+))?)?'
    r'(?:\s+\*(?P<finish>[FfEe])\*)?\s*$'
)
FINISH_MARKERS = {'F': 'foil', 'E': 'etched'}
MARKER_FOR = {'foil': ' *F*', 'etched': ' *E*', 'nonfoil': ''}


@dataclass
class ParsedRow:
    line: int
    quantity: int
    printing: Printing
    finish: str


@dataclass
class ParseError:
    line: int
    text: str
    reason: str


# `Fire / Ice` as some sites export it; Scryfall writes `Fire // Ice` (spec 016).
# Only a slash with spaces: joke names like `Who/What/When/Where/Why` keep theirs.
SINGLE_SLASH = re.compile(r'\s+/\s+')


def lookup_name(name: str) -> str:
    name = name.strip()
    return name if '//' in name else SINGLE_SLASH.sub(' // ', name)


def _is_comment(text: str) -> bool:
    return not text or text.startswith('#') or text.startswith('//')


def parse(text: str) -> tuple[list[ParsedRow], list[ParseError]]:
    lines = text.splitlines()
    if len(lines) > MAX_LINES:
        return [], [ParseError(0, '', f'Lists can have at most {MAX_LINES} lines.')]

    entries, errors = [], []
    for number, raw in enumerate(lines, start=1):
        text_line = raw.strip()
        if _is_comment(text_line):
            continue
        match = LINE.match(text_line)
        if not match:
            errors.append(ParseError(number, raw, 'Could not read this line.'))
            continue
        quantity = int(match['qty'] or 1)
        if not 1 <= quantity <= 999:
            errors.append(ParseError(number, raw, 'Quantity must be 1 to 999.'))
            continue
        entries.append((number, raw, quantity, match))

    # One query for every name in the list instead of one per line.
    names = {lookup_name(m['name']).lower() for _, _, _, m in entries}
    candidates: dict[str, list[Printing]] = {}
    found = Printing.objects.annotate(lname=Lower('name'), lfront=Lower('front_name')).filter(
        Q(lname__in=names) | Q(lfront__in=names)
    )
    for printing in found.select_related('set').order_by('-released_at', 'set_id', 'collector_number'):
        for key in {printing.name.lower(), printing.front_name.lower()} & names:
            candidates.setdefault(key, []).append(printing)

    rows = []
    for number, raw, quantity, match in entries:
        name = match['name'].strip()
        finish = FINISH_MARKERS.get((match['finish'] or '').upper(), 'nonfoil')
        options = candidates.get(lookup_name(name).lower(), [])
        if not options:
            errors.append(ParseError(number, raw, f'No card named "{name}".'))
            continue
        if match['set']:
            options = [p for p in options if p.set_id == match['set'].lower()]
            if match['number']:
                options = [p for p in options if p.collector_number.lower() == match['number'].lower()]
            if not options:
                where = f"{match['set'].upper()} {match['number'] or ''}".strip()
                errors.append(ParseError(number, raw, f'No printing of "{name}" in {where}.'))
                continue
        with_finish = [p for p in options if finish in p.finishes]
        if not with_finish:
            errors.append(ParseError(number, raw, f'No {finish} version of this printing.'))
            continue
        rows.append(ParsedRow(number, quantity, with_finish[0], finish))
    return rows, sorted(errors, key=lambda e: e.line)


def format_row(quantity: int, printing: Printing, finish: str) -> str:
    return f'{quantity} {printing.name} ({printing.set_id.upper()}) {printing.collector_number}{MARKER_FOR[finish]}'


def format_lines(entries, printings: bool = True) -> list[str]:
    """(quantity, printing, finish) -> lines. Without printings only quantity and name
    remain, and lines naming the same card merge (spec 014, AC-3)."""
    if printings:
        return [format_row(q, p, f) for q, p, f in entries]
    merged: dict[str, int] = {}
    for q, p, _ in entries:
        merged[p.name] = merged.get(p.name, 0) + q
    return [f'{q} {name}' for name, q in merged.items()]


def format_rows(items, printings: bool = True) -> tuple[str, int]:
    """Collection rows -> (text, line count), one line per row."""
    lines = format_lines(((i.quantity, i.printing, i.finish) for i in items), printings)
    return '\n'.join(lines) + '\n', len(lines)
