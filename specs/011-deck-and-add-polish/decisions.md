# Spec 011: Deck and add polish (decisions so far)

Status: Written into spec.md (2026-11-07).

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

## Round 1

- List view: a sticky card image left of the list on wide screens. It shows the
  hovered or keyboard-focused card, else the first. No hover popups in List.
  Phones: no side image.
- Arrow keys: List's side image follows focus; Text view pops the large
  preview next to the focused row; Images view adds nothing.
- Swaps: mirrored rows: [card out: name, price, image] [Swap and differences]
  [card in: image, name, price] [trash icon, tooltip Remove].
- Printing picker: a finish filter (All, Non-foil, Foil, Etched), sort
  (Newest, Oldest, Cheapest, Priciest), each printing's price under it;
  remembered.

## Round 2

- Add dialog: always full width with a fixed-height, scrolling results area;
  old results stay dimmed while loading; "No cards found" in the same space.
- Picking Foil or Etched in the filter sets the Finish field too; prices and
  Cheapest use that finish ("All" prices non-foil, or the only finish).
- The swap trash icon asks for confirmation, then a green toast.
