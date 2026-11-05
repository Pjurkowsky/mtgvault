# Tasks 007: Binder view

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Tick a task only when its done check passes. Run `scripts/check-api.sh`
after API changes.

## Phase 1: Data and API

- [x] **T1 Binder fields on `Location`, `BinderSection`, `BinderSlot`, migration; `sync_slots` on every row save; merges keep slots** (AC-13)
- [x] **T2 `collection/binder.py`: state, settings with resize, move (swap, share, unplace), order, next free slot** (AC-8, AC-9, AC-15, AC-17, AC-19, AC-20)
- [x] **T3 Binder endpoints (owner and public), items POST with a slot, scan cursor and undo; API types** (AC-14, AC-21 to AC-24)

Done for T1-T3: shell checks against the e2e database for freeing slots
(move out, lower quantity, delete, cart), merges, resize, swap and share,
scan order along rows and down columns, binder full.

## Phase 2: The view

- [x] **T4 `lib/binder.ts`, `BinderView`, `BinderPage`, `BinderSlot`: pages, spreads, arrows and keys, page in the URL** (AC-2 to AC-5)
- [x] **T5 Binder view option only on binders, opening in binder view the first time** (AC-1)
- [x] **T6 `GridPicker`, `BinderSettingsDialog`, page count, sections with filters and hints** (AC-6 to AC-11)

## Phase 3: Placing and moving

- [x] **T7 `UnplacedTray`, empty slot menu, add card to a slot, From Unplaced** (AC-12 to AC-14)
- [x] **T8 `useBinderDrag`: slot and tray drag and drop, edge page turn, long press, swap or share** (AC-15 to AC-17)
- [x] **T9 Card menu Move to slot and Unplace; stacks with +N, hover and order** (AC-18, AC-19)

## Phase 4: Scanner and public

- [x] **T10 Scanner on a binder: Scan button, Scan from here, in-order dialog, result bar slot, undo, binder full** (AC-20 to AC-23)
- [x] **T11 Public binder view read-only** (AC-24)

## Phase 5: Tests and wrap up

- [x] **T12 e2e: binder, binder-settings, binder-placing, scanner-binder**
- [ ] **T13 Full suite, Docker build, READMEs, spec status**
