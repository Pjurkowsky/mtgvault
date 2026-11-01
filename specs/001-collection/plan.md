# Plan 001: Collection

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| Daily sync | Celery worker + Celery beat + Redis. Beat triggers `cards.tasks.sync_cards` daily; `manage.py sync_cards` runs the same code by hand. |
| Card data | Scryfall `default_cards` bulk file (gzipped JSON Lines, ~81 MB), streamed line by line. |
| Images | Scryfall's CDN (`cards.scryfall.io`). We store URLs only. |
| Exchange rates | NBP table A: EUR→PLN and USD→PLN. USD↔EUR goes through PLN. |
| Navigation | One Collection page with tabs: Locations (`/`) and All cards (`/cards`). Each tab has its own URL. |
| Tests | Playwright end-to-end, one file per area, against a small committed card fixture and fixed rates (no network). |

### Not in the catalog

The sync skips printings nobody can own in paper or that later specs cover:
digital-only cards (`digital: true`), tokens, emblems and art cards
(`layout` in `token`, `double_faced_token`, `emblem`, `art_series`).

## Backend

Two new apps: `cards` (the read-only catalog) and `collection` (what users own).

### `cards` models

```
Set            code (pk), name, released_at, set_type
Printing       id (uuid, Scryfall id, pk)
               oracle_id (uuid, index)        groups printings of one card
               name                           "Delver of Secrets // Insectile Aberration"
               front_name                     "Delver of Secrets"
               set → Set, collector_number, lang, released_at
               rarity (common/uncommon/rare/mythic/special/bonus)
               colors (array of W/U/B/R/G), types (array: Creature, Land, …)
               type_line, mana_cost, cmc
               finishes (array of nonfoil/foil/etched)
               image_small, image_normal, image_large (front face URLs)
               usd, usd_foil, usd_etched, eur, eur_foil, eur_etched (decimal, null)
ExchangeRate   currency (EUR/USD), rate_to_pln, effective_date
SyncRun        kind (cards/rates), started_at, finished_at, status, rows, error
```

Indexes: trigram GIN index on `name` and `front_name` (enable `pg_trgm` in a
migration) for name search, plus `oracle_id`, `set`, `released_at`.

`types` comes from the front face's type line, split on the `—`: the words
before it that are card types. `colors` comes from the front face for
double-faced cards.

### Sync (`cards/sync.py`)

1. Fetch `https://api.scryfall.com/bulk-data/default-cards` with the
   `User-Agent` and `Accept` headers Scryfall requires. Download the
   `jsonl_download_uri` to a temp file.
2. Read the gzip line by line. Skip excluded printings. Upsert sets, then
   printings in batches of 2,000 with `bulk_create(update_conflicts=True)`.
3. Fetch NBP rates for EUR and USD (`/api/exchangerates/rates/a/{code}/`) and
   store them.
4. Record a `SyncRun` per kind. On any error the run is marked failed and the
   previous data stays in place (AC-6). Printings are never deleted, because
   collection rows point at them.

`manage.py sync_cards` options for tests and offline use:
`--file <jsonl or jsonl.gz>` instead of downloading, and
`--eur-pln <rate> --usd-pln <rate>` instead of calling NBP.

### Celery

- `config/celery.py`: app reads `CELERY_*` settings. Broker and result
  backend come from `REDIS_URL`.
- Beat schedule: `sync_cards` daily at 13:00 UTC. NBP publishes around
  noon Warsaw time, and Scryfall refreshes prices daily.
- Compose (dev and prod): new services `redis` (redis:8), `worker`
  (`celery -A config worker`) and `beat` (`celery -A config beat`), both on the
  backend image.

### Prices (`cards/pricing.py`)

- `price(printing, finish, currency)`: USD and EUR come straight from the
  printing's matching column. PLN = EUR × latest EUR rate. Missing → `None`.
- `price_expression(currency)`: the same rule as a database expression
  (`Case` on finish × currency). It powers price sorting, price filters, and
  location totals in SQL.
- `convert(amount, from, to)`: through PLN with the latest rates. Used for
  purchase prices (AC-18) and merging rows in different currencies (AC-20).
- Every API response with prices includes `currency` and
  `prices_updated_at` (the last successful card sync, AC-6).

### `collection` models

