# Plan 030: Products to buy

## Decisions

| Topic | Choice |
|---|---|
| Source | MTGJSON `AllPrintings.json.xz` (each set's `booster`) and `AllDeckFiles.tar.xz` (fixed decks), both streamed: `lzma` plus `ijson` per set, `tarfile` per deck, so memory stays small. |
| Matching | MTGJSON cards carry `identifiers.scryfallId`, mapped onto `Printing.id`. Cards with no `Printing` (digital, missing) are skipped. |
| Models | New `products` app. `Product` (code, kind deck/booster, name, set code and name, released_at, deck type), `ProductCard` (product, printing, copies for decks, chance per pack for boosters, worked out at sync time), `BoosterLayout` (product, weight, slots `{sheet: count}`), `BoosterSheet` (product, name, total_weight, fixed), `SheetCard` (sheet, printing, weight). |
| Codes | Booster: `<set>-<booster key>` (`blb-play`); deck: `<set>-<slugged name>` (`blc-animated-army`). |
| Chance | Per layout, P(none) = Π over slots (1 − w/W)^count, where w is the weight of the wanted printings on that sheet; chance = 1 − Σ layout weight × P(none) / total weight. Computed in Python per request from the sheets of the products touched. |
| Sync | `sync_products` command (`--printings-file`, `--decks-file` for tests) and a weekly Celery beat job, Sunday 06:00. All rows are replaced in one transaction; `SyncRun` kind `products`. |
| API | `GET /api/decks/{id}/products/?cards=&printing=&since=` (same access as the deck) → `{synced, decks, boosters, none}`. `GET /api/products/{code}/` and `GET /api/products/{code}/cards/` (AllowAny; collection filters through `apply_filters(collection=False)`, plus `owned`, `sort=chance`). |
| Dialog | `ProductsDialog.vue` with Tabs and `usePreference` for the three filters; rows expand with `ExpandButton`. |
| Product page | `ProductPage.vue` at `/products/:code`, `CardBrowser` with a new readonly source `{kind: 'product', code}`; tiles and table get optional chance and owned columns. |

## Files

| File | Change |
|---|---|
| `backend/products/` (models, migration, sync, chance, views, serializers, urls, admin) | new app |
| `backend/products/management/commands/sync_products.py` | sync command |
| `backend/products/fixtures/` | cut MTGJSON sample (a booster set and two decks covering fixture printings) |
| `backend/config/settings.py`, `urls.py` | app, beat job, routes |
| `backend/decks/views.py`, `urls.py` | `products/` on a deck |
| `backend/cards/models.py` | `SyncRun.Kind.PRODUCTS` |
| `frontend/src/components/decks/ProductsDialog.vue` | dialog |
| `frontend/src/pages/DeckPage.vue` | ⋯ menu item |
| `frontend/src/pages/ProductPage.vue`, `router` | product page |
| `frontend/src/components/browser/*` | `product` source, chance and owned columns, Owned filter, chance sort |
| `frontend/playwright.config.ts` | sync the products fixture |

## Tests

| Test file | ACs |
|---|---|
| `e2e/products.spec.ts` | AC-1 to AC-12 (one serial file: AC-12 changes server-wide sync state) |

## Order of work

1. Models, sync, fixture, command and beat job.
2. Chance and the deck products API; product and product cards API.
3. Dialog and menu item.
4. Product page and CardBrowser source.
5. Tests, full suite, READMEs, status.
