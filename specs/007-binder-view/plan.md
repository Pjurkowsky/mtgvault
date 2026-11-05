# Plan 007: Binder view

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| Where a copy's place lives | A `BinderSlot` row per placed copy: location, collection row, page, row, column and a stack position. Unplaced copies are not stored: a row's quantity minus its slots. |
| Keeping slots true | One function, `collection.binder.sync_slots(row)`, runs after every save of a collection row (a `post_save` receiver): slots of a row that left the binder or went to the cart are deleted, and a row with more slots than copies loses its highest ones (spec assumption). `edit_item` moves a row's slots to the row it merges into before deleting it. Deleting a row deletes its slots (cascade). |
| Binder settings | Fields on `Location`: `binder_rows`, `binder_cols` (default 3 × 3), `binder_spread` (default on), `binder_pages` (empty = grows). Sections are `BinderSection` rows. Settings stay when the kind changes, so changing it back restores the layout. |
| Section filters | Stored as the card browser's query keys (color, type, rarity, set, finish, condition, price). The server marks mismatches with the collection's `apply_filters`, so the hint matches the browser's filters exactly. |
| One binder request | `GET /api/locations/<id>/binder/` returns the settings, sections, every slot, every row of the binder (for tiles, menus and the card dialog) and the unplaced count per row. Moves answer with the same payload, so the page re-renders from one source. |
| Moves | One endpoint takes a source (a slot, or a row's unplaced copy), a target (a page, row and column, or none for Unplaced) and a mode (`swap` or `share`). Swap with a tray card sends the slot's cards to Unplaced. |
| Scan in order | The scan target for a location gains `binder: {page, row, col, direction}`, the cursor. The server places the copy in the first free slot from the cursor, in that direction, and returns the slot; the client moves its cursor past it. With a page count and no free slot left, the copy stays unplaced and the result says `binder_full`. Undo gets the slot id and frees it before removing the copy. |
| Opening the scanner on a binder | The location page's Scan button opens `/scan?location=<id>` for a Binder; the scanner then logs into that binder. "Scan from here" adds `page`, `row`, `col`. The scanner's Change button opens the in-order dialog (start page and slot, direction, or Unplaced). |
| Drag and drop | Pointer events, no library: a ghost follows the pointer; the target is the slot or tray under it (`elementFromPoint`, `data-slot`). Touch starts after a 400 ms long press. Holding at the left or right edge for 600 ms turns the page. |
| View choice | `View` gains `binder`, offered only when the browser shows a Binder location. A Binder location with no view in the URL opens in binder view until the user picks a view there (stored per binder in the browser). |
| Reuse | `CardTile` for slot and tray images, `CardPreview` for hover, `CardDetailDialog` for a click, `CardMenu` with new items `slot` and `unplace`, `AddCardDialog` with a `slot` prop, filter pieces from `browser/filters/` for section filters. |

## Backend

### Models and data

```
Location.binder_rows     PositiveSmallInteger, default 3   (1–6)
Location.binder_cols     PositiveSmallInteger, default 3   (1–6)
Location.binder_spread   Boolean, default True
Location.binder_pages    PositiveSmallInteger, null        (1–500)

BinderSection   location FK, name (60), first_page, last_page, filter JSON
BinderSlot      location FK, item FK (CollectionItem), page, row, col, position, created_at
```

Pages, rows and columns are 1-based in the API and UI.

### Endpoints

| Method | Path | Change | ACs |
| --- | --- | --- | --- |
| GET | `/api/locations/<id>/binder/` | settings, sections, slots (with `mismatch`), rows, unplaced counts, page count, used and total slots | 2, 9, 11, 12 |
| PATCH | `/api/locations/<id>/binder/` | rows, cols, spread, pages, sections (replaced as a list); answers with `unplaced_now` | 6–10 |
| POST | `/api/locations/<id>/binder/move/` | `{slot \| item, to: {page,row,col} \| null, mode}` | 15, 17, 18 |
| POST | `/api/locations/<id>/binder/order/` | `{page,row,col, slots: [ids]}`: stack order, top first | 19 |
| GET | `/api/users/<u>/locations/<id>/binder/` | public, read-only, public row fields | 24 |
| POST | `/api/items/` | optional `slot: {page,row,col}` for a Binder location | 14 |
| POST | `/api/scanner/scans/` | target `binder` cursor; result `slot`, `binder_full` | 20–23 |
| POST | `/api/scanner/scans/<id>/undo/` | optional body `{slot}` | 22 |

Placement rules (`collection/binder.py`):

- A slot is in range when its row and column fit the grid and, with a page
  count, its page does too. Resizing or lowering the page count deletes the
  slots out of range (their copies become unplaced).
- `share` puts the moved card on top (position above the others).
- A row can't have more slots than copies; placing a row with no unplaced
  copy is refused.

## Frontend

```
lib/binder.ts                    slot numbering, spreads, cursor steps, page ranges
components/binder/
  BinderView.vue                 toolbar (arrows, page label, used slots, gear), pages, tray; drag state
  BinderPage.vue                 one page: section name, grid of slots
  BinderSlot.vue                 a pocket: empty menu, card tile, +N badge, mismatch hint, stack list
  UnplacedTray.vue               side panel / sheet with search and tiles
  GridPicker.vue                 6 × 6 hover grid with shortcuts
  BinderSettingsDialog.vue       grid picker, spreads, page count, sections
  SectionEditor.vue              one section: name, pages, filter (browser/filters pieces)
  MoveToSlotDialog.vue           page, row, column or Unplaced
  FromUnplacedDialog.vue         pick a tray card for a slot, section matches first
  BinderScanDialog.vue           in order from page and slot, direction, or Unplaced
composables/useBinderDrag.ts     pointer drag, long press, edge page turn
CardBrowser.vue                  binder view option; Scan opens /scan?location=
ScanPage.vue, useScanner.ts      binder target with cursor; result bar slot line
```

## Tests

| File | Covers |
| --- | --- |
| `binder.spec.ts` | AC-1 to AC-5, AC-24: view only on binders, default view, slots per copy, spreads, page keys and URL, public read-only |
| `binder-settings.spec.ts` | AC-6 to AC-11: grid picker, resize keeps places, page count, sections with hints |
| `binder-placing.spec.ts` | AC-12 to AC-19: tray, unplaced on arrival and freeing, empty slot menu, drag and drop, edge turn, swap or share, move to slot, stacks |
| `scanner-binder.spec.ts` | AC-20 to AC-23: in-order target, result bar slot, undo frees the slot, binder full (scanner project) |

## Order of work

1. Models, migration, sync of slots, binder services, endpoints, API types.
2. Items POST with a slot; scan target cursor and undo.
3. Binder view: pages, spreads, navigation, view option and default.
4. Settings: grid picker, page count, sections.
5. Tray, empty slot menu, add to slot, from Unplaced.
6. Drag and drop, edge turn, swap or share, move to slot, stacks.
7. Scanner: binder target, in-order dialog, result bar.
8. Public view, tests, full suite, READMEs, spec status.
