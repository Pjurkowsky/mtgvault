# MTG Vault — backend

Django 6.1 + Django REST Framework + PostgreSQL 18 + Celery/Redis, managed with [uv](https://docs.astral.sh/uv/).

| App | What it holds |
| --- | --- |
| `users` | Accounts, login, currency (spec 000) |
| `cards` | Card catalog synced from Scryfall, NBP exchange rates, price rules |
| `collection` | Locations and owned cards, merge rule, filters, import/export, public pages (spec 001) |

## Setup

The easiest way is Docker from the project root — see the [main README](../README.md).

To run Django directly on your machine (Postgres from the dev compose file):

```bash
cp .env.example .env          # then set a real SECRET_KEY
docker compose -f ../docker-compose.dev.yml up -d db redis
uv sync
uv run manage.py migrate
uv run manage.py sync_cards        # card catalog + rates (about 30 s)
uv run manage.py createsuperuser
uv run manage.py runserver    # http://localhost:8000
```

## Endpoints

| Path | Auth | Description |
| --- | --- | --- |
| `GET /api/health/` | public | Health check |
| `POST /api/auth/register/` | public | Sign up. Returns `{access, user}` and sets the refresh cookie. |
| `POST /api/auth/login/` | public | `{login, password}`, login is username or email. Same response as register. |
| `POST /api/auth/refresh/` | cookie | New access token and a rotated refresh cookie |
| `POST /api/auth/logout/` | cookie | Revokes the refresh token and clears the cookie |
| `GET/PATCH /api/me/` | bearer | Your account. PATCH changes `currency` only. |
| `POST /api/me/password/` | bearer | `{current_password, new_password}` |
| `GET /api/users/<username>/` | public | Public profile |
| `GET /api/catalog/cards/?q=` | public | Card search, one entry per card |
| `GET /api/catalog/cards/<oracle_id>/` | public | Card with printings and how many the viewer owns |
| `GET /api/catalog/cards/<oracle_id>/printings/` | public | Printings, newest first, with prices |
| `GET /api/catalog/cards/<oracle_id>/edhrec/` | public | EDHREC commanders, played-with groups, similar cards |
| `GET /api/catalog/sets/?q=`, `GET /api/catalog/status/` | public | Set search; last price update |
| `GET/POST /api/locations/` | bearer | Locations with totals (plus Unfiled) / create |
| `GET/PATCH /api/locations/<id>/`, `POST .../delete/` | bearer | Detail, edit (`deck_format` for a Deck box), delete with move/unfile/delete |
| `GET/POST /api/items/` | bearer | Filtered, paged rows / add (merges identical rows) |
| `GET/PATCH/DELETE /api/items/<id>/` | bearer | One row |
| `POST /api/items/bulk/` | bearer | Move, edit or delete; `dry_run` returns counts |
| `POST /api/items/export/`, `/api/imports/preview/`, `/api/imports/commit/` | bearer | Text lists |
| `GET /api/users/` | public | Directory of users with public locations or decks |
| `GET /api/users/<username>/locations/[<id>/[items/]]`, `POST .../export/` | public | Public locations, read-only; deck boxes are left out of the list |
| `GET/POST /api/decks/` | bearer | Deck tiles / create (`create_box`, optional `text` to import) |
| `GET/PATCH /api/decks/<id>/`, `POST .../delete/` | bearer | Full deck (cards with ownership, legality, stats) / edit / delete with keep, unfile or delete for its box |
| `POST /api/decks/<id>/cards/`, `PATCH/DELETE .../cards/<cid>/` | bearer | Add (merges by card and zone), change (quantity, zone, printing, `categories`), remove |
| `GET /api/decks/categories/` | bearer | Category suggestions: names from your decks, most used first, then a common set |
| `POST /api/decks/<id>/cards/<cid>/own/` | bearer | Mark owned: move a free copy into the box, or add a new copy |
| `POST /api/decks/<id>/cards/<cid>/swaps/` | bearer | Propose a swap: `{printing}` joins the Maybeboard linked to the card |
| `POST /api/decks/<id>/cards/<cid>/apply-swap/` | bearer | Apply a candidate: it takes the old card's zone and quantity; the old card becomes its candidate |
| `POST /api/decks/<id>/box/` | bearer | Create the deck box and move free copies into it |
| `POST /api/decks/add-from-collection/` | bearer | One copy of each selected card into a deck |
| `POST /api/decks/import/preview/`, `POST /api/decks/<id>/import/`, `GET .../export/` | bearer | Decklists with zone headings |
| `GET /api/decks/<id>/missing/`, `POST .../missing/export/` | bearer | Missing cards as a card browser page / text |
| `GET /api/users/<username>/decks/[<id>/]` | public | Public decks, without other locations or deck names; the box links to its public page |
| `GET /api/scanner/bundle/` | bearer | Installed recognition model: version, constants, file URLs |
| `GET /api/scanner/bundles/<version>/<file>` | public | Model files (immutable) |
| `GET/PATCH /api/scanner/settings/` | bearer | Scanner settings (fast, sounds, thresholds, total, locked sets) |
| `GET /api/scanner/locked-illustrations/` | bearer | Artwork printed in the locked sets |
| `POST /api/scanner/scans/` | bearer | Log recognized art into the cart, or a `target`: a location, or a decklist only |
| `POST /api/scanner/scans/<id>/undo/` | bearer | Remove one copy from a row the scanner logged |
| `/api/docs/` | public | Swagger UI |
| `/admin/` | staff | Django admin |

The access token lasts 15 minutes and lives only in the frontend's memory. The
refresh token lives in an httpOnly cookie scoped to `/api/auth/`, lasts 7 days
and rotates on every refresh. Set `AUTH_COOKIE_SECURE=True` when serving over
HTTPS.

## API contract

`openapi.yaml` is generated from the code and committed. After changing the API,
run `scripts/check-api.sh` from the project root. It regenerates `openapi.yaml`
and the frontend types, and fails if either changed.

## Card catalog and prices

`manage.py sync_cards` downloads Scryfall's `default_cards` file (every paper
printing) and NBP's EUR and USD rates. Celery beat runs it daily at 13:00 UTC.
A failed sync rolls back and keeps the previous data.

