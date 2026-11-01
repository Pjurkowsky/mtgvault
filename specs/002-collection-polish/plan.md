# Plan 002: Collection polish

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| Prices in every currency | The API sends each price in all three currencies next to the viewer's one. The frontend's `Price` component shows one and puts the others in its tooltip. |
| Toast colors | Sonner's `rich-colors` option: success green, error red. |
| Confirm dialogs | One `ConfirmDialog` plus a `useConfirm()` composable that returns a promise. Every delete uses it. |
| Right-click menu | shadcn-vue `context-menu` (reka-ui), which also opens on long-press. |
| Hover previews | shadcn-vue `hover-card`, in one `CardPreview` wrapper. |
| Mana symbols | Scryfall's W, U, B, R, G and C SVGs, copied into `frontend/src/assets/mana/`. |
| EDHREC | Backend proxy `GET /api/catalog/cards/{oracle_id}/edhrec/`, cached 24 h in Redis. Tests read a committed fixture instead of the network. |

## Backend

### Prices in all currencies (AC-1 to AC-3)

A shared `MoneySerializer` with `USD`, `EUR` and `PLN` (each a number or
null). Responses gain a sibling field next to every existing price:

| Existing field | New field |
| --- | --- |
| item `unit_price` | `unit_prices` |
| item `added_price` | `added_prices` (from `added_usd/eur/pln`) |
| item `purchase_price_converted` | `purchase_prices` (via `convert`) |
| printing `prices[finish]` | `prices_all[finish]` |
| page `total_value`, location and totals `value` | `total_values`, `values` |

Totals use three SQL sums, one per currency, built from `price_expression`.
Public serializers get `unit_prices` and `values` only (no purchase or added
prices, spec 001 AC-57).

### Card detail endpoint (AC-25, AC-26, AC-33, AC-34, AC-37)

`GET /api/catalog/cards/{oracle_id}/` returns the card name, its printings
(newest first, with `prices` and `prices_all`) and `owned`: the total quantity
the viewer owns across rows (0 when logged out).

The catalog read endpoints (this one, printings, search, sets, status) become
public, so public location pages can show reprints and EDHREC tabs. Prices
follow the viewer's currency, USD when logged out.

### EDHREC proxy (AC-28 to AC-36)

`cards/edhrec.py`:

1. Slug from the front face name: lowercase, drop everything except letters,
   digits, spaces and hyphens, then spaces become hyphens
   (`Jace, the Mind Sculptor` → `jace-the-mind-sculptor`).
2. Fetch `https://json.edhrec.com/pages/cards/{slug}.json` (10 s timeout,
   our User-Agent). A 403 or 404 means no page.
3. Turn it into our shape:

```
commanders:  [{name, share}]          share = num_decks / potential_decks
played_with: [{group, cards: [{name, synergy}]}]
             group = cardlist header (Creatures, Instants, …), cards sorted
             by lift; skips the commander, top and new-card lists
similar:     [{name}]
```

4. Match names to our catalog in one query (newest printing per name), adding
   `oracle_id` and `image_small`/`image_normal`. Names we don't have stay, but
   aren't clickable.
5. Cache the result for 24 hours under `edhrec:{slug}` in Redis. "No page" is
   cached for 1 hour. Network errors aren't cached.

Response: `{available: bool, commanders, played_with, similar}`. With
`available: false` the lists are empty (AC-36).

Tests: setting `EDHREC_FIXTURE_DIR` makes `edhrec.py` read `{slug}.json` from
that folder instead of the network. A missing file means "no page". The
fixture is `backend/cards/fixtures/edhrec/sol-ring.json`, trimmed to the
fields we read.

### Delete counts (AC-5)

No new endpoint. Single rows know their quantity, locations know
`card_count`, and bulk deletes already get counts from `dry_run`.

## Frontend

### New shared pieces

```
components/
  Price.vue             value in the viewer currency + tooltip with the others (AC-1 to AC-3)
  ConfirmDialog.vue     alert dialog driven by useConfirm()
  CardPreview.vue       hover-card with a large image (AC-9, AC-32)
  ManaSymbol.vue        <img> of a bundled mana SVG (AC-20)
  IconButton.vue        icon-only button with a tooltip (AC-6)
composables/
  useConfirm.ts         `await confirm({ title, description, action })` → boolean
  usePreference.ts      a value remembered in localStorage (view, sizes)
assets/mana/            W.svg U.svg B.svg R.svg G.svg C.svg
```

`App.vue`: `<Toaster rich-colors>` and one `<ConfirmDialog>`.

`formatMoney` drops the "≈". Every place that shows a price switches to
`<Price>`: grid hover, table, detail, location tiles and pages, browser
summary, add card.

### Add card (AC-7 to AC-11)