```
Location         user → User, name, kind (binder/box/deck_box),
                 is_public (default False), created_at
                 unique (user, Lower(name))                       AC-7, AC-8
CollectionItem   user → User, printing → Printing (PROTECT)
                 location → Location (null = Unfiled)
                 quantity (1–999, check constraint)                AC-14
                 finish, condition (NM/LP/MP/HP/DMG), language
                 purchase_price (decimal, null), purchase_currency (null)
                 added_usd, added_eur, added_pln (decimal, null)
                 added_at
                 unique (user, printing, finish, condition, language, location)
                   with nulls_distinct=False, so Unfiled rows merge too  AC-19
                 check: finish is one of the printing's finishes
                   (enforced in the service, since it spans two tables)
```

Indexes: `(user, location)`, `(user, added_at)`.

### Merge service (`collection/services.py`)

One function handles every write that can create a duplicate:
`save_item(user, *, printing, finish, condition, language, location, quantity, purchase)`.

- No matching row: create it and snapshot `added_usd/eur/pln` (AC-14).
- Matching row: add quantities, keep the older `added_at` and snapshots, and
  set purchase price to the quantity-weighted average. A row with no purchase
  price is left out of the average. A price in another currency is converted
  into the existing row's currency first (AC-19, AC-20).

`move`, `edit` (single and bulk) and `import` all go through it, inside
`transaction.atomic()`.

### Shared filter (`collection/filters.py`)

One serializer validates the browser's query: `q`, `color`, `type`,
`rarity`, `set`, `finish`, `condition`, `price_min`, `price_max`, `sort`,
`dir`, `location`. `apply_filters(queryset, params, currency)` turns it into
SQL. The item list, bulk actions, export and public pages all use it, so a
filter works the same everywhere (P-2).

### Text lists (`collection/textlist.py`)

- `parse(text)` → recognized lines and errors with line numbers (AC-46, AC-48).
  Pattern: `[qty[x]] name [(SET) [number]] [*F*|*E*]`. Names match `name` or
  `front_name`, ignoring case. Without set and number, the newest printing wins.
- `format(rows)` → the same format, one line per row (AC-52).
- Import never trusts the preview: commit parses the text again, then saves
  everything in one transaction (AC-49).

### Endpoints

Owner endpoints need login and only ever touch the requesting user's data.

| Method | Path | Purpose | ACs |
| --- | --- | --- | --- |
| GET | `/api/catalog/cards/?q=` | Card names matching `q` (min 2 chars), one entry per card | 21 |
| GET | `/api/catalog/cards/{oracle_id}/printings/` | Printings, newest first, with finishes and prices | 22, 27 |
| GET | `/api/catalog/sets/?q=` | Sets for the set filter | 31 |
| GET | `/api/catalog/status/` | `prices_updated_at` | 6 |
| GET, POST | `/api/locations/` | List (plus Unfiled, with count and value) / create | 7–10 |
| GET, PATCH | `/api/locations/{id}/` | Detail with totals / rename, kind, visibility | 10, 13 |
| POST | `/api/locations/{id}/delete/` | `{cards: move \| unfile \| delete, target}` | 11 |
| GET, POST | `/api/items/` | Filtered page (`offset`, `limit`) with `count` and `total_quantity` / add | 14–25, 29–37 |
| GET, PATCH, DELETE | `/api/items/{id}/` | Detail / edit (merges) / delete | 26–28 |
| POST | `/api/items/bulk/` | `{action, selection, params, dry_run}` | 38–44 |
| POST | `/api/items/export/` | `{selection}` or current filters → text | 51–53 |
| POST | `/api/imports/preview/`, `/api/imports/commit/` | `{text, location, defaults}` | 45–50 |
| GET | `/api/users/?q=` | Directory: users with a public location | 54 |
| GET | `/api/users/{username}/locations/` | Public locations with count and value | 55, 60 |
| GET | `/api/users/{username}/locations/{id}/items/` | Read-only items, same filters | 56–59 |

**Selection** (bulk and export): either `{ids: [...]}` or
`{filter: {...}, exclude_ids: [...]}`. "Select all" sends the filter that was
active when the user pressed it, so it covers rows that never loaded
(AC-39, AC-40). `dry_run: true` returns the row and card counts for the
confirm step (AC-41) without changing anything.

**Privacy:** public endpoints use separate serializers with no purchase or
added-price fields (AC-57). A private or missing location returns the same 404
(AC-59).

## Frontend

### Routes

| Path | Page | Access |
| --- | --- | --- |
| `/` | CollectionPage, Locations tab | login |
| `/cards` | CollectionPage, All cards tab | login |
| `/locations/:id` (`unfiled` allowed) | LocationPage | login |
| `/users` | DirectoryPage | anyone |
| `/u/:username` | ProfilePage, now listing public locations | anyone |
| `/u/:username/locations/:id` | PublicLocationPage | anyone |

