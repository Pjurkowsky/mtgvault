# Tasks 001: Collection

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Work top to bottom. Each task lists the ACs it serves and a done check. Tick a
task only when its done check passes. After every API change, run
`scripts/check-api.sh` and commit the regenerated files.

Prerequisite: `docker compose -f docker-compose.dev.yml up -d db redis`.

## Phase 1: Catalog

- [x] **T1 `cards` app and models** (AC-1, AC-2)
  - `Set`, `Printing`, `ExchangeRate`, `SyncRun` as in the plan.
  - Migration enables `pg_trgm` and adds trigram indexes on `name` and
    `front_name`.
  - Done: `migrate` succeeds on Postgres.

- [x] **T2 Scryfall card mapping** (AC-1, AC-2)
  - `cards/scryfall.py`: turn one Scryfall JSON object into `Set` and
    `Printing` fields: front face name and image for double-faced cards,
    `types` from the type line, prices as decimals, and the skip rule for
    digital cards, tokens, emblems and art cards.
  - Done: a shell check maps a normal card, a double-faced card and an
    etched-only card correctly, and skips a token.

- [x] **T3 Card fixture**
  - `backend/cards/fixtures/scryfall-sample.jsonl`: about 60 printings saved
    from Scryfall. It needs several printings of one card, a double-faced
    card, an etched-only printing, a printing with no EUR price, multicolor
    and colorless cards, all rarities, and at least one token (to prove the
    skip).
  - `backend/cards/fixtures/README.md` lists what each card is there to test.
  - Done: the file has one valid JSON object per line.

- [x] **T4 Sync service and command** (AC-1, AC-3, AC-6)
  - `cards/sync.py`: download (or read `--file`), stream lines, batch upsert,
    fetch NBP EUR and USD rates (or take `--eur-pln`/`--usd-pln`), and record
    a `SyncRun` per kind. A failure keeps the previous data.
  - `manage.py sync_cards`.
  - Done: syncing the fixture twice gives the same counts. A broken line in a
    copy of the fixture marks the run failed and leaves earlier printings
    untouched.

- [x] **T5 Celery, Redis and compose services** (AC-1)
  - `config/celery.py`, `cards/tasks.py` with `sync_cards`, and a beat schedule
    for 13:00 UTC daily.
  - Add `REDIS_URL` to settings and both `.env.example` files.
  - `redis`, `worker` and `beat` services in both compose files.
  - Done: with the dev stack up, `celery call cards.tasks.sync_cards` (pointed
    at the fixture) finishes in the worker, and `beat` logs its schedule.

- [x] **T6 Prices** (AC-2 to AC-5)
  - `cards/pricing.py`: `price`, `price_expression`, `convert`.
  - Done: a shell check with fixed rates gives the expected USD, EUR and PLN
    prices for nonfoil, foil and etched, `None` for missing EUR etched, and
    `price_expression` agrees with `price` on every fixture printing.

- [x] **T7 Catalog endpoints** (AC-6, AC-21, AC-22, AC-31)
  - `/api/catalog/cards/`, `/api/catalog/cards/{oracle_id}/printings/`,
    `/api/catalog/sets/`, `/api/catalog/status/`.
  - Done: searching "bolt" returns Lightning Bolt once. Its printings come
    newest first with prices in the user's currency. Status shows the last
    successful sync.

## Phase 2: Collection backend

- [x] **T8 `collection` app and models** (AC-7, AC-8, AC-14, AC-16, AC-17, AC-19)
  - `Location` and `CollectionItem` with the constraints from the plan,
    including the unique row rule with `nulls_distinct=False`.
  - Done: `migrate` succeeds. A shell check shows that a second Unfiled row
    with the same printing, finish, condition and language is rejected.

- [x] **T9 Merge service** (AC-14, AC-15, AC-19, AC-20)
  - `collection/services.py`: `save_item`, plus `move_item` and `edit_item`
    built on it.
  - Done: shell checks cover a new row with price snapshots, a merge with a
    weighted average, a merge where one side has no purchase price, a merge
    across currencies, and a rejected finish the printing lacks.

- [x] **T10 Shared filter** (AC-30 to AC-33)
  - `collection/filters.py`: the filter serializer and `apply_filters`.
  - Done: a shell check on fixture-based rows gives the right result for
    each filter, for a combination, and for every sort in both directions.

- [x] **T11 Location endpoints** (AC-7 to AC-13)
  - List (with Unfiled), create, detail, update, and delete with
    move/unfile/delete.
  - Done: test-client checks for each, including a duplicate name in another
    letter case, Unfiled being read-only, and correct counts and values.

