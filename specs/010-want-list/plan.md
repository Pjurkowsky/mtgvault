# Plan 010: Want list

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Model | New app `wants`. `WantItem`: user, `oracle_id`, `printing` (shown printing, never null), `any_printing`, `finish` (`any` or a finish), `deck` (null, `SET_NULL`), quantity, `added_at`. `User.wants_public`. |
| Merging | `wants/services.py` `add_want()` and `edit_want()` find a matching entry (same oracle, pinned printing or Any, finish, deck) under `select_for_update` and merge. No database constraint. |
| Filters | `collection/filters.apply_filters()` gains `finish_field` (price of Any = non-foil, through a `price_finish` annotation) and `collection=False` (no cart, location, condition or deck-cards filter). The want list filters `deck` itself: linked deck. |
| API | `GET/POST /api/wants/`, `GET/PATCH/DELETE /api/wants/{id}/`, `GET/PATCH /api/wants/settings/` (`is_public`), `GET /api/users/{username}/wants/`, `POST /api/decks/{id}/want-missing/` (`card` optional). Card detail gains `wanted`; deck ownership gains `wanted`; locations list gains `wants` totals; public locations list gains `wants` (null when private). |
| Lowering | `wants.services.fulfil(user, printing, finish, quantity, location)`, called by item create, import commit, scanner (not the cart), Mark owned's new copies, and `edit_item` when a row leaves the Cart. |
| Deck delete | `decks.services.delete_deck` calls `wants.services.unlink_deck(deck)` first. |
| Page | `pages/WantsPage.vue` at `/wants` and `/u/:username/wants`. `CardBrowser` gets sources `{ kind: 'wants' }` and `{ kind: 'public-wants', username }`: no selection, Scan or Import; menu Open, Edit, Add to collection, Delete; table columns Printing, Finish, Deck. |
| Dialogs | `WantDialog.vue` adds and edits entries (search, quantity, printing with Any, finish with Any, deck). `WantSection.vue` is the card dialog's entry section (a new `want` slot in `CardDetailDialog`). |
| Card dialog buttons | `CardDetailDialog` emits `add` with the card and shown printing; it posts Add to want list itself with a `wantDeck` prop. `CardBrowser` opens `AddCardDialog`; `DeckCardDetail` opens `DeckAddDialog` with a new `card` prop. |
| Add dialog | `AddCardDialog` gains `quantity` and `finish` props for Add to collection. |
| Deck marks | `OwnershipBadge` shows a `HeartIcon` when `ownership.wanted`. `DeckPage` provides `wantMissing(card?)`; `DeckCardMenu` injects it. |
| Tiles | `LocationGrid` gets a `wants` tile (HeartIcon) after Cart, linking to `wants` or `public-wants`. |

## Files

```
backend/wants/                       new app: models, services, serializers, views, urls, admin, migrations
backend/users/models.py              wants_public
backend/collection/filters.py        finish_field, collection flag
backend/collection/views.py          wants totals in locations lists; fulfil on add and import; directory
backend/collection/services.py       fulfil when a row leaves the Cart
backend/scanner/views.py             fulfil when scanning into a location
backend/decks/views.py               fulfil on Mark owned new copies; want-missing view
backend/decks/services.py            unlink wants before deleting a deck
backend/decks/ownership.py           wanted per card
backend/cards/views.py               wanted on the card detail
frontend/src/pages/WantsPage.vue     new
frontend/src/components/wants/WantDialog.vue    new: add and edit
frontend/src/components/wants/WantSection.vue   new: entry in the card dialog
frontend/src/components/browser/*    wants sources, menu, columns
frontend/src/components/collection/CardDetailDialog.vue  Add, Add to want list, want slot
frontend/src/components/collection/AddCardDialog.vue     quantity and finish props
frontend/src/components/collection/LocationGrid.vue      Want list tile
frontend/src/components/decks/*      DeckAddDialog card prop, DeckCardDetail add, OwnershipBadge heart, DeckCardMenu want
frontend/src/pages/DeckPage.vue      Add missing to want list, provide wantMissing
frontend/src/pages/ProfilePage.vue   public Want list tile
frontend/src/router/index.ts         wants routes
```

## Tests

| File | Covers |
|---|---|
| `wants.spec.ts` | AC-1 to AC-13, AC-18, AC-19 |
| `deck-wants.spec.ts` | AC-2, AC-4 (deck), AC-14 to AC-17 |
| `card-detail.spec.ts`, `cart.spec.ts`, `deck-views.spec.ts`, `deck-filters.spec.ts`, `deck-boxes.spec.ts` (updated) | buttons no longer disabled, Cart button gone |

## Order of work

1. Model, services, API, lowering, deck hooks; `check-api.sh`.
2. Want list page, tile, dialogs, public page.
3. Card dialog buttons; deck marks and menus.
4. Tests, full suite, READMEs, spec status.