The top bar gets a "Users" link. Spec 000's AC-6 test expects a "Collection"
heading on `/`; it changes to check the tabs.

### Components

```
components/collection/
  LocationGrid.vue          location cards: name, kind icon, visibility, count, value
  LocationDialog.vue        create/edit: name, kind, visibility
  DeleteLocationDialog.vue  move / unfile / delete choice with counts
  AddCardDialog.vue         search → printings → details → Add (stays open)
  CardDetailDialog.vue      large image, fields, edit, change printing, delete
  ImportDialog.vue          paste/upload → defaults → preview → confirm
  ExportDialog.vue          text + copy + download
components/browser/         the shared card browser (P-2)
  CardBrowser.vue           toolbar + chips + results + selection bar
  BrowserToolbar.vue        search, filters, sort, view toggle, Select, Export
  FilterPopover.vue         color, type, rarity, set, finish, condition, price
  FilterChips.vue           removable chips + Clear all
  CardGrid.vue, CardTable.vue
  SelectionBar.vue          N selected, Select all, Clear, bulk actions
  BulkDialogs.vue           move / edit / delete confirm with counts
composables/
  useBrowserQuery.ts        filters ⇄ URL query (AC-34)
  useInfiniteItems.ts       paged loading on scroll (AC-35)
  useSelection.ts           ids or filter + exclusions (AC-39, AC-40)
  useMoney.ts               format in the user's currency; PLN marked ≈ (AC-3, AC-4)
```

Text-list parsing stays on the server only, so import and export follow one set of rules.

`CardBrowser` takes a data source (`own` or `public(username, locationId)`), an
optional fixed location, and `readonly`. Read-only mode hides selection, bulk,
add, edit and delete (AC-56).

New shadcn-vue components: `tabs`, `dialog`, `alert-dialog`, `table`, `badge`,
`popover`, `command`, `checkbox`, `toggle-group`, `textarea`, `skeleton`,
`radio-group`, `separator`.

## End-to-end tests

### Test data

- `backend/cards/fixtures/scryfall-sample.jsonl`: about 60 real printings
  saved from Scryfall once. It includes several printings of one card, a
  double-faced card, an etched-only printing, a card with no EUR price,
  multicolor and colorless cards, and every rarity.
- Playwright's Django command loads it first:
  `sync_cards --file cards/fixtures/scryfall-sample.jsonl --eur-pln 4.40 --usd-pln 4.00`.
  Expected prices in tests follow from these fixed numbers.
- `manage.py seed_items --username <u> --rows <n>` creates many rows quickly
  for the performance tests. It refuses to run when `DEBUG` is off.

### AC coverage

| Test file | Covers |
| --- | --- |
| `catalog.spec.ts` | AC-1 to AC-6: search, printings, prices per currency, PLN estimate mark, "–", last updated |
| `locations.spec.ts` | AC-7 to AC-13 |
| `add-card.spec.ts` | AC-14 to AC-25, including both merge rules |
| `card-detail.spec.ts` | AC-26 to AC-28 |
| `browser.spec.ts` | AC-29 to AC-35, AC-37, run on All cards and on a location |
| `bulk.spec.ts` | AC-38 to AC-44 |
| `import-export.spec.ts` | AC-45 to AC-49, AC-51 to AC-53 |
| `public.spec.ts` | AC-54 to AC-60 |
| `performance.spec.ts` | AC-36 (20,000 rows under 1 s), AC-50 (5,000-line import) |

### Gaps

- The real Scryfall download and NBP call don't run in tests. A wrap-up task
  runs `sync_cards` against the live services once and checks the counts.
- "Refreshes daily" (AC-1) relies on the beat schedule and a code review.

## Order of work

1. **Catalog:** `cards` app, models, sync, fixture, `sync_cards`, Celery,
   Redis and compose services.
2. **Collection backend:** models, merge service, filters, prices, text lists,
   all endpoints, `seed_items`, regenerated API types.
3. **Locations and adding cards:** tabs, location grid and dialogs, add card,
   card detail. Tests: locations, add-card, card-detail, catalog.
4. **Card browser and bulk:** the shared browser on All cards and location
   pages. Tests: browser, bulk.
5. **Import and export.** Tests: import-export.
6. **Public pages:** directory, profile locations, public location page.
   Tests: public.
7. **Wrap up:** performance tests, live sync check, READMEs, spec status.

`tasks.md` breaks these steps into small tasks.
