# Spec 023: UI polish (decisions so far)

Status: Written into spec.md (2026-11-10).

## Requests

1. "center the toolbar tab elements so no flex-end or smth like that"
2. "remove fit from binder view make it also the heigh of the viewport so no
   scrollbar there on desktop 1/x slots mov e to the top somewhere"
3. "location on the main menu should have some setted max width"
4. "revamp the card dialog with edhrec recommandations use some design skill to
   do this or copy the design from somewhere anything that is possible now
   should be still possible just change ui not possibilties"
5. "add a way to see a card that have a reverse"
6. "make the decks deck-tiles have more heigh so u can see commander more
   clearly maybe less width"
7. "tokens on deck lists should be same as the other types below maybeboard
   there is no need to type tresure token artifact - tresure just a tresure is
   enough"
8. "on the list dont show commander commander should be in its own category on
   the list and u showcase onlythe preview card on the side like now but
   without the commander text tab should stay the same"
9. "tooltip with keymaps for search cards should be on the search card input
   not beside on icon"

Pod simulation (from spec 022's grilling) moves to spec 024.

## Research

### The code now

| # | Where | Now |
|---|---|---|
| 1 | `DeckToolbar.vue` | Search, keys InfoTip, Filters, Group by, Sort by on the left; size toggle and view toggle pushed right with `ml-auto`. Deck tabs (`TabsList`) sit left above it. |
| 2 | `BinderView.vue`, `CardSizeToggle` | Sizes S/M/L/Fit (spec 021 AC-4). Pagination under the pages, then "used / total slots" under that. Pages don't size to the window height except in Fit. |
| 3 | `LocationGrid.vue` | `sm:grid-cols-2 lg:grid-cols-3` on a full-width page (spec 021 AC-1), so tiles get very wide. Deck grid the same. |
| 4 | `CardDetailDialog.vue` | `sm:max-w-5xl`, two columns: image (20 rem), price, reprints strip, tokens; right: copies / deck / want section, then EDHREC tabs Commanders, Played with (groups of 10), Similar in `EdhrecCardGrid`. |
| 5 | `cards/scryfall.py` | Only the front face's images are stored (`image_small/normal/large`); back faces are dropped. Needs back images from `card_faces[1].image_uris`. |
| 6 | `DeckTile.vue` | 7 rem art crop banner (`h-28`, `object-[50%_30%]`) over text; grid `sm:2 lg:3`. |
| 7 | `DeckTokens.vue` | A separate "Tokens" block after the groups, rows show name + type line ("Token Artifact — Treasure"). |
| 8 | `DeckPage.vue` | Side column holds `DeckCommander` (all views) and, in List view, the hovered card's preview. |
| 9 | `DeckToolbar.vue` | Keys help is an `InfoTip` icon next to the search box. |

### Card pages elsewhere (checked 2026-11-10)

| | Scryfall | EDHREC | Archidekt |
|---|---|---|---|
| Layout | Image · text · prints, 3 columns | Header band (image, prices, stats), tabs, full-width grid | Image with controls; pinned preview beside the deck |
| Printings | Compact table: set #, USD, EUR, TIX, ✶ foil; hover shows the print | Vendor price chips | Printing picker in card options |
| Back faces | **Turn Over** button under the image (3D flip); Rotate for split, Flip 180° for Kamigawa flip | Back face peeks behind the front on tiles | ? |
| Recommendations | None | Sections (Top Commanders, Creatures, Lands …) up to 50 each, a **sticky pill bar of jump links** with scroll-spy, sort and view controls; tiles show inclusion %, decks, **Lift** | Separate EDH Recs tab |

Moxfield couldn't be read (403, app shell only).


- Toolbar: one block, left-aligned like the tabs; the view and size toggles
  are no longer pushed to the right edge.
- Binder: Fit goes away. S/M/L stay as caps: pockets never grow past what fits
  the window, so the binder needs no page scrollbar on desktop.
- "12 / 72 slots" moves to the header line next to the card count and value.
- Tiles: location tiles at most 20 rem, deck tiles at most 16 rem; the grids
  add columns instead of stretching.

## Round 2

- Deck tiles: the commander's art crop about 12 rem tall over name and
  counts, tile at most 16 rem wide.
- Tokens: a "Tokens (n)" group after Maybeboard in Text, List and Images,
  styled like the type groups; rows show just the name. Clicking opens the
  token dialog.
- Commander: only List view changes. A "Commander" group at the top of the
  list; the side column shows only the hovered card. Text and Images keep the
  showcase.
- Back faces: a flip button on card images (dialog, fullscreen, hover
  preview). The sync stores back images.

## Round 3

- Card dialog: Scryfall-style columns. The left column stays put: image with
  Turn over, price, printings, tokens. The right column scrolls: copies / deck /
  want section first, then the EDHREC tabs.
- Printings: keep the image strip.
- Recommendations: a sticky row of group pills jumps to each Played with
  group; each group shows 10 and a Show all button. Tiles keep their numbers,
  with synergy labelled "lift" as EDHREC does now.
- No new info (no oracle text, no legality): only the layout changes.

## Round 4

- Keys help: hovering or focusing the search box shows the tooltip; the ⓘ
  icon goes away.
- Hover preview of a double-faced card: front and back side by side. Turn
  over in the dialog and fullscreen view.
- Turn over: cards with a second face image (transform, modal double-faced,
  meld, battles). Split and Kamigawa flip cards: no rotate.
- Phones: the dialog is one column (image, price, your section, printings,
  tokens, recommendations); the group pill row stays at the top while
  scrolling.
