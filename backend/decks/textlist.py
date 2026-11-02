"""Decklists as text (spec 004, AC-25, AC-27): Moxfield, Archidekt, MTGO/Arena."""

import re

from collection import textlist

HEADINGS = {
    'commander': 'commander', 'commanders': 'commander',
    'deck': 'main', 'main': 'main', 'mainboard': 'main', 'main deck': 'main',
    'sideboard': 'side', 'side': 'side', 'side board': 'side',
    'maybeboard': 'maybe', 'maybe': 'maybe', 'considering': 'maybe',
}
HEADING = re.compile(r'^\s*(?://\s*)?([A-Za-z ]+?)\s*(?:\(\d+\))?\s*:?\s*$')
SB_PREFIX = re.compile(r'^\s*SB:\s*', re.I)
LABELS = {'commander': 'Commander', 'main': 'Deck', 'side': 'Sideboard', 'maybe': 'Maybeboard'}


def parse(text: str):
    """(rows with zones, errors). Lines before any heading are Mainboard."""
    zone = 'main'
    numbered = []
    for number, raw in enumerate(text.splitlines(), start=1):
        heading = HEADING.match(raw)
        if heading and heading.group(1).strip().lower() in HEADINGS:
            zone = HEADINGS[heading.group(1).strip().lower()]
            continue
        line_zone = 'side' if SB_PREFIX.match(raw) else zone
        numbered.append((number, line_zone, SB_PREFIX.sub('', raw)))
    rows_out, errors_out = [], []
    # Parse all lines in one pass (one catalog query) keeping original line numbers.
    padded = '\n'.join(line for _, _, line in numbered)
    rows, errors = textlist.parse(padded)
    mapping = {i + 1: (number, line_zone) for i, (number, line_zone, _) in enumerate(numbered)}
    for row in rows:
        number, line_zone = mapping[row.line]
        row.line = number
        rows_out.append((line_zone, row))
    for error in errors:
        if error.line in mapping:
            error.line = mapping[error.line][0]
        errors_out.append(error)
    return rows_out, errors_out


def format_deck(cards) -> str:
    """Text with zone headings, one line per card: `1 Sol Ring (C21) 263`."""
    blocks = []
    for zone in ('commander', 'main', 'side', 'maybe'):
        lines = [
            f'{c.quantity} {c.printing.name} ({c.printing.set_id.upper()}) {c.printing.collector_number}'
            for c in sorted((c for c in cards if c.zone == zone), key=lambda c: c.printing.name)
        ]
        if lines:
            blocks.append(LABELS[zone] + '\n' + '\n'.join(lines))
    return '\n\n'.join(blocks) + '\n'
