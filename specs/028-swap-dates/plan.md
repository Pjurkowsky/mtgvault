# Plan 028: Sort swaps by date

## Decisions

| Topic | Choice |
|---|---|
| Pair dates | `DeckCard.swaps_for` gets an explicit through model `DeckSwap` (candidate, out, `created_at` null for old pairs, default now). A migration copies the existing pairs with no date. |
| Moves and merges | `move_zone` copies pair rows with their dates instead of `.add()`. `apply_swap` dates the pair back now. |
| Versions | The snapshot keeps `swap_dates` (position → ISO date) next to `swaps_for`; `write_list` and `version_cards` use it. Old snapshots have none. |
| API | `DeckCard` gains `added_at` and `swap_dates` (`{out card id: date or null}`). |
| Sorting | `DeckSwaps.vue` sorts with `usePreference('deck.swapSort')` (name, date) and `'deck.swapDir'` (asc, desc); switching the dropdown resets the direction. |
| Tooltip | `Tooltip` around the Swap button / ⇄ icon and Pair with… (a span, so a disabled button still shows it). |

## Files

| File | Change |
|---|---|
| `backend/decks/models.py`, migration | `DeckSwap` through model |
| `backend/decks/services.py` | moves and merges keep dates |
| `backend/decks/versions.py` | dates in snapshots |
| `backend/decks/views.py`, `serializers.py` | `added_at`, `swap_dates` |
| `frontend/src/components/decks/DeckSwaps.vue` | sort controls, date sort, tooltips |

## Tests

| Test file | ACs |
|---|---|
| `e2e/deck-swap-dates.spec.ts` | AC-1 to AC-5 |

## Order of work

1. Through model, migration, services, versions, API.
2. Sort controls and tooltips.
3. Tests, full suite, READMEs, status.
