# Spec 030: Products to buy

Status: Draft
Depends on: 004-decks, 013-optimize-printings, 029-forge-2-0-16

## Goal

See which sealed products hold a deck's cards: Commander precons and other fixed
decks, and booster packs with the chance that a pack has them. Open any product
to browse every card it can have, filtered like a collection.

## Terms

- **Product**: a fixed deck (Commander precon, Secret Lair drop, starter deck …)
  or a booster type of a set (Bloomburrow Play Booster, Collector Booster …).
- **Chance per pack**: the chance that one booster holds at least one of the cards.

## Acceptance criteria

### Products to buy

- **AC-1** The deck's ⋯ menu has Products to buy, for anyone who can see the deck.
  It opens a dialog with two tabs, Decks and Boosters.
- **AC-2** Filters in the dialog: Cards (Missing, the default, or All), Printing
  (Any, the default, or Chosen) and Released (Any, the default, Last year,
  Last 2 years, Last 3 years, Last 4 years). Each choice is remembered in this
  browser. Missing means missing from the deck owner's collection.
- **AC-3** Decks lists the fixed decks holding at least one of the cards, most
  cards first, each with its set, year and "N cards".
- **AC-4** Boosters lists the booster types that can hold at least one of the
  cards, highest chance per pack first, each with its set, year and the chance,
  e.g. "8% per pack".
- **AC-5** Clicking a product shows the cards it holds; in a booster each card
  shows its own chance per pack.
- **AC-6** Cards that no listed product holds are listed under Not in any product.
- **AC-7** Arena and MTGO products are never listed.

### A product's cards

- **AC-8** Each product has All cards, which opens its page at its own link
  (e.g. `/products/blb-play`). The link works on its own, signed in or not; back
  returns to the deck when opened from one.
- **AC-9** The page shows every card the product can have in the collection card
  browser: its views, card size, search and filters (colors, type, rarity, set,
  finish, price) with singles prices. Each printing is its own card.
- **AC-10** In a booster, each card shows its chance per pack and can be sorted by it.
- **AC-11** Signed in, each card shows how many copies of it you own (any
  printing), and a filter shows Owned or Not owned.

### Data

- **AC-12** Products come from MTGJSON, synced weekly; until the first sync the
  dialog says there is no product data yet.

## Out of scope

- Product prices or buy links
- Chance per booster box
- Marking the cards of the deck you came from on a product's page
- A list or search of all products

## Assumptions (filled in during writing, not grilled)

- AC-2: Chosen counts only the deck's chosen printing; Any counts every printing
  of the card. Missing uses the same copies as Export missing (cards only in
  other decks are not missing). Released counts from today. Like To buy, only
  Commander, Mainboard and Sideboard cards count, not the Maybeboard.
- AC-3: a deck card counts once however many copies the product has. Ties go to
  the newer product.
- AC-4, AC-10: the chance uses MTGJSON's pack layouts and slot weights. Packs
  never repeat a card within a slot, which the chance ignores (it slightly
  understates it). Prerelease and promo packs count as boosters. Each Jumpstart
  theme is a deck; a set's Jumpstart Booster (a random theme) is a booster.
- AC-5: a card shows once even if the product has more printings of it; in a
  booster the chance is for any of them.
- AC-9: a printing is priced and filtered by finish as non-foil when it has a
  non-foil finish, otherwise foil, otherwise etched (as To buy prices it).
- AC-7: products whose MTGJSON name or type mentions Arena or MTGO, digital-only
  deck types (Historic Brawl precons, Shandalar, Duels of the Planeswalkers) and
  sets that are online only.
- AC-10: a booster's cards show no ×1 badge, since a pack holds one of each.
- AC-12: the sync runs Sunday mornings; staff can run it by hand
  (`manage.py sync_products`). A failed sync keeps last week's data.
