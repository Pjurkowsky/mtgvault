# Tasks 003: Card scanner

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Work top to bottom. Tick a task only when its done check passes. After every
API change, run `scripts/check-api.sh` and commit the regenerated files.

## Phase 1: Catalog and cart backend

- [x] **T1 `illustration_id` and `promo` on Printing**
  - Migration, `scryfall.py` mapping, resync of the dev catalog.
  - Done: the fixture's Sol Ring has its illustration id, and a full dev
    sync fills them.
- [x] **T2 Cart flag and filters** (AC-17, AC-18, AC-21)
  - `in_cart` + unique key, services, filters (`location=cart`), totals,
    public, directory, `owned`, bulk move clears the flag, `cart` totals in
    the locations list.
  - Done: shell checks show cart rows missing from the item list, totals,
    exports and public pages, and present with `location=cart`. A move takes
    them out and merges.

## Phase 2: Scanner backend

- [x] **T3 `scanner` app, settings endpoint** (AC-12, AC-15, AC-16)
- [x] **T4 Bundle install** (AC-23)
  - `bundles.py`, `sync_scanner_bundle` command (`--from-dir`), Celery beat
    task, `SCANNER_DIR`, compose volume.
  - Done: the real newest bundle installs. A copy with one changed byte is
    rejected and leaves `current` untouched.
- [x] **T5 Bundle info and file endpoints** (AC-3, AC-24)
- [x] **T6 Resolve, scan and undo endpoints, locked illustrations** (AC-5 to AC-11, AC-13, AC-14, AC-17)
  - Done: shell checks for the ranking order, merging into the cart, undo to
    zero, threshold flags.
- [x] **T7 `/scan/fast` isolation headers** (AC-16)
  - nginx and a Vite dev plugin.
  - Done: curl shows the headers on `/scan/fast` and not on `/scan`.
- [x] **T8 API types**

## Phase 3: Recognition port

- [ ] **T9 onnxruntime-web and ported recognition files** (AC-25)
- [ ] **T10 Smoke test against the real bundle**
  - A Playwright script loads the worker in a page and identifies the fixture
    Sol Ring image. Done: top candidate is Sol Ring.

## Phase 4: Scanner UI

- [ ] **T11 Camera and frame loop** (AC-2, AC-4, AC-5, AC-6, AC-7, AC-8)
- [ ] **T12 Scan page, status, download progress** (AC-1, AC-3, AC-7)
- [ ] **T13 Result bar** (AC-11)
- [ ] **T14 Sounds and running total** (AC-13, AC-14)
- [ ] **T15 Settings sheet and Fast scanning switch** (AC-12, AC-15, AC-16)

## Phase 5: Cart UI

- [ ] **T16 Cart tile and cart page** (AC-19, AC-20, AC-22)
- [ ] **T17 Move from cart, edit without location** (AC-20, AC-21)

## Phase 6: Tests

- [ ] **T18 `cart.spec.ts`** (AC-17 to AC-22)
- [ ] **T19 `scanner-settings.spec.ts`** (AC-12, AC-15, AC-16)
- [ ] **T20 Scanner project with fake camera, `scanner.spec.ts`** (AC-1 to AC-11, AC-13, AC-14)
- [ ] **T21 Full suite and spec 001/002 regressions**

## Phase 7: Wrap up

- [ ] **T22 Real-device check** (if a phone is available) and live bundle update check
- [ ] **T23 READMEs (MPL credits, scanner setup), spec status**
