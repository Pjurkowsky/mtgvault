# Spec 021: Deck and layout polish (decisions so far)

Status: Written into spec.md (2026-11-10).

## Requests

1. "Commander showcase"
2. "tokens also as text not images"
3. "when deleting a swap dont remove cards from the maybeboard"
4. "allow propose swap also on cards from maybeboard"
5. "all cards from maybeboard should be inside swaps they just dont have a pair
   and u can choose one"
6. "the delete should be seperated on swaps by a boarder or smth"
7. "everything is now centred in some main div allow it or add to spec that
   things can be bigger and the container should be bigger so for example
   binder view could be much much bigger and hte comannder zone for list(just a
   card preview) or text view in decks could be there instead of shifting
   everything in main container"
8. "allow tokens for print change and the text on hover should be after u open
   the card u can show also the price for token if possible"
9. "in card dialog add its price somewhere and make the ui somewhat better
   like use some seperators between things"
10. "if card is missing there is no need to say it twice like now we have
    missign then 1 missing then a tooltip that renders off"

## Research

- Every page sits in `AppLayout`'s `main` at `max-w-5xl` (1024 px); the top
  bar uses the same width. Settings and Users set their own `max-w-xl`.
- Binder pockets have fixed sizes S/M/L (4, 5.5, 7.5 rem, `POCKET_REM`); a
  spread is two pages side by side, so L in a 3×3 binder is already about
  the width of the container.
- List view (`DeckList.vue`) has a 13 rem sticky image column inside the main
  container; Text and Images views have none. The commander shows only as the
  Commander group, like any other zone.
- Swaps (`DeckSwaps.vue`) lists only Maybeboard cards whose `swap_for` points
  at a deck card. The trash icon calls `removeCard`, which deletes the card from
  the deck (`DELETE /api/decks/{id}/cards/{card_id}/`). The trash sits in the
  same row grid as the cards.
- `swap_for` is one FK per Maybeboard card: a card is a candidate for at most
  one deck card. `propose_swap` refuses Maybeboard cards being swapped *out*;
  the deck card menu hides Propose swap on Maybeboard cards.
- Tokens: the sync stores every paper token printing (`Token`, with
  `oracle_id` shared by a kind) but no prices. Scryfall token objects carry
  `prices` like cards (often null). The deck shows one tile per kind, art from
  the first maker's printing; hover shows "Made by …"; click opens full screen.
  No per-deck choice of token printing exists.
- Card dialog (`CardDetailDialog.vue`): the header shows name and
  "Set #number"; only a collection copy's details show a price. A deck card,
  want list entry or EDHREC card shows none. Sections (deck section, EDHREC
  tabs; image, reprints, tokens) are spaced with gaps, no separators.
- Deck section (`DeckSection.vue`): `OwnershipBadge show-label` ("Missing",
  with a hover tooltip repeating every detail), then the copies list with
  "N missing" again. The tooltip opens inside the dialog and can render off
  screen.

## Grilling (2026-11-10)

- Round 1:
  - Width: wide pages use the full window width (no cap).
  - Binder: S/M/L get bigger, and a new Fit size fills the width.
  - Deck tab, wide screens: a sticky left column outside the card columns,
    commander image(s) on top in every view, the List view's hovered card below
    them. No commander and not List view: no column. Phones: commander above
    the cards, no preview.
  - The commander leaves the card groups (shown only in the showcase); click
    opens its card dialog, right-click menu as now.
  - Tokens in Text and List views are text rows like cards (hover for the
    image); Images view keeps tiles.
  - Clicking a token opens a Token dialog: image, Made by, price, Change
    printing. Hover shows only the image.
  - Token printing is chosen per deck and per token kind, used in the deck
    views (public deck page too), not in Export.
  - Token prices come from the sync and show in the dialog and picker; they
    never count toward the deck value.
  - Swaps: every Maybeboard card is on the Swaps tab. Unpaired cards come
    first. A button proposes a swap between two cards: one from the deck, the
    other typed or picked from the Maybeboard.
  - A Maybeboard card can pair with several deck cards.
  - Delete on a swap row removes only the pair (unpair), never the card.
- Round 2:
  - Applying X for A keeps X's pair with B; that row is marked blocked
    (see round 3) instead of dropped. A's other candidates move to X, A goes
    to the Maybeboard paired with X (as now).
  - Unpaired folds open and closed, remembered per deck in this browser.
  - One Propose swap dialog with Out (deck card) and In (any card, Maybeboard
    first) fields; it opens from a Swaps tab button, a deck card's menu (Out
    filled), a Maybeboard card's menu and an Unpaired row's Pair with… (In
    filled). Proposing an existing pair does nothing and says so.
  - Unpair asks to confirm.
- Round 3:
  - A blocked pair (its In card is in the deck) is tinted amber with an
    "In deck" tag and a disabled Swap; it works again once the card is back in
    the Maybeboard.
  - Binder S/M/L grow about 30% (5 / 7 / 9.5 rem); Fit makes the spread fit
    the window width and height. Default stays M.
  - Columns grow with the width: Text 3/4/5 at 1024/1280/1536 px, List 3 at
    1536 px, tile grids add tiles. The top bar spans the full width.
  - Token printings are picked with PrintingPicker (finish filter, sort,
    prices), adapted for tokens.
- Round 4 (card dialog):
  - A price line under the big image for the printing shown, in every card
    dialog; it follows the picked reprint.
  - Separator lines between sections: image | reprints | tokens on the left;
    deck/copies/want section | EDHREC tabs on the right; inside the deck
    section ownership | quantity, zone, categories | Remove and Save.
  - Ownership shows once ("Missing 1 of 2"), no separate "N missing" line; the
    badge keeps its tooltip but it must stay on screen.
- Mid-build (2026-11-10): "when propsing a swap between lands it should only
  account for one land not all". Applying a swap replaces one copy: 30 Islands
  swapped for a Plains leave 29 Islands and 1 Plains, with one Island in the
  Maybeboard paired with the Plains.
