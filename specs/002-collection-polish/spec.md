# Spec 002: Collection polish

Status: Done
Depends on: 001-collection
Followed by: 005-binder-view

## Goal

Make the collection faster to work with and easier to read: selection
without a mode switch, cards that show only what matters until you hover,
a richer card detail with EDHREC data, and the same small conventions
(prices, toasts, deletes, tooltips) everywhere.

## Replaces in spec 001

| Spec 001 | Replaced by |
| --- | --- |
| AC-3 (PLN marked "≈" as an estimate) | AC-1, AC-2: no estimate mark |
| AC-26 (card detail) | AC-26 to AC-38 |
| AC-29 (grid tiles with name and price below) | AC-17 |
| AC-32 (filter chips above the cards) | AC-21 |
| AC-35 (rows and cards in the summary) | AC-23 |
| AC-38 (Select button turns on selection mode) | AC-12 to AC-15 |

Everything else in spec 001 still holds.

## Acceptance criteria

### Prices (whole app)

- **AC-1** Every price shows in the user's currency, without a "≈" mark.
- **AC-2** Hovering or focusing a price shows a tooltip with the same price in
  the other two currencies, and nothing else. (Changed 2026-11-02: no PLN
  estimate note.)
- **AC-3** A missing price still shows "–". Its tooltip lists the other
  currencies, also "–" where missing.

### Toasts, deletes and tooltips (whole app)

- **AC-4** Every success toast (added, created, saved, moved, imported,
  exported, deleted) is green. Every error toast is red.
- **AC-5** Every delete asks for confirmation in a dialog that names what will
  be deleted and how many cards: a single row, a bulk delete, a location.
- **AC-6** Every button that shows only an icon has a tooltip naming its
  action.

### Add card

- **AC-7** Search results switch between a grid of card images and a list
  (small image and name). The choice is remembered per browser.
- **AC-8** The grid has a size control (small, medium, large), remembered per
  browser. Medium is the default and larger than today's thumbnails.
- **AC-9** Hovering a result, in either view, shows a large preview of the
  card.
- **AC-10** Finish is a toggle group offering only the finishes the chosen
  printing has.
- **AC-11** Location is a toggle group (Unfiled plus each location) when the
  user has 6 or fewer locations. With more, it is a dropdown with search.

### Selection

- **AC-12** Hovering a card shows a checkbox on it. Clicking the checkbox
  selects the card.
- **AC-13** While at least one card is selected, every card shows its
  checkbox, and clicking a card toggles it instead of opening it. Shift-click
  selects a range.
- **AC-14** "Select all" appears in the bulk bar once a card is selected,
  and as a checkbox in the table view's header row. It selects every row
  matching the current search and filters, including rows not loaded yet
  (spec 001 AC-39 and AC-40 still apply). With everything selected, it clears
  the selection. There is no separate "Clear selection" button (replaces that
  part of spec 001 AC-40). (Changed 2026-11-02: no longer in the toolbar.)
- **AC-15** The bulk bar appears while anything is selected. There is no
  separate Select button.

### Browsing cards

- **AC-16** With nothing selected, clicking a card opens its detail.
- **AC-17** Grid tiles show only the card image and the quantity badge. Name
  and price appear when the user hovers the tile.
- **AC-18** Right-clicking a card (long-press on touch) opens a menu with Open,
  Edit and Delete. Edit opens the row's edit form in a dialog, including a
  printing picker. Delete asks per AC-5.
- **AC-18a** Printing pickers (Add card and Edit) show a large preview when
  hovering a printing. Choosing another printing in Edit and saving merges
  with a matching row like any edit (spec 001 AC-19). (Added 2026-11-02.)
- **AC-18b** Every card image in Add card, Edit and the card detail (search
  results, printings, reprints, EDHREC tab cards) shows an expand button on
  hover that opens the card full screen. Clicking the card itself keeps its
  normal action. In the detail, clicking the big image also opens it full
  screen. Escape or a click closes the preview and leaves the dialog open.
  (Added 2026-11-02.)
- **AC-19** Import and Export sit in a "More" (⋯) menu in the toolbar.
- **AC-20** The color filter shows Scryfall's mana symbols (W, U, B, R, G, C)
  instead of letters. The symbols ship with the app.
- **AC-21** No filter chips show above the cards. The filter menu has a Clear
  button at the top. The Filters button keeps its count of active filters.
- **AC-22** Sort direction, grid/table and the More menu have tooltips (AC-6).
- **AC-23** The summary line reads "N cards · value", without the row count.

### Card detail

- **AC-24** The detail is a large dialog with the card image big on the left.
- **AC-25** Next to the image: the user's copies of this row (quantity,
  finish, condition, language, location), current price (AC-2 tooltip),
  price when added, purchase price, and Edit and Delete buttons.
- **AC-26** Below the image, a strip shows every printing of the card, newest
  first, with set and collector number. The row's current printing is
  highlighted.
- **AC-27** Clicking another printing asks for confirmation, then switches the
  row to that printing. If the row then matches another, they merge (spec 001
  AC-19) and a toast says so.
- **AC-28** Below the copies block, tabs show EDHREC data: Commanders,
  Played with, Similar.
- **AC-29** Commanders lists the top commanders whose decks include this
  card, each with the share of those commanders' decks that play it.
- **AC-30** Played with lists cards often played with this one, grouped by
  type (Creatures, Instants, Sorceries, Artifacts, Enchantments,
  Planeswalkers, Lands, …), each group sorted by synergy.
- **AC-31** Similar lists EDHREC's similar cards.
- **AC-32** Each card in a tab shows its image and name. Hovering shows a
  large preview.
- **AC-33** Clicking a card in a tab switches the dialog to that card: image,
  reprints and EDHREC tabs, plus how many copies the user owns. A back arrow
  returns to the previous card.
- **AC-34** For a card the user doesn't own (or views from a tab), the dialog
  shows "Add" and "Add to want list" buttons, both disabled for now.
- **AC-35** The backend fetches EDHREC data and caches it for 24 hours per
  card. The browser never calls EDHREC directly.
- **AC-36** When EDHREC has no page for the card, or can't be reached, the
  tabs say "No EDHREC data". The rest of the dialog works as usual.
- **AC-37** On a public location page the detail is read-only: no Edit,
  Delete or reprint switching, and no purchase price or price when added.
  EDHREC tabs still show.
- **AC-38** Edit and Delete from the detail behave like the right-click menu
  (AC-18).

## Out of scope

- Adding cards from the detail, and the want list (later specs; the buttons
  show disabled)
- Rulings and format legality tabs
- Other EDHREC sections (new cards, themes, average decks)

## Assumptions (filled in during writing, not grilled)

- EDHREC data is cached for 24 hours (AC-35).
- Long-press opens the context menu on touch screens (AC-18).
- Grid size steps are small, medium and large (AC-8).
- The location dropdown beyond 6 locations has a search field (AC-11).
- Commanders and Played with show at most 50 cards per list, as EDHREC
  returns them.
