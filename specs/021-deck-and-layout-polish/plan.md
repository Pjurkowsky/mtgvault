# Plan 021: Deck and layout polish

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Width | `AppLayout` header and `main` drop `max-w-5xl` for `px-4 sm:px-6`. Settings and Users already set `max-w-xl`. |
| Columns | DeckText `lg:columns-3 xl:columns-4 2xl:columns-5`; DeckList `lg:columns-2 2xl:columns-3`; `CARD_GRID` sizes and CardGrid gain `xl:`/`2xl:` steps. |
| Binder sizes | `POCKET_REM = { sm: 5, md: 7, lg: 9.5 }`. Binder size type `BinderSize = CardSize \| 'fit'`; CardSizeToggle takes an optional `fit` prop. BinderView computes the pocket width in rem (`pocketRem`) from the pages element's width and `window.innerHeight − top`, passes it to BinderPage instead of the size. |
| Pairs model | `DeckCard.swap_for` FK becomes `swaps_for = ManyToManyField('self', symmetrical=False, related_name='candidates')`. Data migration copies each FK. The API's `swap_for: int \| null` becomes `swap_for: int[]`. |
| Pair rules | `services.propose_pair(out, candidate)`: out not in Maybeboard, different card, idempotent (returns whether added). `move_zone` into the Maybeboard clears the card's own candidates; leaving it keeps its pairs (they're blocked). Merging moves pairs to the target, skipping self-pairs. `apply_swap(candidate, out)`: A's other candidates move to X, the pair A–X becomes X–A, zones swap. |
| Pair API | `POST /api/decks/{id}/swaps/` `{out, card?, printing?}` (card: a deck card id; printing: a new Maybeboard card); 201, or 400 "Already proposed.". `DELETE /api/decks/{id}/cards/{card_id}/swaps/{out_id}/` unpairs. `apply-swap` takes `{out}`. The old `cards/{card_id}/swaps/` (EDHREC) stays, now calling `propose_pair`. |
| Swaps UI | `DeckSwaps.vue`: Unpaired section first, then groups by out card; folding keys `unpaired` and card ids; row grid gets an action column with `border-l` (`border-t` on phones); blocked rows `bg-amber-500/10` with an `In deck` badge. `ProposeSwapDialog.vue` rewritten with Out (local search over deck cards) and In (`CardSearch` with Maybeboard matches above). `DeckCardMenu` shows Propose swap on Maybeboard cards too, emitting the card; DeckPage fills Out or In by zone. |
| Commander | `DeckCommander.vue` (images, CardPreview hover, DeckCardMenu). DeckPage wraps the views in `lg:grid-cols-[16rem_minmax(0,1fr)]` when there is a commander or the layout is List, and passes only non-commander cards to the views. DeckList drops its image column and emits `point`; DeckPage shows the pointed card in the side column. |
| Token catalog | `Token` gains `set_name`, `released_at`, `finishes` and the six price columns; `token_fields` fills them and `TOKEN_UPDATE_FIELDS` lists them. Migration. |
| Token choice | `Deck.token_printings = JSONField(default=dict)`: kind → token id. `deck_tokens(cards, chosen)` swaps in the chosen token's set, number and images and adds `kind`, `chosen`, `price` and `prices`. `POST /api/decks/{id}/token-printing/` `{kind, token \| null}`. `GET /api/catalog/tokens/{id}/printings/` lists the printings of that token's kind in `TokenPrintingSerializer` (the Printing fields the picker uses). |
| Token UI | `TokenDialog.vue` (image, price, Made by, PrintingPicker for the owner, Save and Default). `DeckTokens.vue` takes `layout`: rows for Text/List, tiles for Images. TokenTiles drops the caption and emits `open`. PrintingPicker's prop widens to the fields it reads. |
| Card dialog | `CardDetailDialog`: price line (`data-testid="detail-image-price"`) under the image for `shown` (an optional `price` prop overrides it for a deck card or copy); `Separator` between sections. DeckSection: Separators; OwnershipBadge shows "Missing N of M" and drops the "N missing" line; its TooltipContent gets `:collision-padding="8"`. |

## Files

| File | Change |
|---|---|
| `backend/decks/models.py`, migration | `swaps_for` M2M (copy data, drop FK); `Deck.token_printings` |
| `backend/decks/services.py` | `propose_pair`, `unpair`, `move_zone`, `apply_swap` |
| `backend/decks/views.py`, `serializers.py`, `urls.py` | pair endpoints, `swap_for` list, token-printing endpoint, deck tokens with choice and prices |
| `backend/cards/models.py`, `scryfall.py`, `sync.py`, `tokens.py`, `views.py`, `urls.py`, `serializers.py`, migration | token fields, prices, printings endpoint |
| `backend/openapi.yaml`, `frontend/src/api/schema.d.ts` | regenerated |
| `frontend/src/layouts/AppLayout.vue` | full width |
| `frontend/src/lib/cards.ts`, `components/browser/CardGrid.vue` | more tiles |
| `frontend/src/lib/binder.ts`, `components/CardSizeToggle.vue`, `components/browser/CardBrowser.vue`, `components/binder/BinderView.vue`, `BinderPage.vue` | sizes and Fit |
| `frontend/src/pages/DeckPage.vue`, `components/decks/DeckCommander.vue` (new), `DeckList.vue`, `DeckText.vue`, `DeckVisual.vue` | commander, side column, columns |
| `frontend/src/components/decks/DeckSwaps.vue`, `ProposeSwapDialog.vue`, `DeckCardMenu.vue`, `DeckCardDetail.vue` | pairs |
| `frontend/src/components/decks/DeckTokens.vue`, `TokenTiles.vue`, `TokenDialog.vue` (new), `components/collection/PrintingPicker.vue` | tokens |
| `frontend/src/components/collection/CardDetailDialog.vue`, `decks/DeckSection.vue`, `decks/OwnershipBadge.vue` | card dialog |

## Tests

| File | Covers |
|---|---|
| `layout-width.spec.ts` | AC-1, AC-2 |
| `binder-sizes.spec.ts` | AC-3, AC-4 |
| `deck-commander.spec.ts` | AC-5 to AC-7 |
| `deck-pairs.spec.ts` | AC-12 to AC-19 |
| `deck-token-printings.spec.ts` | AC-8 to AC-11 |
| `card-dialog-polish.spec.ts` | AC-20 to AC-22 |
| Updated: `deck-swaps.spec.ts`, `deck-add-polish.spec.ts`, `deck-tokens.spec.ts`, `deck-views.spec.ts`, binder specs | `swap_for` list, Unpair instead of Remove, tokens click, commander out of groups, sizes |

## Order of work

1. Layout width and columns.
2. Binder sizes and Fit.
3. Commander showcase and side column.
4. Pairs backend, then Swaps UI.
5. Token catalog and choice backend, then token UI.
6. Card dialog.
7. Full suite, READMEs, spec status.
