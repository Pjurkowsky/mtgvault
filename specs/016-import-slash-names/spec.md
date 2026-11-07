# Spec 016: Single-slash card names in imports

Status: Done
Depends on: 001-collection, 004-decks

## Goal

Lists exported with single-slash names import like double-slash ones.

## Acceptance criteria

- **AC-1** Collection and deck imports read `A / B` (a slash with spaces) as
  the two-part card `A // B`, for prepared, split, adventure and double-faced
  cards: `1 Kirol, History Buff / Pack a Punch (SOS) 198` imports Kirol.
- **AC-2** Names with slashes and no spaces stay as written.

## Out of scope

- Other spelling differences (accents, punctuation)
