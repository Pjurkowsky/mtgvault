# MTG Vault — frontend

Vue 3 + Vite + shadcn-vue, written in TypeScript.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on :5173. `/api` is proxied to Django on :8000 (`API_PROXY_TARGET` overrides it). |
| `pnpm build` | Type-check and build to `dist/` |
| `pnpm gen:api` | Regenerate `src/api/schema.d.ts` from `../backend/openapi.yaml` |
| `pnpm e2e` / `pnpm e2e:ui` | Playwright end-to-end tests (see the root README) |

## Layout

```
src/
  api/        typed API client (openapi-fetch) and generated schema types
  stores/     pinia stores (auth, locations)
  composables/  card browser state: URL query, paged loading, selection
  router/     routes and the login guard
  layouts/    AppLayout (top bar) and AuthLayout (centered card)
  pages/      one component per route
  components/browser/     the shared card browser (spec 001, principle P-2); ExportDialog
                          (fixed text box, Printings/Categories/other decks options, remembered)
  components/collection/  locations, add card, edit, card detail (two columns, the right one
                          scrolls; EDHREC tabs with sticky group pills, lift, right-click
                          menu with Propose swap), import, PrintingPicker (finish filter,
                          sort and prices, remembered per browser)
  components/             shared: Price (tooltip with other currencies), ConfirmDialog
                          (useConfirm), IconButton (tooltip), CardPreview (hover, both faces
                          of a double-faced card, arrow keys via useCardNavigation),
                          ExpandButton + FullscreenCard (Turn over), ManaSymbol
  components/browser/CardTile.vue  the grid tile, shared by the collection and the deck Images view
  components/browser/filters/      filter menu pieces, shared by the collection and deck filters
  components/decks/       deck views (text, list, images) beside a side column with the
                          commander (DeckCommander; List view lists it as a group instead)
                          and the List view's hovered card, with card menus, toolbar (search
                          with the keys tooltip, filters, group, sort, size),
                          Swaps tab (unpaired cards, mirrored pairs, Unpair, sort by name or
                          date with dates in tooltips), ProposeSwapDialog
                          (Out and In), OptimizeDialog (cheapest printings), DeckTokens (a Tokens group
                          after Maybeboard in each view), TokenDialog (price, makers, printing picker),
                          categories (CategoryInput, CategoryDialog), add (built on
                          CardSearch, ItemFields), the deck section of the card
                          dialog, import/export, deck box, scan target, stats
                          (StatBars, DeckSalt, DeckThemes), Combos tab (DeckCombos,
                          ComboRow), legality, GroupHeading, ManaCost; versions (spec 027):
                          DeckVersionsPanel (branches and versions on the right edge, like
                          Unplaced), BranchNameDialog, SaveVersionDialog, DeckCompareDialog
  components/DestructiveButton.vue  outlined red button with a trash icon
  lib/decks.ts            formats, zones, ownership states, grouping and sorting; onBranch /
                          shownList, the branch or version a deck request works on
  lib/deckFilter.ts       deck search and filters, kept in the URL
  lib/deckStats.ts        Stats tab numbers and chart data, computed in the browser
  lib/categories.ts       category suggestions, loaded once
  composables/useCardNavigation.ts  arrow keys between cards
  components/binder/      binder view (specs 007, 009, 021, 023): pages and spreads, pockets in
                          S/M/L shrunk to fit the window height, used slots in the header,
                          Unplaced sidebar, pagination, search matches, grid picker and
                          settings with inline section filters, move and stack dialogs,
                          scan-in-order dialog
  composables/useBinderDrag.ts  pointer drag and drop, long press, edge page turn
  lib/binder.ts           slot numbers, spreads, page widths, pagination, scan order
  lib/scanTarget.ts       where a deck's scans go, remembered per deck
  components/sims/        simulations (specs 024, 025, 027, 029, 031): SimQueue (admin cancel), SimRunForm
                          (seats with the tested deck, a list per deck seat, Compare versions,
                          AI profiles, seat order, Look-ahead, Forge Auto / Main / Other), OpponentPicker
                          (pool, my decks, public), SimSwapStep (unsupported cards), SimRunList
                          (All / Mine, search, run time), SimRunCard (stats, games with Forge and time,
                          games playing now, run time, Restart); replay pieces
                          (spec 026): ReplayPlayer (rows, zones), ReplayCard, ReplayZoneDialog,
                          ReplayArrows (combat), ReplaySidebar (events, settings), ReplayEvents
  pages/SimulationsPage.vue  /simulations: queue, run form, runs
  pages/SimRunPage.vue    one run's results (each list side by side in a Compare versions run)
  pages/SimGroupPage.vue  separate runs of a Compare versions, side by side
  pages/SimGamePage.vue   a game's replay: turn stepper, Play, boards, events sidebar, Log tab
  composables/useReplayPlayer.ts  stepping by event or turn, autoplay, remembered settings
  lib/replay.ts           deaths and new graveyard cards, from the board before
  lib/sims.ts             run types, AI profiles, look-ahead levels, seat modes, useForge
  lib/theme.ts            Light/Dark/System theme, saved in the browser; index.html sets the
                          class before the app loads
  assets/mana/            Scryfall mana symbols
  scanner/                camera (exposure, zoom, focus saved per device), frame loop, sounds (unlocked on
                          the first tap anywhere), glare check, combined frames, guesses; recognition/ is
                          ported from manavault (MPL-2.0, see the root README)
  components/scanner/     result bar, guess strip, scanner settings sheet
  components/settings/    staff sections: Scanner model (source, installed version, Sync now);
                          Forge (specs 029, 031: Main and Other address, key, games at once, Test)
  components/decks/ProductsDialog.vue  Products to buy (specs 030, 032): Precons, Boosters,
                          Other decks and Other boosters with photos and commanders; each
                          product's cards as images by type; cards in none
  pages/ProductPage.vue   /products/:code: every card a product can have, in CardBrowser with
                          a `product` source (chance per pack, Owned filter)
  lib/products.ts         Products to buy choices and chance labels
  components/wants/       want list (spec 010): add and edit dialog, the entry in the card dialog;
                          the page is CardBrowser with a `wants` source (pages/WantsPage.vue)
  components/ui/  shadcn-vue components (add more with the shadcn MCP or CLI)
e2e/          Playwright tests, one file per area, named by acceptance criterion
```
