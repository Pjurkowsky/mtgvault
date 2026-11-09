# Spec 021: Deck and layout polish

Status: Draft
Depends on: 005-deck-improvements, 006-deck-views, 009-binder-polish, 011-deck-and-add-polish, 012-ownership-labels, 015-deck-tokens

## Goal

Use the whole window, show the commander, make swaps work from either side
without losing Maybeboard cards, and make tokens and the card dialog more
useful.

## Acceptance criteria

### Layout

- **AC-1** Pages use the full window width, with a 16 px side gutter (24 px
  from 640 px up). The top bar spans the same width. Settings and Users keep
  their narrow centered column.
- **AC-2** Columns grow with the width. Text view: 3 columns from 1024 px, 4
  from 1280 px, 5 from 1536 px. List view: 2 from 1024 px, 3 from 1536 px.
  The collection grid and the deck Images view add tiles on wider screens.

### Binder

- **AC-3** Binder pockets are about 30% bigger: S 5 rem, M 7 rem, L 9.5 rem.
- **AC-4** The binder size toggle has a fourth size, **Fit**. Its pockets are
  sized so the shown page, or the spread, fits both the width and the height
  of the window. Facing pages show only when two pages fit at least S
  pockets; on a phone, Fit shows one page. Fit is remembered like the other
  sizes. The default stays M.

### Commander

- **AC-5** A deck with Commander cards shows them as large images in a
  sticky column to the left of the cards, from 1024 px up. Partners stack.
  Clicking one opens its card dialog; right-click opens the same menu as
  in the lists. On narrower screens the images sit above the cards, side by
  side.
- **AC-6** Commander cards no longer appear in the card groups of any view
  (Text, List, Images). Search and filters never hide the showcase.
- **AC-7** In List view the hovered or focused card's large image shows in the
  same left column, below the commander. The list's own image column goes
  away. Without a commander, the column shows only in List view; Text and
  Images views then use the full width.

### Tokens

- **AC-8** In Text and List views the Tokens group lists tokens as text rows:
  name and type line, matching the card rows. Hovering a row shows the token's
  image. The Images view keeps the token tiles.
- **AC-9** Hovering a token (row or tile) shows only its image. Clicking it
  opens the **Token** dialog: the large image (click for full screen), its
  price under the image, and **Made by** listing the deck cards that make
  it.
- **AC-10** The deck's owner can change a token's printing in the dialog with
  the printing picker (finish filter, sort, prices), listing every printing
  of that token. **Save** keeps the choice; **Default** goes back to the first
  maker's art. The choice is per deck and per kind of token, and every deck
  view and the public deck page show it. Visitors see no picker. Export does
  not change.
- **AC-11** Token prices come from the card sync. They show in the user's
  currency, with the others in the hover tooltip, and as "–" when Scryfall has
  none. They never count toward the deck value or stats.

### Swaps

- **AC-12** The Swaps tab lists every Maybeboard card. **Unpaired** comes first:
  the Maybeboard cards that are in no pair, sorted by name, each with a
  **Pair with…** button. After it comes one group per deck card with its
  proposed swaps, as now. Every section folds open and closed, and the
  choice is remembered per deck in this browser.
- **AC-13** A Maybeboard card can be paired with several deck cards. It shows
  under each of them.
- **AC-14** The owner sees a **Propose swap** button on the Swaps tab. It
  opens the Propose swap dialog with two fields:
  - **Out**: searches the deck's Commander, Mainboard and Sideboard cards.
  - **In**: searches all cards, with the deck's matching Maybeboard cards
    listed first.

  A picked In card that isn't in the Maybeboard joins it at its newest
  printing. Proposing a pair that already exists changes nothing and says
  "Already proposed."
- **AC-15** The same dialog opens from:
  - a deck card's **Propose swap** menu item, with Out filled in;
  - a Maybeboard card's **Propose swap** menu item, with In filled in;
  - an Unpaired card's **Pair with…** button, with In filled in.

  The EDHREC swap in the card dialog works as before.
- **AC-16** Each pair row ends with an **Unpair** button in its own column,
  set off by a border (on the left of the column on wide screens, on top on
  phones). Unpair asks to confirm. It removes only the pair: the card stays
  in the Maybeboard, under Unpaired if that was its last pair.
- **AC-17** Applying a swap of X for A puts X in A's zone at A's quantity.
  A moves to the Maybeboard, paired with X so the swap can be undone, and
  A's other proposed cards become proposals for X. X's pairs with other deck
  cards stay.
- **AC-18** A pair whose In card is not in the Maybeboard (it went into the
  deck) is tinted amber and tagged **In deck**, with the tooltip "X is
  already in the deck". Its Swap button is disabled, and Unpair still works.
  Once X is back in the Maybeboard the pair works again.
- **AC-19** A public deck's Swaps tab is read only: it has no Propose swap,
  Swap, Unpair or Pair with buttons.

### Card dialog

- **AC-20** Every card dialog (collection, deck, want list and EDHREC cards)
  shows a price line under the big image for the printing shown. It follows
  the reprint picked. The price is that of a collection copy's finish, or the
  price a deck counts; otherwise non-foil, else the only finish. The other
  currencies show in the tooltip.
- **AC-21** Separator lines split the dialog's sections:
  - left column: image and price, reprints, tokens;
  - right column: the deck, copies or want section, then the EDHREC tabs;
  - inside the deck section: ownership, then quantity, zone and categories,
    then Remove and Save.
- **AC-22** A deck card's ownership shows once. With cards missing, the label
  reads "Missing 1 of 2" and the copies list has no separate "1 missing"
  line. The badge's hover tooltip stays inside the window.

## Out of scope

- Export of chosen token printings
- Owning tokens in the collection
- Deleting Maybeboard cards from the Swaps tab (the Deck tab menus do it)

## Assumptions (filled in during writing, not grilled)

- AC-1: Login and sign up keep their centered card. Profile, Decks and Wants
  are wide pages like the rest.
- AC-4: Fit uses the space between the page's top edge and the window's bottom.
  A binder taller than the window at S size still scrolls.
- AC-5: the side column is 16 rem wide. On phones the commander images are
  10 rem wide.
- AC-7: a token row hovered in List view shows its own hover image rather than
  the side column's.
- AC-10: "Kind" is the token's oracle id, or its name when it has none
  (as in spec 015). The picker lists the printings that share it.
- AC-13, AC-17: moving a deck card into the Maybeboard by hand still drops
  the pairs it is the Out card of (spec 005, AC-12). Removing a card drops
  all of its pairs.
- AC-14: Out and In can't be the same card. Picking an Out card that is
  already a proposal of In (the reverse pair) is allowed.
- AC-20: a card from an EDHREC tab shows the price of the printing shown.
- AC-22: other states keep their label alone ("Owned", "Free in collection",
  "In other decks").
