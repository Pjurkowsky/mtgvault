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
# Categories as tags at the end of a line: `1 Sol Ring #Ramp #Board_wipe` (spec 006, AC-15).
# Moxfield marks global tags with `#!`.
TAGS = re.compile(r'(?:\s+#!?[^\s#]+)+\s*$')
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
        line = SB_PREFIX.sub('', raw)
        tags = TAGS.search(line)
        categories = []
        if tags:
            categories = [t.lstrip('#!').replace('_', ' ') for t in tags.group(0).split()]
            line = line[:tags.start()]
        numbered.append((number, line_zone, line, categories))
    rows_out, errors_out = [], []
    # Parse all lines in one pass (one catalog query) keeping original line numbers.
    padded = '\n'.join(line for _, _, line, _ in numbered)
    rows, errors = textlist.parse(padded)
    mapping = {i + 1: (number, line_zone, categories) for i, (number, line_zone, _, categories) in enumerate(numbered)}
    for row in rows:
        number, line_zone, row.categories = mapping[row.line]
        row.line = number
        rows_out.append((line_zone, row))
    for error in errors:
        if error.line in mapping:
            error.line = mapping[error.line][0]
        errors_out.append(error)
    return rows_out, errors_out


def format_deck(cards, printings: bool = True, categories: bool = True) -> str:
    """Text with zone headings, one line per card: `1 Sol Ring (C21) 263 #Ramp`.
    Without printings: `1 Sol Ring`; without categories: no #tags (spec 014, AC-3, AC-4)."""
    blocks = []
    for zone in ('commander', 'main', 'side', 'maybe'):
        lines = []
        for c in sorted((c for c in cards if c.zone == zone), key=lambda c: c.printing.name):
            line = (f'{c.quantity} {c.printing.name} ({c.printing.set_id.upper()}) {c.printing.collector_number}'
                    if printings else f'{c.quantity} {c.printing.name}')
            if categories:
                line += ''.join(f' #{name.replace(" ", "_")}' for name in c.categories)
            lines.append(line)
        if lines:
            blocks.append(LABELS[zone] + '\n' + '\n'.join(lines))
    return '\n\n'.join(blocks) + '\n'
