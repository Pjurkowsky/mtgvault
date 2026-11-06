# Spec 007: Binder view

Status: Done
Depends on: 001-collection, 002-collection-polish, 003-scanner, 005-deck-improvements, 006-deck-views

## Goal

Show a Binder location the way it sits on the shelf: pages of pockets, each
copy in its own place. You set the page grid, put cards in exact slots, move
them with drag and drop, and scan a stack straight into the slots in order.

## Terms

- **Slot**: one pocket on a binder page, at a page, row and column. It holds
  one copy of a card, or now and then several.
- **Unplaced**: the binder's copies that have no slot yet, shown in a tray.
- **Spread**: two facing pages.
- **Section**: a named page range of a binder, with an optional filter.
- **Scan in order**: scanning that puts each scanned card in the next slot from
  a start slot, along rows or down columns.

## Principle

The binder view mirrors the physical binder. It never re-lays cards by itself;
a card moves only when you move it. It reuses the collection's tiles, hover
preview, card dialog, menus, add card and filter pieces (spec 001 principle P-2).

## Acceptance criteria

### The view

- **AC-1** Binder locations get a third view, Binder, next to Grid and Table.
  Other location kinds don't offer it. A Binder location opens in Binder view
  the first time; after that the remembered view choice wins.
- **AC-2** Each copy has its own slot: a row with quantity 4 can fill 4 slots.
  Slots show the card image; empty slots show an empty pocket. Hovering a card
  shows its large image; clicking opens the card dialog.
- **AC-3** Pages show one at a time or as spreads, a choice per binder. Spreads
  follow a real binder: page 1 alone on the right, then 2–3, 4–5 and so on.
  Phones always show one page.
- **AC-4** Page arrows and the Left and Right arrow keys turn pages. The page
  number is in the URL.
- **AC-5** Binder view always shows the physical layout: the browser's sort and
  filters don't apply to it.

### Settings

- **AC-6** A gear button in the binder toolbar opens the binder settings:
  pockets per page, one page or spreads, page count and sections.
- **AC-7** Pockets per page are chosen with a grid picker: hovering a 6 × 6 grid
  highlights the block and shows its size ("3 × 4"); a click picks it.
  Shortcuts for 2 × 2, 3 × 3, 4 × 3 and 4 × 4 sit beside it.
- **AC-8** Changing the grid keeps every card's page, row and column. Cards that
  no longer fit go to Unplaced. A confirm says how many cards that is.
- **AC-9** The page count is optional. Without it, the binder has as many pages
  as its last placed card needs, plus one empty page. With it, the binder
  shows that many pages and free and used slots ("214 / 288 slots").

### Sections

- **AC-10** A section has a page range, a name and an optional filter built from
  the collection's filter pieces (color, type, rarity, set …). Its name shows
  above its pages.
- **AC-11** A card in a section whose filter it doesn't match gets a subtle
  hint. Sections never block placing a card.

### Unplaced and placing

- **AC-12** The Unplaced tray is a side panel next to the pages (a sheet on
  phones) with small tiles and its own search. A tile stands for one
  collection row and shows "×4" when several of its copies are unplaced.
- **AC-13** Copies that reach a binder without a slot go to Unplaced: copies
  already in the binder when this ships, copies moved in from another
  location, bulk moves, imports and normal scans. A copy that leaves the binder
  (moved, deleted, quantity lowered) frees its slot.
- **AC-14** Clicking an empty slot opens a menu:
  - **Add card…**: the usual add card dialog; the new copy lands in that slot
  - **From Unplaced…**: pick a tray card for this slot; cards that match the
    slot's section come first
  - **Scan from here**: scan in order starting at this slot (AC-20)

### Moving

- **AC-15** Cards move with drag and drop: slot to slot, tray to slot, and slot
  to tray. Dragging a tray tile takes one copy.
- **AC-16** Holding a dragged card at the left or right edge of the pages turns
  the page. On touch screens, long-press a card to drag it.
- **AC-17** Dropping onto a taken slot asks: swap the cards, or share the slot.
- **AC-18** The card menu in a slot has "Move to slot…" (page, row and column,
  or Unplaced) and "Unplace". This is also the keyboard path.

### Shared slots

- **AC-19** A slot with several cards shows the top card with a "+N" badge.
  Hovering shows all of them; clicking lists them to open one or change their
  order.

### Scan in order

- **AC-20** Scan in order starts from a start slot and a direction, along rows
  or down columns. Each scan fills the next slot and continues on the next
  page. Taken slots are skipped.
- **AC-21** The Scan button on a Binder opens the scanner logging into that
  binder, in order from the first empty slot along rows. The scanner's Change
  button sets "In order from" a page and slot and the direction, or Unplaced.
  "Scan from here" opens the scanner starting at that slot.
- **AC-22** The result bar shows where each card went ("Page 3 · slot 5"). Undo
  removes the copy, frees its slot and steps back one slot.
- **AC-23** With a page count, a scan past the last slot shows "Binder full";
  later scans still log to the binder, into Unplaced.

### Public binders

- **AC-24** Public Binder locations offer Binder view read-only: no tray, no
  settings, no menus, no drag and drop.

## Out of scope

- Binder view for Box and Deck box locations
- Auto-fill and a "Re-sort binder" action
- A location tile count of unplaced cards
- Printing binder pages

## Assumptions (filled in during writing, not grilled)

- Slots are numbered left to right, top to bottom on each page ("slot 5" on a
  3 × 3 page is row 2, column 2) (AC-22).
- Scan in order down columns goes top to bottom, then the next column to the
  right (AC-20).
- In a shared slot, the card dropped last goes on top (AC-17, AC-19).
- Lowering a row's quantity frees the slots of its last placed copies, the
  highest page and slot first (AC-13).
- A card's slot is kept when you edit its condition, finish, language or price;
  a merge into another row keeps the slots of both (AC-13).
- Sections may not overlap; a page belongs to at most one section (AC-10).
- The binder settings are owner-only; public viewers see the layout as set
  (AC-24).
