# Plan 027: Deck versions

## Decisions

| Topic | Choice |
|---|---|
| Branches | New `DeckBranch` (deck, name, is_main, from_version, created_at); one Main per deck (partial unique constraint). A migration gives every deck a Main and points its cards at it. |
| Cards | `DeckCard` gains `branch` (cascade). `deck` stays, for deck-wide queries. Unique per (branch, oracle id, zone) instead of (deck, …). Swap pairs link cards of one branch. |
| Main everywhere else | A helper `main_cards(deck)` (`deck.cards.filter(branch__is_main=True)`) replaces `deck.cards` in Wants, collection filters, scanning, the box counts, sims (`deck_cards`, commander checks) and deck tiles. |
| Deck page API | Deck detail and every card endpoint take `?branch=<id>` (Main when missing) and check it belongs to the deck. Box and scan endpoints refuse other branches. |
| Versions | `DeckVersion` (branch, number, name, note, cards JSON, created_at). The JSON holds each card's oracle id, printing id, zone, quantity, categories and swap pairs (by position). Restore and Branch from it rebuild `DeckCard` rows from it. |
| Read-only view | `GET /api/decks/{id}/versions/{v}/` returns the same shape as deck detail with `read_only`; combos and insights take `?version=`. Public deck routes get the same parameters. |
| Compare | `GET /api/decks/{id}/compare/?a=…&b=…` where each side is `branch:<id>` or `version:<id>`: added, removed, quantity changed, moved, with printing images. |
| Fork | `POST /api/decks/{id}/fork/` (`branch` or `version` optional). `Deck.forked_from` (set null). The deck detail has `forked_from` and `fork_count`. |
| Sims seats | Seat spec gains `branch` or `version` (deck seats only). `deck_cards` reads a branch or a version. `SimSeat.label` becomes "Deck · Branch v1"; search includes it. |
| One run compare | `SimRun.variants` (JSON: label and cards per list) and `SimGame.variant`. The worker plays each variant's games with the same seat orders and seeds; results group by variant. |
| Separate runs | `SimRun.group` (uuid). `GET /api/sims/groups/{uuid}/` compares the runs; the runs list returns a group as one row. |
| Panel | `DeckVersionsPanel.vue`, built like `UnplacedSidebar` (`usePreference('deck.versions')`): branches, versions, actions menus. |
| Compare dialog | `DeckCompareDialog.vue` with two `Select`s of lists, ⇄, four groups with small images. |

## Files

| File | Change |
|---|---|
| `backend/decks/models.py`, migration | `DeckBranch`, `DeckVersion`, `DeckCard.branch`, `Deck.forked_from` |
| `backend/decks/services.py` | branch helpers, snapshot / restore, compare, fork, `main_cards` |
| `backend/decks/views.py`, `serializers.py`, `urls.py` | branch param, branches, versions, compare, fork endpoints |
| `backend/wants/`, `collection/filters.py`, `scanner/views.py`, `cards/tags.py` | Main only |
| `backend/sims/` models, migration, services, worker, serializers, views | list per seat, variants, groups |
| `frontend/src/pages/DeckPage.vue` | branch / version from the URL, read-only bar, Main-only tools |
| `frontend/src/components/decks/DeckVersionsPanel.vue`, `DeckCompareDialog.vue`, `SaveVersionDialog.vue`, `BranchDialog.vue` | new |
| `frontend/src/components/sims/SimRunForm.vue`, `SimRunCard.vue`, `SimRunList.vue`, `SimGroupPage.vue` | list dropdown, Compare versions, results per list, group page |

## Tests

| Test file | ACs |
|---|---|
| `e2e/deck-branches.spec.ts` | AC-1 to AC-6 |
| `e2e/deck-versions.spec.ts` | AC-7 to AC-11 |
| `e2e/deck-compare.spec.ts` | AC-12, AC-13 |
| `e2e/deck-fork.spec.ts` | AC-14, AC-15 |
| `e2e/sim-versions.spec.ts` | AC-16 to AC-19 |

## Order of work

1. Models and migration; Main everywhere else; branch parameter on the deck API.
2. Branches panel and branch actions.
3. Versions: save, view, restore, branch from, delete.
4. Compare dialog.
5. Public view and fork.
6. Simulations: lists per seat, Compare versions (one run, separate runs).
7. Tests, full suite, READMEs, status.
