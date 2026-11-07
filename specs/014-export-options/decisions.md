# Spec 014: Export options and steady layout (decisions)

Status: Written into spec.md (2026-11-07).

## Requests

- "when selecting sorting so select buttons it disables scrolling and the whole
  layout shifts coz there is less width, fix that"
- "when clicking export button the textbox should have a predefined width"
- "there should be button like include cards in other decks or remove printings
  tags (if thats actually will work on other websites)"

## Research

- Selects, menus and dialogs (reka-ui) lock scrolling: `body { overflow:
  hidden; padding-right: <scrollbar> }`. With `html { scrollbar-gutter: stable }`
  the hidden overflow moves to the viewport, the scrollbar goes and the 15px
  padding is added: content jumps 7.5px (measured with visible scrollbars).
  Scrolling on `<html>` (`overflow-y: auto`) and no body padding keeps the
  scrollbar and the layout; the page still scrolls with a menu open.
- `ExportDialog` (collection, deck Export, Export missing) has a `Textarea`
  that sizes to its content (`field-sizing`), so the dialog changes width.
- Line formats: deck Export `1 Sol Ring (C21) 263 #Ramp` under zone headings;
  Export missing `1 Sol Ring (C21) 263`; collection `1 Sol Ring (C21) 263 *F*`.
- Names only (`1 Sol Ring`) imports on Moxfield, Archidekt, MTGGoldfish,
  Cardmarket Wants and TCGplayer Mass Entry; `(SET) number` suits
  Moxfield and Archidekt style importers. `#tags` are Moxfield's.
- Export missing counts `ownership.missing`, so cards In other decks are left
  out.

## Grilling (2026-11-07)

- Export missing gets "Include cards in other decks", ticked by default.
- A "Printings" checkbox on every export (collection, deck Export, Export
  missing), ticked by default; unticked gives names only.
- Deck Export gets "Categories", ticked by default; unticked drops `#tags`.
- The checkboxes are remembered in the browser.
