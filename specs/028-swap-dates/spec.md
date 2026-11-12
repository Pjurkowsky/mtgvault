# Spec 028: Sort swaps by date

Status: Draft
Depends on: 005-deck-improvements, 021-deck-binder-polish, 027-deck-versions

## Goal

See the newest swap ideas first: sort the Swaps tab by when each swap was
proposed, not only by name.

## Terms

- **Proposed date**: when a card was proposed to replace a deck card.
- **Added date**: when a card joined the deck's list.

## Acceptance criteria

### Sorting

- **AC-1** The Swaps tab has a sort dropdown (Name, Date) and a direction toggle
  beside Propose swap. Picking Date starts newest first, Name starts A→Z; the
  toggle flips it. The choice is remembered in this browser for all decks, and
  people viewing someone's public deck can sort too.
- **AC-2** Sorted by date, the proposals under a deck card follow their proposed
  date, the deck cards' sections follow their newest proposal, and unpaired
  Maybeboard cards follow their added date.
- **AC-3** Swaps proposed before this change have no date: they count as the
  oldest, in name order among themselves.

### Dates

- **AC-4** Hovering a proposal's Swap button (the ⇄ icon for others) shows
  "Proposed Nov 12, 2026"; hovering an unpaired card's Pair with… shows
  "Added Nov 12, 2026". A swap with no date shows no tooltip.
- **AC-5** Saved versions, new branches, restores and forks keep each swap's
  date, and so do cards merged by a zone move. Applying a swap proposes the old
  card back, dated now.

## Out of scope

- Sorting by price or mana value difference
- Showing dates on the rows themselves

## Assumptions (filled in during writing, not grilled)

- AC-2: ties (same date) fall back to name order. Name descending is Z→A for
  sections, proposals and unpaired cards alike.
- AC-5: versions saved before this change restore their swaps without dates.
