# Spec 006: Deck views

Status: Done
Depends on: 002-collection-polish, 004-decks, 005-deck-improvements
Followed by: 007-binder-view, 021-deck-and-layout-polish

## Goal

Make the deck page easier to read and work with. The Images view becomes the
collection's grid, the deck gets search, filters and your own categories, the
Swaps tab compares cards side by side, and the Stats tab looks like the deck
sites players already know.

## Terms

- **Category**: a name you give a deck card, such as Ramp or Removal. A card
  may have several; the first one is its **primary** category.
- **Filters**: the Deck tab's filter menu (color, type, mana value, rarity,
  set, category, ownership state).

## Principle

Reuse the collection's components and behavior wherever they fit (spec 001
principle P-2): the card grid, the filter menu, the hover preview, menus and
dialogs.

## Acceptance criteria

### Views

- **AC-1** The Images view uses the collection's card grid: sizes S, M and L,
  the fullscreen button, quantity and ownership badges, and the right-click
  menu. Cards stay grouped as in the other views. The size is remembered with
  the other display options (spec 005, AC-8).
- **AC-2** Hovering a card shows its large image wherever the card's own image
  is small or missing: Text and List rows, the collection's table view, the
  Swaps tab and card browser lists. Grid tiles show no hover preview. The List
  view's fixed side image goes away.
- **AC-3** Each group heading in every view shows the group's count and value,
  for example "Creatures (24) · €58.40". The value is in your currency, with the
  others in a tooltip.
- **AC-4** Remove from deck and the Swaps tab's Remove are outlined buttons with
  red text and a trash icon, not plain red text.

### Search and filters

- **AC-5** The Deck tab has a search box that filters every view by card name as
  you type. Groups show only matching cards, and their counts and values follow.
- **AC-6** Next to it, a Filters button opens the collection's filter menu with
  color, type, mana value, rarity, set, category and ownership state (in the
  box, owned, in other decks, missing). The button shows how many filters are
  on. Filters combine with the search.
- **AC-7** Search and filters live in the URL, so a reload or a shared link keeps
  them.
- **AC-8** The Owned and Missing tabs go away; the ownership filter replaces them.
  "Export missing" in the deck's ⋯ menu exports the missing cards as before
  (spec 004, AC-17).
- **AC-9** Keyboard on the Deck tab: `/` focuses the search, Escape clears it,
  arrow keys move between cards, Enter opens the focused card. An InfoTip next
  to the search lists these keys.

### Swaps

- **AC-10** The Swaps tab is a table of pairs. Each row shows the old card on the
  left and the candidate on the right, each with its image, price, mana value
  and ownership state. A swap button sits between them, with labelled
  differences under it ("Price +€3.20", "Mana value +5"). Remove is on the
  candidate's side.
- **AC-11** A card with several candidates has one row per candidate, the old
  card repeated. Its rows sit under a heading ("Lightning Bolt · 3 proposals")
  that collapses them. Groups start expanded; collapsed ones are remembered per
  deck in the browser.

### Categories

- **AC-12** A deck card can have several categories. You edit them in the card
  dialog's deck section (a chips input) or with Categories… in the right-click
  menu.
- **AC-13** Category names are free text. Suggestions come from categories used
  in your decks and a common set: Ramp, Draw, Removal, Board wipe, Lands,
  Win condition.
- **AC-14** Group by gains "By category": a card shows under its primary
  category; cards without one show under their type.
- **AC-15** Deck export writes categories as tags (`1 Sol Ring #Ramp #Artifacts`)
  and import reads them back.

### Stats

- **AC-16** The Stats tab shows, after the legality panel:
  - key numbers: cards, lands, average mana value with and without lands,
    value, owned and to buy
  - the mana curve, each bar split into creatures and other spells
  - colors: each color's share of mana symbols next to its share of mana
    sources (cards that produce that color)
  - types, categories, rarity and the most used sets
  - the 10 most expensive cards; clicking one opens its card dialog
- **AC-17** Clicking a chart part (a curve bar, a color, a type, a category, a
  rarity or a set) opens the Deck tab with only that filter set. Filters that
  were on before are cleared.
- **AC-18** Stats count the Commander, Mainboard and Sideboard, as in spec 004.
  Wide screens show two columns, phones one.

## Out of scope

- Draw odds and a sample hand
- Commander showcase, inline quantity buttons, collapsible view groups, illegal
  card marks, drag between zones
- Filters and search on the Swaps tab
- The want list

## Assumptions (filled in during writing, not grilled)

- Arrow keys follow reading order: left and right within a row of the grid,
  up and down through rows (AC-9).
- Mana sources come from Scryfall's produced mana data; a land producing any
  color counts for each color (AC-16).
- Categories belong to a deck card, so the same card in two decks can have
  different categories (AC-12).
- A card keeps its categories when it changes zone; a swapped-in candidate keeps
  its own, not the old card's (AC-12, spec 005 AC-11).
- With the Missing tab gone, spec 005's disabled "Add to want list" moves to the
  right-click menu of cards that are missing (AC-8, spec 005 AC-14).
- Removing the Owned tab drops editing your copies from a deck's page in bulk;
  single copies stay editable in the card dialog (spec 005, AC-3).