- Results: a `ToggleGroup` (Grid / List) and, in grid view, a size
  `ToggleGroup` (S / M / L). Both are remembered with `usePreference`. Every
  result is wrapped in `CardPreview`.
- `ItemFields`:
  - finish becomes a `ToggleGroup` built from the printing's finishes
  - location becomes a `ToggleGroup` with 6 or fewer locations, otherwise a
    combobox (`Popover` + `Command` with search)

### Card browser (AC-12 to AC-23)

- `useSelection` loses `active`. Selection mode is simply
  `count > 0`.
- `CardGrid` tiles:
  - a checkbox in the top-left corner, visible on hover, on keyboard focus,
    or while anything is selected
  - the tile body opens the detail, or toggles the card while anything is
    selected; Shift-click selects a range
  - name and price move into a hover overlay at the bottom of the image
- `CardTable`: checkbox column always present, same click rules.
- Each tile and row is wrapped in a `ContextMenu` with Open, Edit and Delete
  (owner only). Edit opens a new `EditItemDialog`, the edit form taken out of
  today's detail dialog.
- Toolbar:
  - a "Select all" checkbox (checked, unchecked or indeterminate)
  - Import and Export move into a `DropdownMenu` behind a "⋯" `IconButton`
  - sort direction and grid/table get tooltips
- `FilterPopover`: a Clear button in its header, mana symbols on the color
  toggles. `FilterChips.vue` is deleted.
- Summary: "N cards · value", where value is a `<Price>`.

### Card detail (AC-24 to AC-38)

`CardDetailDialog` is rebuilt around `GET /api/catalog/cards/{oracle_id}/`:

```
┌───────────────┬──────────────────────────────────┐
│               │ Your copies (row fields, prices)  │
│  big image    │ [Edit] [Delete]                   │
│               ├──────────────────────────────────┤
│               │ Tabs: Commanders | Played with |  │
├───────────────┤       Similar                     │
│ reprints strip│ grid of small cards (CardPreview) │
└───────────────┴──────────────────────────────────┘
```

- It keeps a stack of viewed cards. The first entry is the row the dialog
  opened from; tab clicks push the next card, and a back arrow pops it.
- For a card from a tab, or on public pages, the copies block shows
  "You own N" and disabled "Add" and "Add to want list" buttons.
- Reprints strip (owner, own row only):
  - clicking another printing runs `useConfirm`, then `PATCH` with the new
    printing
  - a merge shows the spec 001 toast
  - on public pages the strip is display-only
- EDHREC tabs load lazily when the dialog opens, with skeletons while
  loading and "No EDHREC data" when `available` is false.

## Tests

### Existing tests that change

Spec 002 replaces some spec 001 behavior, so these tests change with it:

- `browser.spec.ts`: chips (AC-32 of 001) become the Clear button; the
  summary text drops rows
- `bulk.spec.ts`: no Select button; selection starts from checkboxes
- `catalog.spec.ts`: PLN without "≈"; the estimate moves into the price
  tooltip
- `card-detail.spec.ts` and `add-card.spec.ts`: the new detail layout and the
  toggles
- `import-export.spec.ts` and `public.spec.ts`: Import and Export inside the
  More menu

### New test files

| File | Covers |
| --- | --- |
| `polish-global.spec.ts` | AC-1 to AC-6: price tooltips in each currency, toast colors, delete dialogs, icon tooltips |
| `polish-add-card.spec.ts` | AC-7 to AC-11 |
| `polish-browser.spec.ts` | AC-12 to AC-23: hover checkbox, select all, click rules, right-click menu, More menu, mana symbols, Clear, summary |
| `card-detail.spec.ts` (rewritten) | AC-24 to AC-38, against the Sol Ring EDHREC fixture and a card without one |

Playwright's Django server sets `EDHREC_FIXTURE_DIR`, so no test calls EDHREC.

### Gaps

The live EDHREC call is checked once by hand at wrap-up (Sol Ring and a
double-faced card). Its format can change without notice, which is why the
proxy treats any unexpected shape as "No EDHREC data".

## Order of work

1. **Backend:** money fields, card detail endpoint, public catalog, EDHREC
   proxy with cache and fixture, regenerated API types.
2. **Shared UI:** `Price`, `ConfirmDialog` + `useConfirm`, `CardPreview`,
   `ManaSymbol`, `IconButton`, rich-color toasts, no "≈".
3. **Add card:** result views and sizes, finish and location toggles.
4. **Browser:** selection without a mode, tiles, context menu,
   `EditItemDialog`, toolbar More menu, filter Clear, summary.
5. **Card detail:** the new layout, reprints switch, EDHREC tabs, card stack,
   public read-only.
6. **Tests:** update the existing ones, add the new ones, full run.
7. **Wrap up:** live EDHREC check, READMEs, spec status.
