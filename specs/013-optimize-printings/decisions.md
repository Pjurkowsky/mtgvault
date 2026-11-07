# Spec 013: Optimize printings (decisions so far)

Status: Written into spec.md (2026-11-07).

## Request

- "add an option to the decks to optimze printings for every card which is
  missing"

## Research

- A deck card holds one printing (`DeckCard.printing`); its price and the deck's
  To buy value come from that printing: non-foil, else its first finish, in the
  deck owner's currency (`decks/stats.py`, `cards/pricing.price`).
- Changing one card's printing exists: PATCH `/api/decks/{id}/cards/{cid}/`
  with `printing` (the card dialog's printing picker).
- Ownership (`decks/ownership.py`) matches copies by `oracle_id`, so changing a
  printing never changes a card's state.
- Missing copies: `ownership[card]['missing']`; the deck ⋯ menu already has
  Export missing and Add missing to want list (spec 010).
- Printings carry USD and EUR prices per finish; PLN is EUR converted.
  Many printings have no price.
- Printing has `promo`; there's no digital flag (the catalog holds paper cards).

## Grilling (round 1, 2026-11-07)

- Q1: switch each card to its cheapest printing, priced like To buy (non-foil,
  else its only finish, in the owner's currency). Unpriced printings are
  skipped; a card with none priced stays.
- Q2: cards marked Missing or In other decks (both lack copies for this deck),
  in Commander, Mainboard and Sideboard. Only this deck's card changes; other
  decks and their boxes are never touched.
- Q3: deck ⋯ menu, "Optimize printings", owner only.
- Q4: preview dialog listing each change with checkboxes and To buy before and
  after; Apply, then a green toast.
- Q5: promos allowed.
- Q6: want list entries keep their printing.
- Q7 (asked again in detail): rows are grouped by state, Missing first, then
  In other decks, each under its own heading; no badge on the rows.
