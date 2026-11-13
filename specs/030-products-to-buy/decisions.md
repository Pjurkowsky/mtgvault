# Spec 030: Products to buy (decisions so far)

Status: Written into spec.md (2026-11-14).

## Requests

- "fetch from somewhere what booster packs to buy to collect the cards in the deck"
- "i would like a option in decks for that"

## Research

- **MTGJSON** (free, MIT). One file per set (`/api/v5/BLB.json`) or all sets in
  `AllPrintings.json.xz` (100 MB, updated daily).
  - `booster`: each pack type of a set (BLB: play, collector, value, prerelease,
    promo …), its slot counts (Play: 7 common, 3 uncommon, 1 rare/mythic, 1 land,
    1 foil, 1 wildcard; 12 in 800 packs have a Special Guest) and each card's
    weight per slot. Maha, Its Feathers Night: about 1 in 140 Play Boosters in the
    rare slot.
  - `sealedProduct`: products to buy (booster box = 36 Play Boosters, bundle,
    Commander decks …) with contents and a TCGplayer link. No product prices.
  - Fixed decks (3,154: 206 Commander decks, 792 Secret Lair drops, Jumpstart,
    starter decks …) in `DeckList.json`, each list in `decks/<file>.json`
    (all of them: `AllDeckFiles.tar.xz`, 149 MB).
  - Every MTGJSON card has its Scryfall id, so it maps onto our `Printing`.
- **Scryfall** `booster` flag per printing: whether it is opened in boosters. All
  12 newest Sol Ring printings are `false` (precon only): Commander staples
  mostly come from precons, not packs.
- **Code now**: `deck_ownership` gives each card's state (in box, owned, in other
  decks, missing). Optimize printings and To buy treat "missing" and "only in
  other decks" as lacking. Deck actions live in the deck's ⋯ menu (Export missing,
  Add missing to want list, Optimize printings).
- **Other tools**: one r/EDH site matches decks to boosters (ignores the chosen
  printing). The rest (MageFinder, importers) find singles, not products.

## Round 1

- Where: a "Products to buy" item in the deck's ⋯ menu opens a dialog.
- Cards: a filter in the dialog; missing cards by default.
- Products: fixed decks (precons, Secret Lair drops, starter decks) and every booster type.
- Printing: an option, any printing (default) or the chosen printing.

## Round 2

- Card filter: Missing (default) or All.
- Layout: two tabs. Decks ranked by how many of the cards each has; Boosters by
  expected cards per pack. Clicking a product shows its cards (boosters: each
  card's chance per pack).
- Prices: none, and no buy link.
- Age: all paper products by default, with an option to hide older ones.
  Arena and MTGO products are left out.

## Round 3

- Age option: a dropdown with Any (default), Last year, Last 2 years, Last 3 years, Last 4 years.
- Booster number: the chance that one pack has at least one of the cards.
- Cards in no product: listed at the bottom ("Not in any product").
- Who: everyone who can see the deck. Missing means missing from the owner's collection.

## Round 4

- Box odds: per pack only; each card shows its own chance per pack.
- Products with none of the cards are hidden.

## Round 5 (added: every card a product can have)

- Request: "add option to also click the booster and see all cards that this
  booster can have and be able to filter those cards like in collections"
- Booster cards: its own page with the collection card browser (views, size,
  filters); back returns to the deck.
- Decks (precons, Secret Lair drops) get the same page.
- Filters: all the collection ones, with singles prices on the cards.
- Extras: each card's chance per pack (and a sort by it), and an owned mark
  with an Owned / Not owned filter. No "in this deck" mark.

## Round 6

- Printings: each printing is its own card with its own chance per pack.
- Owned mark: counts any printing of the card you own.
- Link: each product page has a link that works without a deck (e.g. /products/blb-play).
