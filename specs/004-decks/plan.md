# Plan 004: Decks

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| App | New `decks` app: `Deck`, `DeckCard`. |
| Card identity | `DeckCard.printing` is the preferred printing; `oracle_id` is stored too for uniqueness and ownership. Unique per (deck, oracle, zone). |
| Deck box | `Deck.location` one-to-one with `Location` (`SET_NULL`). Kept in sync by the location endpoints, not signals. |
| Rules data | New `Printing` fields from Scryfall: `legalities` (JSON), `color_identity`, `keywords`, `oracle_text`. |
| Legality | `decks/legality.py`: format table + checks, returns `issues`. |
| Ownership | `decks/ownership.py`: one query of the user's owned rows for the deck's cards, split into this box / other deck boxes / free. |
| Owned tab | The card browser with a new `deck=<id>` filter (owned copies of the deck's cards). |
| Missing tab | `GET /api/decks/<id>/missing/` returns a browser page: deck cards filtered with the shared filter, quantity = missing copies. A new browser source `deck-missing`. |
| Mana costs | Scryfall's symbology SVGs bundled in `frontend/src/assets/mana/`, `ManaCost` component. |

## Backend

### Catalog

`Printing.legalities`, `color_identity`, `keywords`, `oracle_text` (all faces
joined). The sync maps them; a resync fills them.

### Models

```
Deck       user, name, format, is_public, location (1:1 Location, null, SET_NULL), created_at
DeckCard   deck, printing (preferred), oracle_id, zone (commander/main/side/maybe),
           quantity (1-999), created_at
           unique (deck, oracle_id, zone)
```

Data migration: every existing `deck_box` location gets a Casual deck with
one mainboard entry per card in it (newest printing among its rows).

### Services

- `decks/services.py`:
  - `add_card(deck, printing, quantity, zone)`: merges
  - `ensure_deck_for_location(location)`
  - `create_box(deck, moves)`
  - `move_copies(row, n, location)`: split a row and merge at the target
  - `delete_deck(deck, box_action)`
- `decks/ownership.py`: per oracle, owned copies grouped as `box`, `others`
  ({deck, quantity}), `free` ({item_id, location, quantity}). Per deck card:
  `needed`, `in_box`, `free`, `other_decks`, `missing`, `state`.
- `decks/legality.py`: formats table (size, exact, copies, sideboard,
  commander, Scryfall key) and checks for AC-22, plus pairing rules for
  AC-12.
- `decks/stats.py`: curve, pips, types, average mana value, values (all
  currencies).
- `decks/textlist.py`: zone-aware parsing on top of `collection.textlist`
  (headings, `SB:`), and formatting with headings.

### Endpoints

| Method | Path | Purpose | ACs |
| --- | --- | --- | --- |
| GET, POST | `/api/decks/` | Tiles / create (`create_box`, optional `text` to import) | 1, 2, 26 |
| GET, PATCH | `/api/decks/<id>/` | Full deck: cards with ownership, legality, stats, counts / edit | 7, 13, 18-24 |
| POST | `/api/decks/<id>/delete/` | `{box: keep\|unfile\|delete}` | 6 |
| POST | `/api/decks/<id>/cards/` | Add `{printing, quantity, zone}` | 10 |
| PATCH, DELETE | `/api/decks/<id>/cards/<cid>/` | Quantity, zone, printing / remove | 11 |
| POST | `/api/decks/<id>/cards/<cid>/own/` | `{item_id, quantity}` or `{new: {...}}` | 15 |
| POST | `/api/decks/<id>/box/` | Create box, `{moves: [{item_id, quantity}]}` | 5 |
| POST | `/api/decks/add-from-collection/` | `{deck, zone, selection}` | 10 |
| POST | `/api/decks/import/preview/` | Parsed zones and errors | 25 |
| POST | `/api/decks/<id>/import/` | Add a list | 26 |
| GET | `/api/decks/<id>/export/` | Text | 27 |
| GET | `/api/decks/<id>/missing/` | Browser page of missing cards (filters) | 17 |
| POST | `/api/decks/<id>/missing/export/` | Text | 17 |
| GET | `/api/users/<username>/decks/`, `/api/users/<username>/decks/<id>/` | Public | 28 |

- Items filter: `deck=<id>` keeps rows whose card is in that deck.
- Locations: creating a `deck_box` location, or changing to/from that kind,
  creates or unlinks its deck (AC-4).
- The directory counts users with a public location or a public deck.

## Frontend

```
pages/DecksPage.vue        tiles, New deck, Import deck
pages/DeckPage.vue         header, tabs Deck | Owned | Missing | Stats (also public view)
components/decks/
  DeckTile.vue, NewDeckDialog.vue, DeckImportDialog.vue, DeleteDeckDialog.vue
  DeckList.vue             Moxfield-style columns + hover image
  DeckVisual.vue           card images grouped
  DeckCardDialog.vue       quantity, zone, printing, ownership, mark owned, remove
  DeckAddDialog.vue        search + printing + quantity + zone
  CreateBoxDialog.vue      free copies to move
  DeckStats.vue, LegalityPanel.vue, OwnershipBadge.vue, ManaCost.vue
  AddToDeckDialog.vue      from the collection browser
```

- **Card browser:**
  - new source `{ kind: 'deck-missing', deckId }`: read-only, export via the
    missing export endpoint
  - prop `deck` for the Owned tab
  - "Add to deck" in the context menu and the bulk bar
- **Top bar:** "Decks".
- **Profile:** public decks listed below public locations.

## Tests

| File | Covers |
| --- | --- |
| `decks.spec.ts` | AC-1 to AC-7: tiles, new deck, deck box sync, create box with moves, delete choices, edit |
| `deck-cards.spec.ts` | AC-8 to AC-12, AC-18 to AC-21: add by search and from the collection, edit, zones, list/visual, grouping, commander |
| `deck-ownership.spec.ts` | AC-13 to AC-17: four states, mark owned both ways, Owned and Missing tabs, missing export |
| `deck-legality.spec.ts` | AC-22 to AC-24: issues per format, stats |
| `deck-import.spec.ts` | AC-25 to AC-28: import formats, export round trip, public deck |

Backend shell checks during tasks cover the partner pairing and color
identity rules against the real catalog, since the test catalog has only one
legendary creature.

## Order of work

1. Catalog fields, models, migrations (incl. deck boxes), location sync.
2. Ownership, legality, stats, text lists.
3. Endpoints, items `deck` filter, public endpoints, API types.
4. Frontend: mana symbols, Decks page, dialogs.
5. Deck page: list/visual, card dialog, add, import/export, stats, legality.
6. Owned/Missing tabs, Add to deck from the collection, profile.
7. Tests, full suite, READMEs, spec status.
