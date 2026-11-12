# Decisions 028: Sort swaps by date

## Requests

1. "enable sorting by date on swaps"

## Facts found

- The Swaps tab (`DeckSwaps.vue`) sorts unpaired cards, deck-card sections and
  the proposals inside them by name only.
- A swap pair is `DeckCard.swaps_for`, an automatic many-to-many with no date.
- `DeckCard.created_at` exists (when the card joined the list) but isn't in the API.
- Versions (spec 027) save swap pairs by position, without dates.

## Round 1

1. Date: when the swap was proposed; unpaired Maybeboard cards use when they were added.
2. Control: a Name / Date dropdown plus a separate ascending / descending toggle.
3. Date sort moves everything: unpaired cards, proposals in a section, and the
   sections by their newest proposal.
4. The date shows only in a tooltip.

## Round 2

5. Swaps proposed before this change have no date: they all count as oldest,
   in name order among themselves.
6. Tooltip on the middle column: the Swap button (the ⇄ icon for others) shows
   "Proposed <date>"; an unpaired card's Pair with… shows "Added <date>".
7. Picking Date starts newest first, Name starts A→Z; the toggle flips it. Both
   remembered in this browser for all decks.
8. Versions, new branches and forks keep each swap's date. Applying a swap (the
   old card proposed back) is dated now.
