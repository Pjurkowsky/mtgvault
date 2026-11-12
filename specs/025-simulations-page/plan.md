# Plan 025: Simulations page

## Decisions

| Topic | Choice |
|---|---|
| Tested deck | `SimRun.deck` becomes nullable: set for a player's deck, null when the tested deck is a pool deck. Seat 0 keeps the copy and the source either way. |
| Who cancelled | `SimRun.cancelled_by` (user, null). Set by every cancel; the UI names it only when it isn't the runner (AC-15). |
| Search | `SimRun.search`: lower-cased deck names and commander names of every seat, filled when the run starts, backfilled by the migration. The list filters `search__icontains`. |
| Visibility | `services.visible_runs(user)`: staff see all; others see runs with no deck, a public deck, or their own deck (AC-10, AC-12). Every run endpoint goes through it. |
| API | `GET /api/sims/runs/?mine&q&offset` returns `{results, total}` of compact rows (`RunRowSerializer`). `POST /api/sims/runs/` starts a run with any visible deck or pool deck in seat 0. `POST /api/sims/queue/cancel/` (staff) cancels everything. `GET /api/decks/{id}/sims/` and `POST` go. |
| Queue | Entries gain `visible` and `can_cancel`; `deck_name` is "Private deck" when not visible. |
| Permissions | All `/api/sims/` views but `status` need a login (AC-1). `cancel_run` allows the runner or staff; `delete_run` stays runner only. |
| Frontend routes | `simulations` `/simulations`, `sim-run` `/simulations/:run`, `sim-game` `/simulations/:run/games/:number`, all `requiresAuth`. The deck-based and `/u/...` sim routes go. |
| Top bar | `AppLayout` shows Simulations for a logged-in user when `useForge()` is true. |
| Page | `SimulationsPage.vue`: `SimQueue`, `SimRunForm`, `SimRunList`. Polls every 3 s while the queue or a listed run is active. |
| Run page | `SimRunPage.vue` wraps `SimRunCard`; polls while active; Delete returns to Simulations. |
| Form | `SimRunForm` loses its `deck` prop; seats start empty; one seat carries `tested`. `OpponentPicker` takes a title, drops "Add this deck to pool", and gets an Add to pool button on My decks and Public decks rows. |

## Files

| File | Change |
|---|---|
| `backend/sims/models.py`, migration `0002` | `deck` nullable, `cancelled_by`, `search`; backfill `search` |
| `backend/sims/services.py` | `visible_runs`, `start_run(user, seats, …)` with any seat 0, `run_search`, `cancel_run` for staff, `cancel_all` |
| `backend/sims/serializers.py` | `RunRowSerializer`, `RunPageSerializer`; run data gains `can_cancel`, `cancelled_by`; queue entries gain `visible`, `can_cancel` |
| `backend/sims/views.py`, `urls.py` | runs list and start, cancel all, logins, queue privacy; deck runs view goes |
| `frontend/src/router/index.ts` | new routes, old ones go |
| `frontend/src/layouts/AppLayout.vue` | Simulations item |
| `frontend/src/pages/SimulationsPage.vue`, `SimRunPage.vue` | new |
| `frontend/src/components/sims/SimRunList.vue` | new: switch, search, rows, Show more |
| `SimQueue.vue`, `SimRunForm.vue`, `OpponentPicker.vue`, `SimRunCard.vue`, `SimGamePage.vue` | as above |
| `frontend/src/pages/DeckPage.vue`, `components/sims/DeckSimulate.vue` | tab and component go |
| `frontend/src/lib/sims.ts` | `RunRow` type |

## Tests

| Test file | ACs |
|---|---|
| `e2e/sim-page.spec.ts` (new) | AC-1, AC-2, AC-6 to AC-12 |
| `e2e/sim-admin.spec.ts` (new) | AC-13 to AC-15 |
| `e2e/sim-pod.spec.ts`, `sim-pool.spec.ts`, `sim-unsupported.spec.ts` | AC-3 to AC-5 (spec 024's pod tests, moved to the page) |
| `e2e/sim-runs.spec.ts`, `sim-replay.spec.ts` | spec 024's run and replay tests on the new pages; AC-8, AC-9 |
| `e2e/sim-availability.spec.ts` | replaced by `sim-page.spec.ts` |

## Order of work

1. Backend: model, migration, services, API; `check-api.sh`.
2. Routes, top bar, Simulations page, run page, list; deck tab goes.
3. Form and picker changes.
4. Queue privacy and admin cancel.
5. Tests moved and new ones; screenshots at desktop and phone width.
6. Full suite, READMEs, status.
