# Spec 010: Want list

Status: Done
Depends on: 001-collection, 002-collection-polish, 004-decks, 005-deck-improvements, 006-deck-views

## Goal

Collectors keep a list of cards they want, alongside the collection and with
its own total cost. Cards land on it in one click from any card dialog, from a
deck's missing cards, or all of a deck's missing cards at once. Copies added
to the collection lower it automatically. The card dialog's Add button, until
now disabled, opens the right Add dialog for the page you're on.

## Terms

- **Want list**: the user's one list of wanted cards. It is not part of the
  collection.
- **Entry**: one line of the want list: a card, a quantity, a printing (Any or
  one), a finish (Any or one) and the deck it's for (none or one).
- **Wanted for a deck**: entries linked to that deck.

## Acceptance criteria

### Card dialog

- **AC-1** For a card you don't own, or one opened from an EDHREC tab, the card
  dialog shows "You own N", Add and Add to want list, and both work. Read-only
  dialogs (public pages) show neither button.
- **AC-2** On a deck page, Add opens the deck's Add dialog with this card and
  its shown printing filled in. Saving adds it to the deck.
- **AC-3** Elsewhere, Add opens the collection Add dialog with this card and
  printing filled in, and the page's location selected. A location page
  selects that location (binder, box or deck box). All cards selects Unfiled.
  The want list selects nothing, so you pick one.
- **AC-4** Add to want list adds one copy (any printing, any finish) with a
  green toast. Each click adds one more. The button shows how many you want:
  "Add to want list (2)". On a deck page the entry is for that deck.

### Entries

- **AC-5** An entry has a quantity (1 to 999), a printing (Any or one), a
  finish (Any, Non-foil, Foil, Etched) and a deck (none or one of yours).
  Adding or editing an entry so it matches another entry (same card, printing,
  finish and deck) merges the two, adding their quantities.
- **AC-6** The want list never counts as collection. Its cards are not in All
  cards, location totals or deck ownership.

### Want list page

- **AC-7** The collection's Locations tab shows a Want list tile after Cart,
  with its card count and total cost. It opens the want list page.
- **AC-8** The want list page works like a location page:
  - grid and table views, search, filters (no condition) and sort
  - a Deck filter
  - the card count and total cost under the title

  Each card shows its quantity and price. The price is the pinned printing's,
  or the printing it was added from; Any finish is priced as non-foil. The
  table shows Printing ("Any" or the set and number), Finish and Deck.
- **AC-9** Add card on the want list page opens a dialog: search a card, then
  quantity, printing, finish and deck.
- **AC-10** Clicking a card opens the card dialog with the entry: quantity,
  printing, finish, deck and price, plus Edit, Add to collection and Delete.
  The right-click menu has Open, Edit, Add to collection and Delete. Delete
  asks for confirmation.
- **AC-11** Edit changes the quantity, printing, finish and deck (AC-5).
- **AC-12** Add to collection opens the collection Add dialog with the card,
  printing, finish and quantity filled in. The location is the linked deck's
  box; without one you pick.

### Getting cards

- **AC-13** When copies enter the collection, matching entries go down by the
  number of copies, and an entry at zero goes away. An entry matches when its
  printing is Any or the same, and its finish is Any or the same.
  - Copies enter the collection through Add, import, scanning into a
    location, moving cards out of the Cart, and a deck's Add copy.
  - Moving copies between locations doesn't count.
  - Entries for the deck whose box gets the copies go first, then entries
    without a deck, then other decks', oldest first.

### Decks

- **AC-14** A deck card that is on the want list (for this deck or without a
  deck) shows a heart next to its ownership dot. Its tooltip says "N on want
  list".
- **AC-15** A missing card's right-click menu has Add to want list. It adds
  the card for this deck until the quantity wanted for the deck equals the
  missing count. A green toast says how many were added.
- **AC-16** The deck's ⋯ menu has Add missing to want list. It does the same
  for every missing card in the Commander, Mainboard and Sideboard. The toast
  says how many cards were added, or that nothing was missing.
- **AC-17** Deleting a deck keeps its entries, without a deck. Entries that
  then match merge (AC-5).

### Sharing

- **AC-18** The want list page's ⋯ menu has a Public switch. A public want list
  shows as a Want list tile on the owner's profile and opens a read-only page.
  A private one answers "not found" to others. The users directory lists users
  whose only public thing is their want list.

### Cart

- **AC-19** The Cart's selection bar no longer shows Move to want list. Scanned
  cards are bought.

## Out of scope

- Buying links and price alerts
- Importing or exporting the want list
- Selecting several entries and bulk actions on the want list
- Adding cards from someone else's public pages to your want list
- Matching your want list against other users' collections

## Assumptions (filled in during writing, not grilled)

- An entry with Any printing keeps the printing it was added from, to show
  its image and price (AC-8).
- Any finish is priced as non-foil (AC-8).
- The want list page has its own Add card (AC-9), since it works like a
  location page.
- Entries merge in the service, not through a database constraint (AC-5).
- The heart counts entries for this deck and entries without a deck (AC-14).
- A Maybeboard card's right-click Add to want list uses its own missing count;
  Add missing to want list skips the Maybeboard (AC-15, AC-16).
- The deck card's own dialog section (the deck card at the root of the dialog)
  doesn't get a want button; the right-click menu covers it (AC-15).
