# Spec 023: UI polish

Status: Done
Depends on: 002-collection-polish, 006-deck-views, 015-deck-tokens, 021-deck-and-layout-polish
Followed by: 024 (pod simulation, not written yet)

## Goal

Tidier deck and binder pages, tiles that suit wide screens, a card dialog laid
out like Scryfall's with easier EDHREC browsing, and a way to see the back of
double-faced cards. Nothing that works now goes away.

## Terms

- **Back face**: the second face image Scryfall gives transform, modal
  double-faced, meld and battle cards.
- **Group pills**: the row of buttons that jump to the Played with groups.

## Acceptance criteria

### Deck page

- **AC-1** The deck toolbar is one left-aligned block under the tabs: search,
  filters, group, sort, then the size and view toggles. Nothing is pushed to
  the right edge.
- **AC-2** The keys help (/, Escape, arrows, Enter) shows as a tooltip when
  the deck search box is hovered or focused. There is no separate ⓘ icon.
- **AC-3** Tokens show as a "Tokens (n)" group after Maybeboard in Text,
  List and Images, styled like the type groups. A token row shows only its
  name ("Treasure"). Clicking a token opens the token dialog as before.
- **AC-4** In List view the commander is a "Commander" group at the top of the
  list, and the side column shows only the hovered card's preview. Text and
  Images keep the commander in the side column.

### Tiles

- **AC-5** Location tiles are at most 20 rem wide and deck tiles at most
  16 rem; wider windows get more columns.
- **AC-6** A deck tile shows the commander's art about 12 rem tall above the
  name, format and counts.

### Binder

- **AC-7** The binder size toggle is S, M, L. Fit is gone; a saved Fit falls
  back to M.
- **AC-8** On desktop, pockets never get bigger than what lets the shown page
  or spread, with its page numbers, fit in the window: no page scrollbar. S,
  M and L are the largest sizes they reach.
- **AC-9** "12 / 72 slots" shows in the binder's header line after the card
  count and value, not under the pages.

### Card dialog

- **AC-10** On desktop the dialog has two columns. The left one (image, Turn
  over, price, printings strip, tokens) stays in place while the right one
  scrolls: the copies, deck or want section first, then the EDHREC tabs.
- **AC-11** Played with has a row of group pills that stays at the top of the
  right column while it scrolls; a pill scrolls to its group. Each group shows
  10 cards and a Show all button.
- **AC-12** Recommendation tiles keep their numbers; the synergy number is
  labelled lift.
- **AC-13** On phones the dialog is one column: image, price, the section,
  printings, tokens, then the tabs. The group pills stay at the top while
  scrolling.
- **AC-14** Everything the dialog does now still works: picking a printing,
  fullscreen, Back, Edit, Delete, Add, want list, deck section, Propose swap,
  tokens.

### Back faces

- **AC-15** The card sync keeps the back face images of cards that have them.
- **AC-16** A card with a back face has a Turn over button under its image in
  the card dialog and in the fullscreen view; it shows the other face, and
  pressing it again turns it back.
- **AC-17** Hovering a card with a back face shows the front and the back side
  by side.

## Out of scope

- Oracle text and legality in the card dialog
- Rotating split cards or turning Kamigawa flip cards
- Sorting or a list view for recommendations
- The commander showcase in Text and Images

## Assumptions (filled in during writing, not grilled)

- AC-1: on phones the toolbar wraps as now.
- AC-3: in Images view token tiles look like card tiles, without prices.
- AC-8: phones keep a scrollable page with one page at full width.
- AC-11: the pills show only on Played with (the other tabs are one grid).
- AC-15: the back face of a printing is its own image; a card whose two faces
  share one image (split, flip, adventure) has none.
