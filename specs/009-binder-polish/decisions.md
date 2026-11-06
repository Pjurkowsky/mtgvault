# Spec 009: Binder polish (decisions so far)

Status: Written into spec.md (2026-11-06).

## Requests

- S/M/L card size in the binder
- Unplaced as a right sidebar, hidden or shown with a button in the middle of
  its edge; it shows while dragging a card
- Longer hover preview delay so drag and drop doesn't trigger it
- After creating a location, go to it
- Keep the UI in place when switching Binder, Grid and Table views
- Search bar in the binder like other views: highlight the card, go to its page
- Don't show "3 cards · PLN 64.20" twice
- Pagination at the bottom of the page
- Creating a Binder location shows the binder layout options (size etc.)
- Selected mana colors in filters more visible
- Section filters like the binder settings: mark fields such as mana colors,
  and the icons appear there
- One toolbar instead of three groups of buttons

## Round 1

- Toolbar: one row under the name: view toggle, search, then Scan, Add card
  and ⋯ on the right. ⋯ holds Binder settings, Edit location, Import, Export
  and Delete. The same toolbar on every location page.
- Card size: S/M/L sets the pocket width; facing pages show only when both
  fit. Remembered in the browser.
- Unplaced sidebar: a tab in the middle of the right edge ("Unplaced 12")
  toggles it; open or closed is remembered. Dragging a card from a slot opens
  it as a drop target and closes it after if it was closed.
- Search: the same search box; matches get a ring and the rest dim; it jumps
  to the first match's page; Enter or arrows step through ("2 of 5"); the tray
  filters to matches.

## Round 2

- Section filters: inline in the settings (no popover): mana symbol toggles,
  type, rarity and so on. The chosen mana symbols show next to the section
  name above its pages and in its row in settings.
- New Binder location: the create dialog adds the grid picker, facing pages
  and page count when the kind is Binder; sections stay in Binder settings.
  After creating any location, its page opens.
- Hover preview: 800 ms everywhere, never while a button is pressed or a card
  is dragged.
- Totals: keep "3 cards · PLN 64.20" under the location name; the browser's
  own line is hidden on location pages. "Prices updated" is not shown there.
- Prices (question, not a change): EUR is Cardmarket's trend price and USD
  TCGplayer's, both through Scryfall's daily data; PLN converts EUR at the NBP
  rate. Cardmarket's own API is closed to most apps.

## Round 3

- Pagination: under the pages only: ‹ 1 2–3 4–5 … 12 › with the current view
  marked; a number jumps there; the used slots line sits under it. Arrow keys
  still turn pages.
- Selected mana colors: a thick ring and full color; once any is selected the
  others fade. One component for collection, deck and section filters.
- No jumps: the same toolbar in every view; sort and filters stay visible but
  disabled in binder view.
