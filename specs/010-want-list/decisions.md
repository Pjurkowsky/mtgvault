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

## Round 1

- Add in the card dialog: depends on the page. On a deck page it opens the
  deck's Add dialog with the card filled in; elsewhere the collection Add
  dialog with the card and the page's location preselected.
- Entry: a card with a quantity, optionally pinned to one printing.
- Place: a tile on the collection page (next to Unfiled and Cart). Each
  wanted card can be linked to decks.
- "Add to want list": a simple add, no dialog.

## Round 2

- Deck link: an entry may name the deck it's for. Adding from a deck page
  links that deck. The same card for two decks is two entries. The want list
  filters by deck; a deck's missing cards show a heart when wanted.
- Repeat add: each click adds one more, with a green toast; the button shows
  the wanted count.
- Getting the card: adding copies (Add, scan, import) lowers the want
  quantity automatically; at zero the entry goes away. Entries linked to the
  deck whose box gets the copies are lowered first.
- Existing disabled buttons: the user asked for an explanation (round 3).

## Round 3

- Old buttons: only the deck one works. Scanned cards are always bought, so
  the Cart's "Move to want list" goes away.
- Want list page: like every other collection page (card browser). In decks,
  wanted cards still show as missing, marked as on the want list.
- New: a deck's ⋯ menu gets an option that puts every missing card on the
  want list.
- Sharing: a Public toggle, like locations.
- "Add to collection" on an entry opens the Add dialog with the card,
  printing and quantity filled in; the location is the linked deck's box,
  otherwise the user picks. Saving lowers the entry.

## Round 4

- Deck "Add missing to want list" tops up: each missing card ends up wanted
  for that deck as many times as it's missing; a second run adds nothing.
- The want list is separate: never in All cards, collection count or value,
  or deck ownership. Its tile shows its own count and total cost.
- Entry fields: quantity, printing (Any or one), finish (Any, non-foil,
  foil), deck (none or one). Same card, printing, finish and deck merge.
- Deleting a deck keeps its entries, unlinked (merging where they match).
