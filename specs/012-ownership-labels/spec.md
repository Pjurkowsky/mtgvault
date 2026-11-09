# Spec 012: Ownership labels

Status: Done
Followed by: 021-deck-and-layout-polish
Depends on: 004-decks, 006-deck-views

## Goal

The deck ownership states read as you expect: Owned is what's in the deck box.

## Acceptance criteria

- **AC-1** The four ownership states of spec 004 AC-13 are named:
  - **Owned**: enough copies are in this deck's box (was In deck box)
  - **Free in collection**: free copies cover the rest (was Owned)
  - **In other decks** and **Missing**, unchanged
- **AC-2** The new names show in the deck's Ownership filter, the ownership
  badges and their tooltips, and the card dialog's deck section.

## Out of scope

- Which cards each state matches (spec 004 AC-13 stands)
- The Stats tab's Owned value

## Assumptions

- A deck without a box has no Owned cards; its free copies are Free in
  collection, as before.
