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
  components/collection/  locations, add card, edit, card detail with EDHREC tabs (right-click
                          menu with Propose swap), import, PrintingPicker (finish filter,
                          sort and prices, remembered per browser)
  components/             shared: Price (tooltip with other currencies), ConfirmDialog
                          (useConfirm), IconButton (tooltip), CardPreview (hover, and
                          arrow keys via useCardNavigation),
                          ExpandButton + FullscreenCard, ManaSymbol
  components/browser/CardTile.vue  the grid tile, shared by the collection and the deck Images view
  components/browser/filters/      filter menu pieces, shared by the collection and deck filters
  components/decks/       deck views (text, list, images) beside a side column with the
                          commander (DeckCommander) and the List view's hovered card, with
                          card menus, toolbar (search, filters, group, sort, size),
                          Swaps tab (unpaired cards, mirrored pairs, Unpair), ProposeSwapDialog
                          (Out and In), OptimizeDialog (cheapest printings), DeckTokens (rows or
                          TokenTiles), TokenDialog (price, makers, printing picker),
                          categories (CategoryInput, CategoryDialog), add (built on
                          CardSearch, ItemFields), the deck section of the card
                          dialog, import/export, deck box, scan target, stats
                          (StatBars, DeckSalt, DeckThemes), Combos tab (DeckCombos,
                          ComboRow), legality, GroupHeading, ManaCost
  components/DestructiveButton.vue  outlined red button with a trash icon
  lib/decks.ts            formats, zones, ownership states, grouping and sorting
  lib/deckFilter.ts       deck search and filters, kept in the URL
  lib/deckStats.ts        Stats tab numbers and chart data, computed in the browser
  lib/categories.ts       category suggestions, loaded once
  composables/useCardNavigation.ts  arrow keys between cards
  components/binder/      binder view (specs 007, 009, 021): pages and spreads, pockets in S/M/L or Fit,
                          Unplaced sidebar, pagination, search matches, grid picker and
                          settings with inline section filters, move and stack dialogs,
                          scan-in-order dialog
  composables/useBinderDrag.ts  pointer drag and drop, long press, edge page turn
  lib/binder.ts           slot numbers, spreads, page widths, pagination, scan order
  lib/scanTarget.ts       where a deck's scans go, remembered per deck
  lib/theme.ts            Light/Dark/System theme, saved in the browser; index.html sets the
                          class before the app loads
  assets/mana/            Scryfall mana symbols
  scanner/                camera (exposure, zoom, focus saved per device), frame loop, sounds (unlocked on
                          the first tap anywhere), glare check, combined frames, guesses; recognition/ is
                          ported from manavault (MPL-2.0, see the root README)
  components/scanner/     result bar, guess strip, scanner settings sheet
  components/settings/    Scanner model section (staff): model source, installed version, Sync now
  components/wants/       want list (spec 010): add and edit dialog, the entry in the card dialog;
                          the page is CardBrowser with a `wants` source (pages/WantsPage.vue)
  components/ui/  shadcn-vue components (add more with the shadcn MCP or CLI)
e2e/          Playwright tests, one file per area, named by acceptance criterion
```