- [x] **T12 Item endpoints** (AC-14 to AC-28, AC-35, AC-37)
  - List with filters, `offset`/`limit`, `count` and `total_quantity`; add;
    detail; edit (including printing change); delete.
  - Done: test-client checks for add (new and merge), edit merge, and a
    paginated list with totals.

- [x] **T13 Bulk endpoint** (AC-39 to AC-43)
  - `/api/items/bulk/` with both selection forms and `dry_run`.
  - Done: test-client checks for move, edit (with skipped finishes), delete,
    and select-all with exclusions.

- [x] **T14 Text lists, import and export** (AC-45 to AC-53)
  - `collection/textlist.py`, `/api/imports/preview/`, `/api/imports/commit/`,
    `/api/items/export/`.
  - Done: shell checks parse every line shape from AC-46, report bad lines with
    line numbers, and round-trip an export through import.

- [x] **T15 Public endpoints** (AC-54 to AC-60)
  - Directory, a user's public locations, public items, with serializers that
    have no purchase or added-price fields.
  - Done: test-client checks that a private location returns the same 404 as
    a missing one, and that public responses contain no `purchase_` or
    `added_` keys.

- [x] **T16 `seed_items` command and API types**
  - `manage.py seed_items --username --rows`, refusing when `DEBUG` is off.
  - Regenerate `openapi.yaml` and `schema.d.ts`.
  - Done: seeding 20,000 rows works, and `scripts/check-api.sh` passes.

## Phase 3: Locations and adding cards

- [ ] **T17 shadcn components and money formatting** (AC-3, AC-4)
  - Add the components listed in the plan. `useMoney` formats in the user's
    currency, marks PLN with ≈ and an `InfoTip`, and shows "–" for missing.
  - Done: `pnpm build` passes.

- [ ] **T18 Collection page with tabs and locations** (AC-7 to AC-12)
  - Routes `/` and `/cards`, tabs, "Users" link in the top bar.
  - `LocationGrid`, `LocationDialog`, `DeleteLocationDialog`.
  - Update spec 000's AC-6 test for the tabs.
- [ ] **T19 Location page** (AC-13)
  - `/locations/:id` and `/locations/unfiled` with name, kind and totals. Cards
    show in a simple grid until phase 4 replaces it with the card browser.
- [ ] **T20 Add card dialog** (AC-21 to AC-25)
- [ ] **T21 Card detail dialog** (AC-26 to AC-28)
- [ ] **T22 Playwright fixture setup**
  - The Django web server command runs `sync_cards` on the fixture with fixed
    rates first. Helpers for creating locations and adding cards through the API.
- [ ] **T23 Tests: `catalog`, `locations`, `add-card`, `card-detail`**
  (AC-1 to AC-28)

Done for T18 to T23: `pnpm e2e` passes.

## Phase 4: Card browser and bulk actions

- [ ] **T24 `CardBrowser` with grid, table and infinite loading** (AC-29, AC-35, AC-37)
- [ ] **T25 Search, filters, chips and sort** (AC-30 to AC-33)
- [ ] **T26 URL state** (AC-34)
- [ ] **T27 Selection and bulk actions** (AC-38 to AC-44)
- [ ] **T28 Use the browser on All cards and location pages** (AC-13, AC-37, AC-44)
- [ ] **T29 Tests: `browser`, `bulk`** (AC-29 to AC-35, AC-37 to AC-44)

Done for T24 to T29: `pnpm e2e` passes.

## Phase 5: Import and export

- [ ] **T30 Import dialog** (AC-45 to AC-50)
- [ ] **T31 Export dialog and bulk export** (AC-41, AC-51 to AC-53)
- [ ] **T32 Tests: `import-export`** (AC-45 to AC-49, AC-51 to AC-53)

Done for T30 to T32: `pnpm e2e` passes.

## Phase 6: Public pages

- [ ] **T33 Directory page** (AC-54)
- [ ] **T34 Profile locations and public location page** (AC-55 to AC-60)
  - The card browser in read-only mode.
- [ ] **T35 Tests: `public`** (AC-54 to AC-60)

Done for T33 to T35: `pnpm e2e` passes.

## Phase 7: Wrap up

- [ ] **T36 Performance tests** (AC-36, AC-50)
  - `performance.spec.ts`: 20,000 seeded rows show first results within 1 s
    of changing search, filter or sort. A 5,000-line import completes.
- [ ] **T37 Live sync check** (AC-1, AC-3)
  - Run `sync_cards` against Scryfall and NBP once on the dev database. Record
    printing count, duration and rates in this task.
- [ ] **T38 Verify and close the spec**
  - `pnpm e2e` (spec 000 and 001 tests) and `scripts/check-api.sh` pass, and
    the dev and prod Docker images build.
  - Update READMEs (sync command, Celery services, new endpoints).
  - Set spec status to "Done".
