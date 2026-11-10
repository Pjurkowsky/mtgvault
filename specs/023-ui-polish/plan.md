# Plan 023: UI polish

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Toolbar | `DeckToolbar.vue` drops `ml-auto` from the toggle block. The search box is wrapped in a Tooltip (trigger on hover and focus) with the keys text; the InfoTip goes. |
| Tokens | `DeckTokens.vue` renders a group using `GroupHeading` like the type groups: rows (Text, List) with the name only, tiles (Images) via `TokenTiles`. It moves inside each view's column flow after Maybeboard. |
| List commander | DeckPage passes commander cards to DeckList in List view; `groupDeck` gets a leading Commander group there. `DeckCommander` shows only when the layout isn't List. |
| Tiles | `LocationGrid` and DecksPage grids: `grid-cols-[repeat(auto-fill,minmax(16rem,20rem))]` and `minmax(13rem,16rem)`. DeckTile banner `h-48`. |
| Binder | `BinderSize` back to `CardSize`; preference allowed values S/M/L (old `fit` falls back to M). BinderView keeps its measuring code: pocket = min(cap from size, what fits the width and the window height less what sits above and below the pages, measured in one snapshot so it never chases itself); the browser drops its bulk-bar padding in the binder. The slots line teleports into the location header (`LocationPage`, `PublicLocationPage`). |
| Back faces | `Printing.image_back_normal/large` from `card_faces[1].image_uris`; added to `printing_fields`, `PRINTING_UPDATE_FIELDS` and the serializers that carry images. Migration. |
| Turn over | `CardImage`-like helper: the dialog image and `FullscreenCard` get a `back` image and a Turn over button (`RefreshCwIcon`) toggling which face shows. `CardPreview` takes an optional `back` and shows both faces side by side. |
| Dialog | `CardDetailDialog`: `md:grid-cols-[18rem_minmax(0,1fr)]`, dialog `md:h-[88vh] md:overflow-hidden`; left column `md:overflow-y-auto` content-start; right column `overflow-y-auto` with its own scroll. Played with: `sticky top-0` pill row (`bg-background`), groups get ids, pills call `scrollIntoView`. `EdhrecCardGrid` limit 10 with a Show all toggle; label "lift". Phone: the whole dialog scrolls, pills `sticky top-0`. |

## Files

| File | Change |
|---|---|
| `backend/cards/models.py`, `scryfall.py`, `sync.py`, `serializers.py`, migration; `decks/serializers.py` if it lists image fields | back face images |
| `backend/openapi.yaml`, `frontend/src/api/schema.d.ts` | regenerated |
| `frontend/src/components/decks/DeckToolbar.vue`, `DeckTokens.vue`, `TokenTiles.vue`, `DeckText.vue`, `DeckList.vue`, `DeckVisual.vue`, `pages/DeckPage.vue`, `lib/decks.ts` | toolbar, tokens, List commander |
| `frontend/src/components/collection/LocationGrid.vue`, `pages/DecksPage.vue`, `components/decks/DeckTile.vue` | tiles |
| `frontend/src/lib/binder.ts`, `components/CardSizeToggle.vue`, `components/binder/BinderView.vue`, `pages/LocationPage.vue` | binder |
| `frontend/src/components/collection/CardDetailDialog.vue`, `EdhrecCardGrid.vue`, `components/FullscreenCard.vue`, `components/CardPreview.vue` | dialog, Turn over |

## Tests

| File | Covers |
|---|---|
| `ui-polish.spec.ts` | AC-1 to AC-9 |
| `card-dialog-layout.spec.ts` | AC-10 to AC-14 |
| `back-faces.spec.ts` | AC-15 to AC-17 |
| Updated: binder size tests (Fit), deck-tokens, deck-commander, deck-views, card-detail and others that assert the old layout | |

## Order of work

1. Back face images (backend), Turn over and hover.
2. Deck page: toolbar, keys tooltip, tokens group, List commander.
3. Tiles and binder.
4. Card dialog.
5. Full suite, READMEs, spec status.
