# Tasks 006: Deck views

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Tick a task only when its done check passes. Run `scripts/check-api.sh`
after API changes.

## Phase 1: Data and API

- [x] **T1 `Printing.produced_mana` and its sync mapping; `DeckCard.categories`** (AC-12, AC-16)
- [x] **T2 Deck card serializer fields, categories PATCH, categories endpoint, API types** (AC-6, AC-12, AC-13)
- [x] **T3 `#Tag` categories in deck import and export** (AC-15)

Done for T1-T3: a `sync_cards --file` run fills `produced_mana`; shell checks
for the PATCH rules (trim, duplicates, limit), suggestions order, and an
export → import round trip keeping categories.

## Phase 2: Shared pieces

- [x] **T4 `CardTile` extracted from `CardGrid`** (AC-1)
- [x] **T5 Filter pieces extracted; collection `FilterPopover` rebuilt on them** (AC-6)

Done for T4-T5: the collection browser and filter specs pass unchanged.

## Phase 3: Deck tab

- [ ] **T6 `lib/deckFilter.ts`, `DeckToolbar` with search, `DeckFilterPopover`, filters in the URL** (AC-5 to AC-7)
- [ ] **T7 Owned and Missing tabs removed; Export missing in the ⋯ menu; want list item in the card menu** (AC-8)
- [ ] **T8 Keyboard: `/`, Escape, arrows, Enter; InfoTip** (AC-9)

## Phase 4: Views

- [ ] **T9 Images view from `CardTile` with sizes; size remembered** (AC-1)
- [ ] **T10 Hover preview in List rows, `CardTable`, browser lists, Swaps; side image removed** (AC-2)
- [ ] **T11 `GroupHeading` with values in every view; outlined destructive buttons** (AC-3, AC-4)

## Phase 5: Swaps, categories, stats

- [ ] **T12 Swaps table of pairs with labelled diffs, collapsible groups remembered** (AC-10, AC-11)
- [ ] **T13 `CategoryInput` in the deck section and the card menu; By category grouping; category filter** (AC-12 to AC-14)
- [ ] **T14 `lib/deckStats.ts` and the new Stats tab; chart clicks set the filter** (AC-16 to AC-18)

## Phase 6: Tests and wrap up

- [ ] **T15 e2e: deck-visual, deck-filters, deck-swaps, deck-categories, deck-stats; update older tests**
- [ ] **T16 Full suite, Docker build, READMEs, spec status**
