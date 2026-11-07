# Plan 015: Deck tokens

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Catalog | `Printing.token_ids` (UUIDs from `all_parts` with `component == "token"`, not itself). New `cards.Token` (Scryfall id, oracle_id, name, type_line, set code, collector number, images) holding the cards the sync skips today except digital ones and art series. Migration; `sync_cards` fills both. |
| Lookup | `cards/tokens.py`: `tokens_for(printings)` resolves ids in `Token`, then `Printing` (a token part filed as a card). |
| Deck API | DeckDetail gains `tokens: [{id, oracle_id, name, type_line, image_small, image_normal, image_large, makers: [deck card ids]}]` from counted zones, one per oracle id, the first maker by name picks the art. |
| Card dialog | `GET /api/catalog/printings/{id}/tokens/` returns the same token shape without makers. `CardDetailDialog` shows them under the card text. |
| Deck view | `DeckTokens.vue` after the views on the Deck tab; tokens whose makers include a shown card; tiles reuse `CardPreview` + `ExpandButton`. |
| Export | Deck export query `tokens` (default false); `format_deck(..., tokens=…)` adds the section. `ExportDialog` option `tokens`, default off. |
| Fixture | Add real Scryfall objects: Dockside Extortionist, Krenko, Mob Boss, and their Treasure and Goblin tokens. |

## Tests

| File | Covers |
|---|---|
| `deck-tokens.spec.ts` | AC-2 to AC-8 |
| backend check via fixture sync | AC-1 (search finds no tokens) |

## Order of work

1. Catalog: model, sync, fixture.
2. Deck API, token endpoint, export; `scripts/check-api.sh`.
3. Tokens group, card dialog, export checkbox.
4. Tests, full suite, READMEs, spec status.
