# Spec 032: Products to buy fixes

Status: Draft
Depends on: 030-products-to-buy

## Goal

Make Products to buy easier to read: precons with their commander, regular
booster packs apart from the rest, product photos, and each product's cards as
images by type, without basic lands.

## Acceptance criteria

### Tabs

- **AC-1** The dialog has four tabs, each with its count: Precons (Commander
  decks), Boosters (regular packs: Play, Draft, Set, Collector and a set's
  standard booster), Other decks and Other boosters. A tab with no products
  shows 0.
- **AC-2** Every tab ranks its products by how many of the cards they hold,
  most first, and each row says "N cards". No row shows a chance per pack.

### Rows

- **AC-3** A precon row shows its commander's card image, and the commander's
  name under the deck name; with two commanders, both.
- **AC-4** Booster and other deck rows show the product's photo; a product
  without one shows a plain placeholder.

### Cards

- **AC-5** An expanded product shows the cards it holds as images, grouped by
  type (Creatures, Instants …), in the card size picked with the card size
  toggle, remembered in this browser. Hovering a card enlarges it.
- **AC-6** In a booster each card shows its own chance per pack; in a deck a
  card with more than one copy shows ×N.

### Basic lands

- **AC-7** Basic lands are never looked for in the dialog: they don't count,
  don't show in a product and aren't under Not in any product. A product's own
  page still lists them.

## Out of scope

- Changing the product page (All cards), apart from its photo
- Prices or buy links for products

## Assumptions (filled in during writing, not grilled)

- AC-1: Precons are MTGJSON decks of type Commander Deck. A booster's type comes
  from its MTGJSON key (play, draft, set, collector, default); a pack MTGJSON
  says holds fewer than 14 cards (the Zeta Set, sample and promo packs) is an
  Other booster even with a regular key. Draft boosters of Masters sets hold 16
  or 20 cards and stay in Boosters.
- AC-2: ties go to the newer product, as before.
- AC-3, AC-4: the photo is TCGplayer's product image, found through the
  TCGplayer id MTGJSON gives each sealed product; precons with no commander
  show their photo.
- AC-5: card types in the deck page's order (Creatures, Planeswalkers, Battles,
  Instants, Sorceries, Artifacts, Enchantments, Lands, Other).
- AC-7: a basic land is a card whose type line starts with "Basic" (Plains,
  Snow-Covered Island, Wastes …).
