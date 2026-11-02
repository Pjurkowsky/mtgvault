# Tasks 004: Decks

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Tick a task only when its done check passes. Run `scripts/check-api.sh`
after API changes.

## Phase 1: Data

- [x] **T1 Rules fields on Printing** (legalities, color identity, keywords, oracle text) + resync
- [x] **T2 Deck and DeckCard models, data migration for existing deck boxes** (AC-4)
- [x] **T3 Location ↔ deck sync** (AC-4)

## Phase 2: Rules

- [x] **T4 Ownership** (AC-13, AC-14)
- [x] **T5 Legality and commander pairing** (AC-12, AC-22, AC-23)
- [x] **T6 Stats** (AC-24)
- [x] **T7 Deck text lists** (AC-25, AC-27)

Done for T4-T7: shell checks against the real catalog.

## Phase 3: API

- [x] **T8 Deck endpoints: list, create, detail, edit, delete, cards, own, box** (AC-1 to AC-21)
- [x] **T9 Import, export, add from collection, missing, items `deck` filter** (AC-10, AC-16, AC-17, AC-25 to AC-27)
- [x] **T10 Public decks, directory, API types** (AC-28)

## Phase 4: Frontend

- [x] **T11 Mana symbols and ManaCost**
- [x] **T12 Decks page, New deck, Import deck** (AC-1 to AC-3, AC-26)
- [x] **T13 Deck page: header, list/visual, grouping, hover image** (AC-18, AC-19, AC-21)
- [x] **T14 Card dialog, add dialog, mark owned, create box, delete** (AC-5, AC-6, AC-10, AC-11, AC-15, AC-20)
- [x] **T15 Owned/Missing tabs, Stats, legality panel, export** (AC-16, AC-17, AC-22, AC-24, AC-27)
- [x] **T16 Add to deck from the collection; profile; public deck page** (AC-10, AC-28)

## Phase 5: Tests and wrap up

- [x] **T17 e2e: decks, deck-cards, deck-ownership, deck-legality, deck-import**
- [ ] **T18 Full suite, Docker build, READMEs, spec status**
