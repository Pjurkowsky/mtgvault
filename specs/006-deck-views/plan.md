# Plan 006: Deck views

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| Where filtering happens | In the browser. The deck detail already has every card; search, filters and chart clicks all use one predicate module (`lib/deckFilter.ts`), so a chart click shows exactly the cards the chart counted. |
| Filter menu reuse | `FilterPopover` is split into its pieces (color toggles, checkbox group, set picker, the popover shell with the active count). The collection's menu is rebuilt from them unchanged; `DeckFilterPopover` uses the same pieces with deck options (sets and categories that occur in the deck, mana value 0-7+, ownership state). |
| Grid reuse | The tile of `CardGrid` moves to `CardTile.vue` (image, quantity badge, fullscreen, hover name, size). `CardGrid` keeps rendering collection rows with it; `DeckVisual` renders deck cards with it, in groups. Sizes S/M/L as in `CardSearch`. |
| Hover preview | `CardPreview` (already used by Text rows) wraps List rows, `CardTable` rows, Swaps cells and card browser list rows. The List view's sticky side image is removed. |
| Categories | `DeckCard.categories`: an ordered list of names; the first is primary. Written through the deck card PATCH. Suggestions from a small endpoint. |
| Mana sources | New `Printing.produced_mana` (Scryfall `produced_mana`), filled by the next `sync_cards`. |
| Stats | Chart data is computed in the browser from the cards with the filter predicates (`lib/deckStats.ts`). Key value numbers keep using the server's `stats.value`. Charts are plain HTML/CSS bars like today's curve (no chart library); the dataviz skill is read before building them. |
| Remembered state | Images size with the display options (`usePreference`); collapsed swap groups per deck in localStorage (`mtgvault.swaps.collapsed.<deckId>`). |
| Owned and Missing tabs | Removed. The ownership state is a filter field. "Export missing" moves to the deck ⋯ menu using the existing missing export endpoint. The disabled "Add to want list" moves to the card menu of missing cards. |

## Backend

### Models and data

```
Printing.produced_mana   ArrayField(CharField(1)), default []   (W U B R G C)
DeckCard.categories      ArrayField(CharField(40)), default []  (ordered, first = primary)
```

`cards/scryfall.py` maps `produced_mana`; `PRINTING_UPDATE_FIELDS` gains it.

### Endpoints

| Method | Path | Change | ACs |
| --- | --- | --- | --- |
| GET | `/api/decks/<id>/`, public deck | deck cards: `categories`; printing: `rarity`, `set_code`, `produced_mana` | 6, 14, 16 |
| PATCH | `/api/decks/<id>/cards/<cid>/` | `categories` (trimmed, case-insensitive duplicates dropped, at most 10) | 12 |
| GET | `/api/decks/categories/` | names used in the user's decks, then the common set, without duplicates | 13 |
| POST | `/api/decks/import/preview/`, `/api/decks/<id>/import/` | `#Tag` words at the end of a line become categories | 15 |
| GET | `/api/decks/<id>/export/` | lines end with one `#Tag` per category, in order | 15 |

Tag syntax: `#Ramp`; spaces in a name become underscores (`#Board_wipe`) and
turn back into spaces on import. The deck text parser strips the tags before
the collection line parser sees the line.

`move_zone` and `apply_swap` leave categories alone (spec assumptions).

## Frontend

```
lib/deckFilter.ts           DeckFilter type, URL (de)serialisation, matches(card, filter)
lib/deckStats.ts            curve by type, symbols vs sources, types, categories, rarity, sets, top 10
components/browser/
  CardTile.vue              tile extracted from CardGrid
  filters/                  ColorToggles, CheckGroup, SetPicker, FilterShell (from FilterPopover)
  FilterPopover.vue         the collection menu, rebuilt from filters/
components/decks/
  DeckFilterPopover.vue     deck fields from filters/
  DeckToolbar.vue           search, Filters, group, sort, view, size; '/' and Escape; InfoTip
  DeckVisual.vue            groups of CardTile
  DeckList.vue, DeckText.vue  CardPreview on rows, group value in headings
  GroupHeading.vue          "Creatures (24) · €58.40", shared by the three views
  DeckSwaps.vue             table of pairs, collapsible groups
  CategoryInput.vue         chips input with suggestions (deck section and menu popover)
  DeckStats.vue             key numbers and charts; chart clicks emit a filter
pages/DeckPage.vue          tabs Deck / Swaps / Stats; filter state in the URL; keyboard nav
```

- Keyboard: cards in every view carry `data-deck-card`; arrow keys move focus
  to the nearest card in that direction by position, Enter clicks it.
- Group value: sum of `price × quantity` per group, all currencies for the
  tooltip (deck cards carry `prices`).
- `Button` gets an `outline-destructive` look via classes in one place
  (`components/DestructiveButton.vue`), used by Remove from deck and Swaps
  Remove.

## Tests

| File | Covers |
| --- | --- |
| `deck-visual.spec.ts` | AC-1 to AC-4: grid tiles and sizes, hover where images are small, group values, remove buttons |
| `deck-filters.spec.ts` | AC-5 to AC-9: search, filters with count, URL, Export missing, keyboard |
| `deck-swaps.spec.ts` (updated) | AC-10, AC-11: pairs table, labelled diffs, collapse remembered |
| `deck-categories.spec.ts` | AC-12 to AC-15: edit in dialog and menu, suggestions, group by category, export and import |
| `deck-stats.spec.ts` | AC-16 to AC-18: key numbers, charts, chart click filters, counted zones |

Existing tests that used the Owned and Missing tabs (deck-ownership AC-16,
AC-17; deck-boxes AC-14, AC-15), the List view's side image (deck-cards) and
the old stats (deck-legality or deck-cards stats checks) get updated.

## Order of work

1. Model fields, sync mapping, serializers, categories endpoint, text tags, API types.
2. Shared pieces: CardTile, filter pieces, collection menu rebuilt on them (regression run).
3. Deck filter module, toolbar, filter menu, URL, tabs removed, Export missing, keyboard.
4. Views: grid tiles, hover, group headings, destructive buttons.
5. Swaps table; categories UI; stats.
6. Tests, full suite, READMEs, spec status.
