# Spec 011: Deck and add polish

Status: Done
Followed by: 021-deck-and-layout-polish
Depends on: 002-collection-polish, 005-deck-improvements, 006-deck-views

## Goal

Deck lists read like Moxfield again, with the card's image beside the list,
and the keyboard previews cards as the mouse does. Swap rows line up
symmetrically. Adding a card is calmer: the dialog keeps its size while
searching, and printings can be narrowed by finish and sorted by price.

## Acceptance criteria

### Deck views

- **AC-1** On wide screens the List view shows a large image of a card left of
  the list. The image stays in view while scrolling. It shows the hovered card,
  or the card focused with the arrow keys, otherwise the first card. List rows
  open no hover popup. Phones show no side image. This replaces spec 006 AC-2
  for the List view.
- **AC-2** In the Text view, moving to a card with the arrow keys shows its
  large preview next to the row, as hovering does.

### Swaps

- **AC-3** A swap row has four parts:
  - the card going out: name, price and mana value, then its image
  - the middle: Swap, and the price and mana value differences
  - the card coming in: its image, then name, price and mana value
  - a trash icon button with a "Remove" tooltip

  The two cards take equal widths, mirrored around the middle.
- **AC-4** The trash icon asks for confirmation, then removes the proposal
  with a green toast.

### EDHREC cards

- **AC-10** Right-clicking (long-pressing) a card in the card dialog's EDHREC
  tabs (Commanders, Played with, Similar) opens a menu with Open. When the
  dialog was opened from a deck card outside the Maybeboard, the menu also has
  Propose swap: the EDHREC card becomes a swap candidate for that deck card
  (spec 005, AC-9), with a green toast.

### Add dialog

- **AC-5** While searching, the Add dialog keeps its width. Results sit in a
  fixed-height area that scrolls. While a search loads, the previous results
  stay, dimmed. "No cards found" shows in the same area.

### Printings

- **AC-6** The printing picker (Add card, a deck's Add card, Edit, and the want
  list dialog) has a finish filter (All, Non-foil, Foil, Etched). It hides
  printings without that finish.
- **AC-7** The picker sorts printings Newest, Oldest, Cheapest or Priciest.
- **AC-8** Each printing shows its price under its image. Picking Foil or
  Etched in the filter also sets the Finish field. Prices and Cheapest use the
  filter's finish; with All they use non-foil, or the printing's only finish.
- **AC-9** The finish filter and the sort are remembered in the browser.

## Out of scope

- A side image in the Text or Images view
- Searching printings by set name

## Assumptions (filled in during writing, not grilled)

- Printings without a price sort last with either price order (AC-7).
- A printing filtered out of view stays selected if it was picked; the picker
  then selects the first one shown (AC-6).
- The side image is 13rem wide, as before spec 006 (AC-1).
- Propose swap from EDHREC uses the card's newest printing, as a swap candidate
  from search does before you change it (AC-10).
- The swap is for the deck card the dialog opened on, also while it shows a
  card stacked from a tab (AC-10).
- The want list dialog's finish filter sets the entry's finish; Any stays
  possible with All (AC-8).