- USD prices are TCGplayer's, EUR prices Cardmarket's (both via Scryfall).
- PLN = EUR × the NBP rate, shown as an estimate.
- `--file <path>` reads a local file instead of downloading (tests use
  `cards/fixtures/scryfall-sample.jsonl`).

`manage.py seed_items --username <u> --rows 20000` fills a collection for
performance checks (only with `DEBUG` on).

## EDHREC

The card detail's tabs come from EDHREC's public page data (no official API).
`cards/edhrec.py` fetches `json.edhrec.com/pages/cards/<slug>.json`, keeps
commanders, played-with groups and similar cards, matches the names to our
catalog, and caches the result in Redis for 24 hours ("no page" for 1 hour).
Any failure or unexpected format returns `available: false`, and the tabs show
"No EDHREC data".

Tests set `EDHREC_FIXTURE_DIR=cards/fixtures/edhrec` so nothing calls EDHREC;
only `sol-ring.json` exists there.

Every price in the API also comes in all three currencies (`unit_prices`,
`values`, `prices_all`, …) so the frontend can show the others in a tooltip.

## Decks

The `decks` app keeps decklists (`Deck`, `DeckCard`). A deck card is a card
(`oracle_id`) with a preferred printing for its picture and price; any owned
printing counts. A deck may have a deck box: a `Location` of kind Deck box,
one-to-one. The location endpoints keep the two in sync: a new Deck box
location gets a deck (Commander unless `deck_format` says otherwise), and
changing the kind away unlinks it. A deck and its box share format and
visibility; the box is counted once, as the deck, in public lists. Cards
that land in a deck box join its decklist's Mainboard when the list has fewer
copies (`decks.services.fill_from_box`, called from `save_item` and
`edit_item`); taking cards out never changes the list.

- `decks/ownership.py`: per deck card, copies in this box, free copies
  (outside every deck box, not in the cart), copies in other decks' boxes,
  and the state (`in_box`, `owned`, `other_decks`, `missing`). Commander,
  Mainboard and Sideboard count; the Maybeboard never does.
- `decks/legality.py`: the formats table, Scryfall card legality (from
  `Printing.legalities`), size, copies, sideboard, commander pairing and
  color identity.
- Swap candidates: Maybeboard cards with `swap_for` pointing at the card they
  could replace (`decks.services.propose_swap`, `apply_swap`, `move_zone`).
  Leaving the Maybeboard or removing the old card drops the link.
- Printings carry `can_command` per commander format, so the frontend offers
  the Commander zone only for possible commanders.
- Categories: `DeckCard.categories`, an ordered list (the first is primary),
  trimmed, without case-insensitive duplicates, at most 10
  (`decks.services.merge_categories`). Merging two entries of a card merges
  their categories.
- `decks/stats.py`, `decks/textlist.py`: curve, pips, types, values; zone-aware
  import and export. Categories travel as `#Tag` at the end of a line
  (underscores for spaces; Moxfield's `#!` prefix is accepted).
- Printings carry `produced_mana` (Scryfall's, WUBRGC only) for the deck
  stats' mana sources.

## Scanner

The `scanner` app installs manavault's published recognition models
(`scanner-bundle-*` GitHub releases, MPL-2.0) into `SCANNER_DIR`
(default `var/scanner`). `manage.py sync_scanner_bundle` installs the newest
one (`--from-dir` for a local copy, `--if-missing` to skip when installed);
Celery beat runs it daily at 04:00 UTC. Every file is checked against the
manifest's SHA-256 before `current` switches; the previous version is kept.

Recognition runs in the browser. The server resolves recognized artwork to a
printing (`scanner/resolve.py`, needs `Printing.illustration_id` from the card
sync) and logs it into the user's cart: `CollectionItem.in_cart`, rows that
stay out of the collection until moved into a location.
