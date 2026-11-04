# Tasks 005: Deck improvements

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Tick a task only when its done check passes. Run `scripts/check-api.sh`
after API changes.

## Phase 1: Data and rules

- [x] **T1 `DeckCard.swap_for`, swap services** (AC-9, AC-11, AC-12)
- [x] **T2 Shared visibility, box format in `sync_location`, data migration** (AC-18, AC-19)

Done for T1-T2: shell checks (propose, apply and undo, unlink on remove and
on zone change, visibility both ways, format both ways).

## Phase 2: API

- [x] **T3 `can_command` on printings and deck cards** (AC-5)
- [x] **T4 Swap endpoints, deck and location endpoint changes** (AC-9 to AC-11, AC-18, AC-19)
- [x] **T5 Public lists and directory leave out deck boxes; public deck shows its box** (AC-20)
- [x] **T6 Scan target and undo for any logged row, API types** (AC-16, AC-17)

## Phase 3: Shared components

- [x] **T7 `CardSearch` extracted; DeckAddDialog rebuilt from shared pieces; AddCardDialog with a fixed card** (AC-1, AC-2, AC-4)
- [x] **T8 CardDetailDialog by oracle id with the deck section; DeckCardDialog removed** (AC-3, AC-5)
- [x] **T9 `CardMenu` with item props** (AC-7)

## Phase 4: Deck page

- [x] **T10 Text view, three-way switch, menus in every view** (AC-6, AC-7)
- [x] **T11 Display options remembered** (AC-8)
- [x] **T12 Propose swap and the Swaps tab, public read-only** (AC-9 to AC-13)
- [x] **T13 Scan button, ScanTargetDialog, scanner target on ScanPage** (AC-15 to AC-17)
- [x] **T14 Missing tab want list item, Owned tab without scan, location Format, box mark on public decks** (AC-14, AC-18, AC-20)

## Phase 5: Tests and wrap up

- [x] **T15 e2e: deck-add, deck-views, deck-swaps, deck-boxes, scanner-deck; update older tests**
- [x] **T16 Full suite, Docker build, READMEs, spec status**
