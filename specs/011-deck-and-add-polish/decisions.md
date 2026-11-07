# Spec 011: Deck and add polish (decisions so far)

Status: Grilling (2026-11-07). Written into spec.md when done.

## Requests

- Fix the deck List view: it should look like Moxfield, with the card preview
  side by side with the list (it disappeared)
- Moving with the arrow keys onto a card should preview it
- Swap cards symmetrical: the remove button just an icon, as a 4th section at
  the end of the row
- The Add dialog's search jumps while loading and when results change: keep a
  constant width
- Filters for printings, for example by price, selectable; and foil, non-foil
  and so on

## Research

- Spec 006 AC-2 removed the List view's sticky side image (13rem, left of the
  list, following hover and focus) in favour of hover popups (commit 110785d).
- Arrow keys (`useCardNavigation`) move focus between `data-deck-card`
  elements; the hover popup (`CardPreview`) opens on pointer hover only.
- Swaps tab: out card, a middle column (Swap, price and mana value
  differences), the candidate with an outlined "Remove" button after it.
- `CardSearch` results render only once loaded, and the dialog
  (`sm:max-w-3xl`) sizes to its content, so it grows and shrinks.
- `PrintingPicker` (Add card, deck Add, Edit, want list) lists every printing
  newest first, with no filter; printings carry prices per finish.
