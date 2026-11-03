# Plan 005: Deck improvements

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| Reuse | The collection's Add card, card detail dialog, card menu and add fields grow options instead of decks getting copies. `DeckAddDialog` and `DeckCardDialog` go away. |
| Card search | The search step of `AddCardDialog` (input, grid/list results, size, hover and fullscreen) moves into `CardSearch.vue`, used by Add card, the deck's Add card and Propose swap. |
| Swap link | `DeckCard.swap_for`: nullable FK to another `DeckCard` of the same deck, `SET_NULL`. Only Maybeboard cards may have it. |
| Commander zone | Printings carry `can_command: {commander, brawl}` from `legality.can_be_commander`; the frontend offers the zone from that. |
| Box format | The location API takes and returns `deck_format` for Deck box locations; the deck keeps the format. |
| Shared visibility | Saving either side's `is_public` writes the other, in the deck and location endpoints. A data migration aligns existing boxes to their decks. |
| Scan target | The scan request gets an optional `target`: cart (default), a location (or Unfiled), or a deck (list only). The deck page opens `/scan?deck=<id>`; the choice is remembered per deck in the browser. |
| Display options | `usePreference` (already used by Add card) for view, group and sort; URL query wins. |

## Backend

### Models

```
DeckCard.swap_for   FK DeckCard, null, SET_NULL, related_name='candidates'
```

Migrations: the field; a data migration setting each deck box's `is_public`
to its deck's.

### Services (`decks/services.py`)

- `propose_swap(card, printing)`: `add_card(..., zone='maybe')`, then link it
  (an existing Maybeboard entry of that card gets linked).
- `apply_swap(candidate)`: the candidate takes the old card's zone (merging
  with an entry already there), the old card moves to the Maybeboard linked to
  the candidate. One transaction.
- `edit_card`: moving a card out of the Maybeboard clears its `swap_for`.
- `set_visibility(deck_or_location, is_public)`: writes both sides.
- `sync_location(location, format=None)`: creates the deck with that format
  (default Commander), or changes the linked deck's format.

### Endpoints

| Method | Path | Change | ACs |
| --- | --- | --- | --- |
| GET | `/api/catalog/.../printings/`, `/api/catalog/cards/<id>/` | `can_command` on each printing | 5 |
| GET | `/api/decks/<id>/` | deck cards: `swap_for`, `printing.can_command` | 5, 10 |
| POST | `/api/decks/<id>/cards/<cid>/swaps/` | `{printing}`: propose a candidate | 9 |
| POST | `/api/decks/<id>/cards/<cid>/apply-swap/` | apply a candidate | 11 |
| PATCH | `/api/decks/<id>/` | `is_public` also writes the box | 19 |
| GET, POST, PATCH | `/api/locations/...` | `deck_format` for Deck box; `is_public` also writes the deck | 18, 19 |
| GET | `/api/users/<u>/locations/`, `/api/users/` | deck boxes left out of public locations and their count | 20 |
| GET | `/api/users/<u>/decks/<id>/` | `location` shown again (the box is public with its deck) | 20 |
| POST | `/api/scanner/scans/` | `target: {kind: cart\|location\|deck, location?, deck?}`; response `totals` of the target; deck target returns `deck_card` instead of `item` | 16, 17 |
| POST | `/api/scanner/scans/<id>/undo/` | any row the scanner logged, not only cart rows | 17 |

Removing a deck card's candidates' links and the Maybeboard rule are enforced
by the services, not the frontend.

## Frontend

```
components/collection/CardSearch.vue    search step, extracted from AddCardDialog
components/collection/AddCardDialog.vue props: card (skip search), defaultLocation,
                                        deck mode: deck step + "Also add to my collection"
components/collection/CardDetailDialog.vue  open by oracle id too; #deck slot at the top
components/browser/CardMenu.vue          items as props (Open/Edit/Add to deck/Propose swap/Delete)
components/collection/LocationDialog.vue Format when kind is Deck box
components/decks/
  DeckSection.vue      quantity, zone, printing, ownership, mark owned, remove (from DeckCardDialog)
  DeckText.vue         compact rows, CardPreview beside the line
  DeckSwaps.vue        Swaps tab
  ScanTargetDialog.vue where scans go
pages/DeckPage.vue     three views, menus, Swaps tab, Scan, display options
pages/ScanPage.vue     ?deck=: target shown and changeable; Undo per target
```

- Text view is the default; `DeckList` stays as List, `DeckVisual` as
  Images. All three wrap cards in `CardMenu`.
- `CardBrowser`: no Scan button with a `deck` prop; for `deck-missing` the ⋯
  menu shows a disabled "Add to want list".
- Edit and Delete of your copies inside the deck's card dialog reuse
  `EditItemDialog` and the browser's delete confirm.

## Tests

| File | Covers |
| --- | --- |
| `deck-add.spec.ts` | AC-1 to AC-5: search step, also add to collection, card dialog with deck section, add a new copy, commander zone |
| `deck-views.spec.ts` | AC-6 to AC-8: three views, hover, menus, remembered options |
| `deck-swaps.spec.ts` | AC-9 to AC-13: propose, Swaps tab, apply and undo, unlinking, public |
| `deck-boxes.spec.ts` | AC-14, AC-15, AC-18 to AC-20: want list item, header scan button, box format, shared visibility, public lists |
| `scanner-deck.spec.ts` (scanner project) | AC-16, AC-17: target prompt, scanning into a box, into the list, Undo |

Existing tests that used `DeckCardDialog`, the deck Add card dialog, the
public locations list or the scanner's cart-only response get updated with
them.

## Order of work

1. Model, migrations, services for swaps, visibility, box format.
2. Endpoints, `can_command`, public lists, scanner target, API types.
3. CardSearch, AddCardDialog modes, CardDetailDialog with the deck section.
4. Views, menus, display options, Swaps tab.
5. Scan target, location format, Missing tab, Owned tab.
6. Tests, full suite, READMEs, spec status.
