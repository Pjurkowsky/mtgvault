# Spec 010: Want list (decisions so far)

Status: Grilling (2026-11-07). Written into spec.md when done.

## Requests

- A spec about the want list, plus improvements
- Selecting a card in another card's dialog opens that card's dialog; its
  "Add" and "Add to want list" buttons should work
- "Add" opens another dialog where the current location is selected by
  default: the deck box, binder or deck

## Research

- No want list exists yet. Disabled placeholders wait for it:
  - card dialog "Add" and "Add to want list" (spec 002 AC-34), shown for a
    card you don't own or opened from an EDHREC tab
  - "Add to want list" in the right-click menu of a deck's missing cards
    (spec 005 AC-14, spec 006)
  - "Move to want list" in the Cart's selection bar
- `AddCardDialog` already takes a fixed card, a printing and a default
  location (used by a deck card's "Add copy").
- `DeckAddDialog` adds a card to a deck (zone, quantity, optional copies into
  the deck box) but always starts with a search.
- Locations are Binder, Box and Deck box; a deck links to its deck box.
- The top nav has Decks and Users; the collection page shows Unfiled and Cart
  tiles next to the locations.
