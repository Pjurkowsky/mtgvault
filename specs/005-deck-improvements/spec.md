# Spec 005: Deck improvements

Status: Approved
Depends on: 002-collection-polish, 003-scanner, 004-decks
Followed by: 006-binder-view

## Goal

Make decks work like the rest of the app: the same Add card and card
dialog as the collection, a quicker list view, swap candidates, scanning
straight into a deck, and deck boxes that behave as part of their deck.

## Terms

- **Swap candidate**: a Maybeboard card linked to the deck card it could
  replace.
- **Deck section**: the deck-only part of the card dialog (quantity, zone,
  printing, ownership, remove).

## Principle

Reuse the collection's components and behavior wherever they fit (spec 001
principle P-2). A deck page differs only where it has deck-only data.

## Acceptance criteria

### Add card and the card dialog

- **AC-1** Add card on a deck page uses the collection's Add card search
  step. The next step is the deck step (printing, quantity, zone) with an
  "Also add to my collection" checkbox, unticked by default.
- **AC-2** Ticking it shows the collection's add fields (finish, condition,
  language, location). Location starts on the deck box; a deck without a box
  starts with no location picked and needs one (Unfiled is a choice).
- **AC-3** Clicking a deck card opens the collection's card detail dialog
  (image, fullscreen, prices, your copies with edit and delete, EDHREC tabs)
  with a deck section added: quantity, zone, preferred printing, ownership
  with locations, mark owned, remove.
- **AC-4** "Add a new copy" under mark owned opens the collection's add fields
  for that card, location starting on the deck box (no location picked when
  the deck has none). It no longer adds a Near Mint copy in one click.
- **AC-5** The Commander zone is offered only for cards that can be a
  commander in the deck's format (spec 004 legality rules).

### Views and menus

- **AC-6** The Deck tab has three views:
  - **Text** (default): compact rows; the card image appears beside the
    hovered line
  - **List**: spec 004's columns with the large image of the hovered card
  - **Images**: card images grouped
  On touch screens a tap opens the card dialog in every view.
- **AC-7** Right-click (long-press on touch) on a card in any view opens a
  menu: Edit (the card dialog), Delete (after a confirm) and Propose swap.
- **AC-8** View, grouping and sort are remembered in the browser for all
  decks. Options in the URL win over remembered ones; without storage the
  defaults apply.

### Swaps

- **AC-9** Propose swap opens the Add card search. The chosen card goes to the
  Maybeboard as a swap candidate for that card. A card can have several
  candidates; Maybeboard cards don't need a link.
- **AC-10** A **Swaps** tab lists each deck card with candidates, and under
  it each candidate with: price difference, mana value difference, ownership
  state, Apply and Remove. Hovering shows the card image, as in Text view.
- **AC-11** Apply puts the candidate in the old card's zone and moves the old
  card to the Maybeboard as a candidate for the new one, so the swap can be
  undone. Remove deletes the candidate from the deck.
- **AC-12** Removing a deck card keeps its candidates in the Maybeboard,
  unlinked. Moving a candidate out of the Maybeboard drops its link.
- **AC-13** Public decks show the Swaps tab, read-only.

### Tabs and scanning

- **AC-14** The Missing tab's ⋯ menu has "Add to want list", disabled.
- **AC-15** The deck header has Scan cards next to Add card; the Owned tab has
  no scan button of its own.
- **AC-16** Scan cards first asks where cards go: any location (the deck box
  preselected), the cart, or the decklist only. The choice is remembered per
  deck, shown on the scanner and can be changed there.
- **AC-17** Scans into a location follow spec 003 (merging, result bar, +1,
  Undo) but skip the cart; scans into a deck box join the decklist (spec 004
  AC-29). Decklist-only scans add one copy to the Mainboard and no copy to the
  collection; Undo removes that copy from the list.

### Deck boxes

- **AC-18** The location dialog shows Format when the kind is Deck box,
  default Commander. Editing it changes the deck's format, and changing the
  deck's format shows in the location dialog.
- **AC-19** A deck and its box share visibility: making either public or
  private changes both.
- **AC-20** A deck box is not listed among the owner's public locations and is
  counted once in the directory, as the deck. A public deck with a box shows
  a deck box mark linking to the box's public location page.

## Out of scope

- The want list itself
- Small UI fixes from spec 004 (active top bar link, tile image loading,
  hover preview placement, no-price display)
- Phone access over the home network

## Assumptions (filled in during writing, not grilled)

- Brawl's commanders include legendary planeswalkers (AC-5).
- Text view rows show quantity, name, mana cost and ownership state; price
  stays in List view (AC-6).
- Delete from the menu removes the card from the deck, not copies from the
  collection (AC-7).
- A swap candidate counts toward nothing, like any Maybeboard card (spec 004
  AC-14).
- Shared visibility applies from now on; existing decks whose box differs take
  the deck's visibility (AC-19).
