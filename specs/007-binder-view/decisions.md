# Spec 007: Binder view (decisions so far)

Status: Not written yet. These answers came from the spec 001 grilling session
and seed the 002 grilling.

- The binder view is a third option next to Grid and Table in the card browser.
- It is available on every location, regardless of kind.
- Each copy of a card takes its own slot (a row with quantity 4 fills 4 slots),
  so the layout matches the physical binder.
- Layout options, all selectable per location:
  - pocket grid per page: 1x1, 2x2, 3x3, 4x3, 4x4 and so on
  - two facing pages (spread) or one page at a time
  - optional fixed page count, showing free and used slots
- Placement options, all selectable:
  - auto-fill the next empty slot, with drag and drop to rearrange (gaps allowed)
  - an "Unplaced" tray, then drag each card into a slot
  - auto-fill plus a "Re-sort binder" action, no drag and drop
- Page sections are optional: a page range, a name, and an optional filter
  (color, type, etc.). Auto-fill prefers the matching section. Sections never
  block placement. A card that doesn't match its section shows a subtle hint.
