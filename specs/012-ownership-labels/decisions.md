# Spec 012: Ownership labels (decisions)

Status: Written into spec.md (2026-11-07).

## Request

- "in decks filters like owned doesnt work": ticking Owned shows no cards.

## Research

- The filter works as spec 004 AC-13 defines it. Owned means free copies
  elsewhere (Unfiled or another location) cover the deck. Cards already in the
  deck's box are In deck box, so a deck with a box often has no Owned cards.
- The filter code hasn't changed since v1.0.2; e2e tests pass.

## Grilling

- Keep the behaviour, rename the labels so they read as you expect:
  - In deck box → **Owned**
  - Owned → **Free in collection**
- The new names show everywhere the state shows: filter, badges, tooltips,
  the card dialog. (Chosen over widening Owned to every owned card.)
