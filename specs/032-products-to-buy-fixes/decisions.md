# Decisions 032: Products to buy fixes

Depends on: 030-products-to-buy

## Requests

1. "i want to see there cards by categories"
2. "dont include basic lands"
3. "i want to see the cards there"
4. "i assume that decks are precons so they should have an commander visible"
5. "by boosters i mostly wanted to see a 14/15 booster packs"
6. "dont include % per pack"
7. "some image of the booster would be nice here"

## Research

- MTGJSON `sealedProduct` per set: booster packs have `subtype` (play, collector,
  draft, set, default, promotional, other …), `cardCount` (Play 14, Collector 15,
  Draft/Set 15; sample, promo and value packs 2 to 7), `contents.pack[].code`
  linking to the `booster` key, and `identifiers.tcgplayerProductId`.
- TCGplayer serves a product photo at
  `https://tcgplayer-cdn.tcgplayer.com/product/<id>_200w.jpg` (checked: 200, jpeg).
- MTGJSON decks have `commander` and `sealedProductUuids`, which link precons
  to a sealed product with a TCGplayer id too.
- Deck page groups by type, mana value, color or category (`lib/decks.ts`).

## Round 1

1. Boosters: "14/15 first and other tab for the others": 14/15-card packs in
   Boosters, every other booster type in its own tab.
2. Booster rows show "N cards", most first; the expanded list keeps each card's
   chance per pack.
3. Expanded cards: images, grouped by card type.
4. Decks: "maybe also other tabs for precons just": Commander precons in their
   own tab, other fixed decks apart.

## Round 2

1. Four tabs: Precons (Commander decks) · Boosters (14/15-card packs) ·
   Other decks · Other boosters. Each with its count; empty tabs show 0.
2. Basic lands are left out of the dialog only; a product's page shows them.
3. Rows: boosters and other decks show the product photo (TCGplayer via
   MTGJSON); precons show their commander's card image, its name under the deck
   name, partners both. No photo: a placeholder.
4. Expanded cards: the collection's card size toggle, remembered; chance per
   pack on booster cards (from round 1).
