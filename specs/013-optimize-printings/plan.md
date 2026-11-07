# Plan 013: Optimize printings

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Backend | `decks/optimize.py`: `cheapest_changes(deck, currency, rates)` returns, per counted card in state `missing` or `other_decks`, the cheapest priced printing of its `oracle_id` (same price rule as `decks/stats.py`), when cheaper than the current one. |
| Endpoints | `GET /api/decks/{id}/optimize/` returns `{changes: [{card, printing (current), cheapest, price, cheapest_price, saving}], to_buy}`. `POST /api/decks/{id}/optimize/` with `{cards: [ids]}` recomputes and applies those cards' changes in one transaction; returns DeckDetail. Owner only. |
| Dialog | `components/decks/OptimizeDialog.vue`: rows grouped by `ownership.state` (Missing, then In other decks) under headings, each with Checkbox, CardPreview images, Price; To buy now and after (now minus the ticked savings × missing copies); Apply. |
| Menu | `DeckPage` ⋯: Optimize printings, fetches GET first; no changes → toast (AC-5). |

## Files

```
backend/decks/optimize.py             cheapest printing per card
backend/decks/views.py, urls.py       optimize GET and POST
backend/decks/serializers.py          OptimizeChange, OptimizePreview, OptimizeApply
frontend/src/components/decks/OptimizeDialog.vue
frontend/src/pages/DeckPage.vue       ⋯ item
```

## Tests

| File | Covers |
|---|---|
| `deck-optimize.spec.ts` | AC-1 to AC-6 |

## Order of work

1. Backend service and endpoints; `scripts/check-api.sh`.
2. Dialog and menu item.
3. Tests, full suite, READMEs, spec status.
