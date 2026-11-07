# Spec 014: Export options and steady layout

Status: Done
Depends on: 001-collection, 004-decks, 012-ownership-labels

## Goal

Opening a select or menu never moves the page, and exports fit the site you
paste them into.

## Acceptance criteria

### Layout

- **AC-1** Opening a select, menu or dialog keeps the page's scrollbar and
  layout where they are; the page behind a select or menu can still scroll.

### Export dialog

- **AC-2** The export text box has a fixed width and height (the dialog's
  width, 12 lines). Long lines scroll sideways instead of wrapping; the dialog
  never changes size while the text loads.
- **AC-3** Every export (collection, a location, deck Export, Export missing)
  has a **Printings** checkbox, ticked. Unticked, lines carry only quantity
  and name (`1 Sol Ring`): no set, number or finish marker. Lines that then
  name the same card merge, adding their quantities.
- **AC-4** Deck Export has a **Categories** checkbox, ticked. Unticked, lines
  carry no `#tags`.
- **AC-5** Export missing has **Include cards in other decks**, ticked. Ticked,
  it adds the copies this deck lacks whose only copies are in other decks'
  boxes; unticked it lists only the copies you don't own anywhere.
- **AC-6** The text and its row count update as soon as a checkbox changes.
  The checkboxes are remembered in this browser.

## Out of scope

- Site-specific formats (TCGplayer `[SET]`, Cardmarket CSV)
- Import changes

## Assumptions

- With Printings unticked, deck zone headings stay; merging happens within a
  zone (a zone holds a card once already).
- The row count shows the lines written.
