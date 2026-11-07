# Spec 004: Decks

Status: Done
Depends on: 001-collection, 002-collection-polish
Followed by: 005-deck-improvements

## Goal

Build decklists in any common format, see which of the cards you own and
where they are, and keep a deck's physical cards together in its deck box.

## Terms

- **Deck**: a decklist with a name, a format and zones. It may have a deck
  box.
- **Deck box**: a location of kind Deck box. Every deck box is exactly one
  deck's box.
- **Deck card**: one entry in a decklist: a card (any printing counts), a
  quantity, a zone and a preferred printing used for its picture and price.
- **Free copy**: an owned copy (not in the cart) that isn't in any deck's
  box.

## Acceptance criteria

### Decks and deck boxes

- **AC-1** The top bar has "Decks". The Decks page shows each deck as a tile:
  name, format, commander (or first card) image, card count, owned and
  missing counts, and value.
- **AC-2** "New deck" asks for name, format, visibility and whether to create
  a deck box. New decks are private, with no deck box unless ticked.
- **AC-3** Formats: Commander, Brawl, Standard, Pioneer, Modern, Legacy,
  Vintage, Pauper, Casual.
- **AC-4** Creating a location of kind Deck box also creates its deck
  (Casual, same name and visibility). Changing a location to Deck box does
  the same; changing it away from Deck box leaves the deck without a box.
- **AC-29** Cards put into a deck box (added, imported, moved, edited or moved
  from the cart) join its decklist: when the box holds more copies of a card
  than the list's Commander, Mainboard and Sideboard together, the Mainboard
  gets the difference, with the box copy's printing for a new entry. Taking
  cards out of a box never changes the list. Changing a location to Deck box
  fills its new deck the same way.
- **AC-5** A deck without a box can get one ("Create deck box"). A dialog then
  lists the deck's free owned copies with their locations, all ticked, and
  moves the ticked copies into the new box.
- **AC-6** Deleting a deck that has a box asks what happens to the box: keep
  it as a normal location (kind Box), move its cards to Unfiled, or delete
  the cards too. A deck without a box deletes after a confirm.
- **AC-7** Deck name, format and visibility can be edited.

### Zones and cards

- **AC-8** Zones: Commander (Commander and Brawl only), Mainboard, Sideboard
  (formats without a commander), Maybeboard.
- **AC-9** A deck card is a card, not a printing: any owned printing counts.
  Its preferred printing (default: newest) can be changed for picture and
  price.
- **AC-10** Cards are added by search on the deck page (quantity and zone), by
  "Add to deck" from the collection's right-click menu and bulk bar, and by
  importing a decklist. Adding a card already in that zone raises its
  quantity.
- **AC-11** A deck card's quantity, zone and preferred printing can be
  changed, and it can be removed.
- **AC-12** Commander decks have one commander, or two when they can pair
  (both Partner, "Partner with" each other, both "Friends forever", "Choose a
  Background" with a Background, "Doctor's companion" with a Doctor).

### Ownership

- **AC-13** Every deck card shows one of four states, with counts when it
  needs several copies:
  - **In deck box**: enough copies are in this deck's box
  - **Owned**: free copies cover the rest; shows which locations

  Spec 012 renames In deck box to Owned and Owned to Free in collection.
  - **In other decks**: the remaining copies are only in other decks' boxes;
    shows which decks
  - **Missing**: not enough copies anywhere
- **AC-14** Commander, Mainboard and Sideboard count toward ownership.
  Maybeboard cards show a state but count toward no totals.
- **AC-15** "Mark owned" on a card that isn't fully in the box: pick a free
  copy (it moves into the deck box) or add a new copy (finish, condition,
  language). A new copy goes into the deck box, or Unfiled when the deck has
  none.
- **AC-16** An **Owned** tab shows the owned copies of the deck's cards in the
  card browser (spec 001/002: views, filters, sort, selection, locations).
- **AC-17** A **Missing** tab shows the missing cards with the browser's
  views, search, filters and sort, and exports them as a text list.

### Deck page

- **AC-18** The Deck tab lists cards in columns grouped by type (Commander
  first), each row with quantity, name, mana cost, ownership state and price,
  like Moxfield. Hovering a row shows the card large beside the list.
- **AC-19** Group by type, mana value or color; sort by name, mana value or
  price; switch between the list and card images.
- **AC-20** Clicking a card opens its actions: quantity, zone, preferred
  printing, mark owned, remove; ownership details with locations.
- **AC-21** The header shows format, card count against the format's size,
  value, legality and the deck box (linking to its location page).

### Legality

- **AC-22** Legality per format, with every issue listed:
  - card legality from Scryfall (banned, not legal, restricted = max 1)
  - deck size: Commander exactly 100 including commanders; Brawl exactly 60;
    constructed formats at least 60 in the mainboard
  - copies: max 4 in constructed formats, 1 in Commander and Brawl, except
    basic lands and cards that allow any number
  - sideboard at most 15
  - Commander and Brawl: a valid commander (or pair), and every card within
    the commanders' color identity
  - Casual: no rules
- **AC-23** The Maybeboard never affects legality.

### Stats

- **AC-24** A Stats tab shows: mana curve (non-land cards by mana value, 7+
  together), color pips and type counts, average mana value of non-land
  cards, and value: total, owned, and the cost of the missing cards.

### Import and export

- **AC-25** Import accepts Moxfield, Archidekt and MTGO/Arena text: lines like
  `1 Sol Ring (C21) 263`, zone headings (Commander, Deck/Mainboard,
  Sideboard, Maybeboard, optional colon) and `SB:` prefixes. A preview shows
  each zone and unrecognized lines before anything saves.
- **AC-26** "Import deck" on the Decks page creates a deck from a list (name,
  format). Import on a deck page adds to it.
- **AC-27** Export gives the decklist as text with zone headings, ready to
  paste into other tools.

### Public decks

- **AC-28** Public decks appear on the owner's profile and count for the
  directory. Visitors see the deck page, stats, legality and ownership
  states, but not location or other deck names.

## Out of scope

- Playtesting, deck recommendations (EDHREC, AI), tags and custom groups
- The want list and buying links
- Reserving specific copies for a deck beyond the deck box

## Assumptions (filled in during writing, not grilled)

- Existing Deck box locations each get a Casual deck built from their cards
  (AC-4).
- "Add to deck" from the collection adds one copy of each selected card to the
  Mainboard (AC-10); quantity and zone can be changed after.
- Basic lands and "any number of cards named" cards have no copy limit
  (AC-22).
- Brawl follows paper Brawl: 60 cards, Standard-legal (Scryfall's
  `standardbrawl`).
- A deck box created for a deck takes the deck's name (with " deck" added if
  that location name is taken).
