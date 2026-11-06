# Spec 009: Binder polish

Status: Draft
Depends on: 001-collection, 002-collection-polish, 007-binder-view

## Goal

Make the binder view calmer and quicker to work with: one toolbar that never
moves, search that finds a card's page, card sizes, a hideable Unplaced
sidebar, pagination under the pages, and the binder layout chosen when the
binder is created.

## Terms

- **Toolbar**: the one row of controls under a location's name.
- **Sidebar**: the Unplaced tray (spec 007, AC-12) as a panel on the right edge.
- **Match**: a pocket or tray card whose name contains the search text.

## Principle

A location page keeps the same layout in every view; switching views or
opening the sidebar never moves the controls you are about to click.

## Acceptance criteria

### Toolbar and totals

- **AC-1** Every location page has one toolbar under the name: the view
  toggle, search, filters, sort, then Scan, Add card and a ⋯ menu on the right.
  The ⋯ menu holds Binder settings (binders only), Edit location, Import,
  Export and Delete. Edit and Delete no longer sit next to the name, and the
  binder's gear button goes away.
- **AC-2** The toolbar is the same in Grid, Table and Binder view. In Binder
  view, filters and sort stay in place but are disabled.
- **AC-3** The card count and value show once, under the location name. The
  browser's own line ("3 cards · PLN 64.20" and "Prices updated …") is hidden
  on location pages, the cart and public locations included; All cards keeps
  it.

### Binder view

- **AC-4** In Binder view the toolbar shows a card size toggle, S, M and L,
  after the sort controls. The size sets the pocket width. Facing pages show
  only when both pages fit; otherwise one page shows. The size is remembered
  in the browser.
- **AC-5** Search works in Binder view as in the other views. Matching pockets
  get a ring and the others fade. The view jumps to the first match's page;
  Enter, or the arrows next to the search, go to the next and previous match
  ("2 of 5"). The sidebar shows only matching cards. The search stays in the
  URL.
- **AC-6** Pagination sits under the pages only: previous and next arrows and
  page numbers (‹ 1 2–3 4–5 … 12 ›), the current view marked. A number jumps
  to its page. Long lists shorten with … around the current view. The used
  slots line ("42 / 108 slots") sits under it. The arrow keys still turn
  pages.

### Unplaced sidebar

- **AC-7** The Unplaced tray is a sidebar on the right with a tab in the middle
  of its edge ("Unplaced 12"). The tab shows and hides it; the choice is
  remembered. On phones it slides over the pages.
- **AC-8** Dragging a card from a pocket opens the sidebar as a drop target;
  after the drop it closes again if it was closed before.

### Hover preview

- **AC-9** The large hover preview waits 800 ms (was 350 ms), everywhere it is
  used. It never opens while a mouse button is held or a card is dragged.

### Creating locations

- **AC-10** After creating a location, its page opens.
- **AC-11** In the new location dialog, kind Binder adds the binder layout:
  the grid picker, facing pages and page count (spec 007, AC-6 to AC-9).
  Sections stay in Binder settings.

### Filters

- **AC-12** A selected mana symbol in a filter has a thick ring and full color;
  once any symbol is selected, the others fade. This is the same in the
  collection, deck and section filters.
- **AC-13** In Binder settings, each section shows its filter inline instead of
  in a popover: mana symbols, type, rarity, finish and condition.
- **AC-14** A section's chosen mana symbols show next to its name above its
  pages and in its row in the settings.

## Out of scope

- Card size in Grid and Table view
- Keeping the scroll position or the page height when switching views
- Price sources: prices stay Scryfall's (Cardmarket EUR, TCGplayer USD, PLN from
  EUR at the NBP rate)

## Assumptions (filled in during writing, not grilled)

- The size toggle appears after the sort controls only in Binder view, so
  nothing before it moves (AC-2, AC-4).
- Binder search matches card names, as the other views do (AC-5).
- Search with no match shows "None" in the box and fades nothing
  (AC-5).
- Sets and price ranges stay out of the inline section filter; sections made
  with them keep working (AC-13).
- The deck page keeps its own toolbar (spec 006); AC-1 is about location pages.
- Pockets are 4, 5.5 or 7.5 rem wide, so medium pages still face each other
  beside the open sidebar on a laptop (AC-4).
- In Grid and Table view the size toggle keeps its place, invisible, so the
  buttons after it don't move (AC-2).
- The sidebar takes its own space; opened by a drag, the pages make room for
  it once, at the start of the drag (AC-8).
- Phones start with the sidebar closed (AC-7).
