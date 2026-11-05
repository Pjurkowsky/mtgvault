# Spec 007: Binder view (decisions so far)

Status: Written into spec.md (2026-11-05). These answers came from the spec 001 grilling
session and the 007 grilling.

- The binder view is a third option next to Grid and Table in the card browser.
- It is available only on Binder locations (changed 2026-11-05; was every location).
- Each copy of a card takes its own slot (a row with quantity 4 fills 4 slots),
  so the layout matches the physical binder.
- Two or more cards may share one slot; this is allowed but uncommon (2026-11-05).
- Layout options, all selectable per location:
  - pocket grid per page: any size, picked with a grid picker that shows the
    grid itself (2026-11-05)
  - two facing pages (spread) or one page at a time
  - optional fixed page count, showing free and used slots
- Placement options, all selectable:
  - auto-fill the next empty slot, with drag and drop to rearrange (gaps allowed)
  - an "Unplaced" tray, then drag each card into a slot
  - auto-fill plus a "Re-sort binder" action, no drag and drop
- Page sections are optional: a page range, a name, and an optional filter
  (color, type, etc.). Auto-fill prefers the matching section. Sections never
  block placement. A card that doesn't match its section shows a subtle hint.

## Changes from 2026-11-05

- Scan in order: scanning into a binder places each card in the next slot in
  order (for example along a row), so the scan matches the physical pages.
- Cards move between slots with drag and drop.

## Grilling round 1 (2026-11-05)

- Scan in order: pick a start slot and a direction (along rows or down
  columns). Each scan fills the next slot, then continues on the next page.
  Taken slots are skipped.
- Placement: an Unplaced tray, plus adding straight to a position: click an
  empty slot to add a card there. Drag and drop moves cards. Auto-fill and
  "Re-sort binder" are dropped.
- Grid picker: a hover grid up to 6×6 (like inserting a table), the size shown
  as "3 × 4", with shortcuts 2×2, 3×3, 4×3 and 4×4.
- Shared slot: the top card with a "+N" badge; hover shows the cards, click
  lists them to open or reorder. Dropping onto a taken slot asks: swap, or
  share the slot.

## Grilling round 2 (2026-11-05)

- Clicking an empty slot opens a small menu: "Add card…" (the usual add-card
  search; the new copy lands in that slot), "From Unplaced…" (pick a tray
  card) and "Scan from here" (scan in order starting at this slot).
- Kept: two facing pages or one page, fixed page count (optional), page
  sections.
- Resizing the grid keeps each card's page, row and column; cards that no
  longer fit go to Unplaced.
- Cards reaching a binder without a slot (already there, moved in, bulk
  moves, imports, normal scans) go to Unplaced. A card leaving the binder
  frees its slot.

## Grilling round 3 (2026-11-05)

- Sections: the name shows above their pages; a card outside the section's
  filter gets a subtle hint; "From Unplaced…" lists the section's matching
  cards first.
- Fixed page count, scan in order past the last slot: the scanner warns
  "Binder full"; later scans still log to the binder, into Unplaced.
- Facing pages: page 1 alone on the right, then 2–3, 4–5…; phones show one page.
- Binder locations open in binder view the first time (the remembered view
  wins after that). Public binders show binder view read-only.

## Grilling round 4 (2026-11-05)

- Unplaced tray: a side panel to the right of the pages (a sheet on phones)
  with small tiles and its own search.
- Drag and drop: holding a card at a page edge turns the page; long-press to
  drag on touch; "Move to slot…" in the card menu (page, row, column or
  Unplaced; also the keyboard path); dragging onto the tray or "Unplace"
  takes a card out of its slot.
- Settings: a gear button in the binder toolbar opens a dialog with the grid
  picker, facing pages, page count and sections.
- Scanner page: a Binder target offers "In order from" a page and slot
  (default: the first empty slot) and a direction. The result bar shows
  "Page 3 · slot 5"; Undo frees that slot and steps back.
