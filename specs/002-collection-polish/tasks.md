# Tasks 002: Collection polish

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Work top to bottom. Each task lists the ACs it serves and a done check. Tick a
task only when its done check passes. After every API change, run
`scripts/check-api.sh` and commit the regenerated files.

Prerequisite: `docker compose -f docker-compose.dev.yml up -d db redis`.

## Phase 1: Backend

- [x] **T1 Prices in all three currencies** (AC-1 to AC-3)
  - `MoneySerializer` (`USD`, `EUR`, `PLN`).
  - Items: `unit_prices`, `added_prices`, `purchase_prices`. Printings:
    `prices_all`. Pages: `total_values`. Locations and totals: `values`.
  - Public serializers get `unit_prices` and `values` only.
  - Done: test-client checks with fixed rates. Sol Ring gives
    `{USD: 1.84, EUR: 0.91, PLN: 4.00}`, a missing EUR price gives null in
    EUR and PLN, page and location totals match the per-currency sums, and
    public responses still have no `purchase` or `added` keys.

- [x] **T2 Card detail endpoint and public catalog** (AC-25, AC-26, AC-33, AC-34, AC-37)
  - `GET /api/catalog/cards/{oracle_id}/`: name, printings newest first,
    `owned` for the viewer.
  - Catalog read endpoints allow anonymous visitors (USD prices).
  - Done: test-client checks. `owned` sums the viewer's rows across
    printings, is 0 for another user and 0 when logged out, and anonymous
    calls get 200 with USD prices.

- [x] **T3 EDHREC proxy** (AC-28 to AC-31, AC-35, AC-36)
  - `cards/edhrec.py`: slug, fetch (403/404 = no page), convert, match names
    to the catalog, Redis cache (24 h, "no page" 1 h, errors uncached).
  - `GET /api/catalog/cards/{oracle_id}/edhrec/`.
  - `EDHREC_FIXTURE_DIR` setting and a trimmed
    `cards/fixtures/edhrec/sol-ring.json`.
  - Done: shell checks. Slugs come out right for Sol Ring, "Jace, the Mind
    Sculptor" and Delver of Secrets (front face). With the fixture dir, Sol
    Ring returns commanders with shares, typed groups sorted by synergy, and
    similar cards with matched `oracle_id`s where we have them. A card with
    no fixture returns `available: false`. A second call is served from the
    cache.

- [x] **T4 API types**
  - Regenerate `openapi.yaml` and `schema.d.ts`.
  - Done: `scripts/check-api.sh` passes and `pnpm build` passes.

## Phase 2: Shared UI

- [x] **T5 shadcn components and mana symbols**
  - Add `context-menu` and `hover-card`.
  - Copy Scryfall's W, U, B, R, G and C SVGs into `src/assets/mana/`.
  - Done: `pnpm build` passes and the six files open as images.

- [x] **T6 Price, toasts and confirm dialog** (AC-1 to AC-5)
  - `Price.vue`, and no "≈" in `formatMoney`.
  - `<Toaster rich-colors>`.
  - `ConfirmDialog.vue` and `useConfirm()`, mounted once in `App.vue`.
  - Every price in the app uses `<Price>`.
  - Every delete uses `useConfirm`: card detail, bulk delete and location
    delete (the location dialog keeps its card choices, inside the same
    confirm style).
  - Done: `pnpm build` passes, and a screenshot shows a price tooltip and a
    green toast.

- [x] **T7 IconButton, CardPreview, ManaSymbol, usePreference** (AC-6, AC-9, AC-20)
  - Replace every icon-only button with `IconButton`.
  - Done: `pnpm build` passes, and grep finds no `size="icon"` button
    without a tooltip.

## Phase 3: Add card

- [x] **T8 Result views and sizes** (AC-7 to AC-9)
- [x] **T9 Finish and location toggles** (AC-10, AC-11)

Done for T8 and T9: by hand, with 3 and with 8 locations.

## Phase 4: Card browser

- [x] **T10 Selection without a mode** (AC-12 to AC-15)
  - `useSelection` without `active`. Grid and table checkboxes, the Select
    all checkbox in the toolbar, and the bulk bar shown while
    `count > 0`.
- [x] **T11 Tiles and click rules** (AC-16, AC-17)
- [x] **T12 Context menu and EditItemDialog** (AC-18, AC-38)
- [x] **T13 Toolbar: More menu, tooltips, summary** (AC-19, AC-22, AC-23)
- [x] **T14 Filters: mana symbols, Clear, no chips** (AC-20, AC-21)

Done for T10 to T14: by hand on All cards, a location page and a public
location page.

## Phase 5: Card detail

- [x] **T15 New layout and copies block** (AC-24, AC-25, AC-37)
- [x] **T16 Reprints strip with switch** (AC-26, AC-27)
- [x] **T17 EDHREC tabs and card stack** (AC-28 to AC-34, AC-36)

Done for T15 to T17: by hand with Sol Ring (fixture data) and a card with
no EDHREC data.

## Phase 6: Tests

- [x] **T18 Playwright setup**
  - Set `EDHREC_FIXTURE_DIR` for the Django web server.
  - Update the helpers for the More menu and checkbox selection.
- [x] **T19 Update spec 001 tests** that spec 002 replaced: `browser`,
  `bulk`, `catalog`, `card-detail`, `add-card`, `import-export`, `public`.
- [x] **T20 `polish-global.spec.ts`** (AC-1 to AC-6)
- [x] **T21 `polish-add-card.spec.ts`** (AC-7 to AC-11)
- [x] **T22 `polish-browser.spec.ts`** (AC-12 to AC-23)
- [x] **T23 `card-detail.spec.ts` rewrite** (AC-24 to AC-38)

Done for T18 to T23: `pnpm e2e` passes (specs 000, 001 and 002), and the
non-timing tests pass twice in a row.

## Phase 7: Wrap up

- [x] **T24 Live EDHREC check** (AC-35)
  - On the dev stack, open Sol Ring and a double-faced card. Note which
    tabs filled and how long the first and the cached call took.
  - Result (2026-11-02): Sol Ring and Delver of Secrets both filled all three
    tabs (24 commanders, 10 groups, 6 similar). First call ~250 ms, cached
    under 1 ms. Every card on five pages matched our catalog after partner
    pairs ("Frodo, Adventurous Hobbit // Sam, Loyal Attendant") started
    matching by their first card.
- [ ] **T25 Verify and close the spec**
  - `pnpm e2e` and `scripts/check-api.sh` pass, and the Docker images build.
  - Update READMEs (EDHREC proxy, `EDHREC_FIXTURE_DIR`).
  - Set spec status to "Done".
