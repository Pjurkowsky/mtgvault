# Spec 013: Optimize printings

Status: Draft
Depends on: 004-decks, 006-deck-views, 012-ownership-labels

## Goal

Buying what a deck lacks costs as little as possible: one action switches the
cards you still need to their cheapest printings.

## Acceptance criteria

- **AC-1** The deck ⋯ menu has **Optimize printings**, for the deck's owner
  only.
- **AC-2** It opens a dialog listing every card marked Missing or In other
  decks in the Commander, Mainboard or Sideboard whose cheapest printing is
  cheaper than its current one, grouped under two headings: Missing first,
  then In other decks (a heading shows only when it has rows). Each row shows:
  - a checkbox, ticked
  - the card name
  - the current printing and the cheapest one (set and number, with images on
    hover)
  - the price of each, and the saving per copy
- **AC-3** The dialog shows the deck's To buy value now and after the change,
  following the ticked rows.
- **AC-4** Apply switches the ticked cards to their cheapest printing, with a
  green toast: "Changed N printings." The deck's prices update. Unticked
  cards keep theirs.
- **AC-5** When no card would get cheaper, the menu item shows a toast instead:
  "Missing cards already use their cheapest printings."
- **AC-6** Only this deck's cards change. Other decks, deck boxes, your
  collection and want list entries stay as they are.

## Out of scope

- Cards marked Owned or Free in collection
- The Maybeboard
- Choosing a finish other than the one To buy prices (non-foil, else the
  printing's only finish)

## Assumptions (filled in during writing, not grilled)

- Prices are in the deck owner's currency, like To buy; PLN converts EUR.
- Printings without a price in that currency are never chosen.
- A tie keeps the current printing; between other equal printings, the newest.
- To buy after the change counts only the copies still missing, as To buy does.
