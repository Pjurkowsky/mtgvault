# Plan 031: Pick the Forge, see where and how long games played

## Decisions

| Topic | Choice |
|---|---|
| Roles | `ForgeServer.role` values `main` (this server) and `other`. A migration renames existing rows (`main` → `other`, then `fallback` → `main`) and `SimGame.forge_server` the same way. `FORGE_URL` fills Main. |
| Forge choice | `SimRun.forge` (`auto`, `main`, `other`, default `auto`; old runs `auto`). |
| Dispatcher | `tick` fills free slots per Forge: Main and Other each take runs whose choice is theirs, Auto runs go to Other while it answers, otherwise Main. A chosen Forge that doesn't answer fails its queued and playing runs (AC-4). `ForgeUnreachable` on a chosen run fails it instead of requeuing. |
| Live games | New `SimPlaying` (run, number, role, url, started_at) written on claim, deleted when the game ends; `recover()` clears it. |
| Game time and place | `SimGame.forge_url` saved per game; the API adds `forge_url` and `duration_ms` per game, and `playing` (number, url, role, started_at) per run. |
| Run time | The API adds `games_ms` (sum of game times); `started_at` and `finished_at` already exist. The frontend formats both. |
| Restart | `POST /api/sims/runs/{id}/restart/` `{forge}`: owner only, failed or cancelled runs; status back to Queued, error and cancel flags cleared, `finished_at` empty. |
| UI | `SimRunForm.vue` ToggleGroup (`usePreference('sims.forge')`); `SimRunCard.vue` rows, live rows, header time, Restart dialog; `SimRunList.vue` run time; `ForgeServersCard.vue` order and names. |

## Files

| File | Change |
|---|---|
| `backend/sims/models.py`, migration | roles, `SimRun.forge`, `SimGame.forge_url`, `SimPlaying` |
| `backend/sims/forge.py` | `servers()` / `active()` with the new roles, a server by role |
| `backend/sims/worker.py` | per-choice dispatch, failures, live games |
| `backend/sims/services.py`, `views.py`, `serializers.py`, `urls.py` | `forge` on start, restart, new fields |
| `frontend/src/lib/sims.ts` | Forge choices, time formatting |
| `frontend/src/components/sims/SimRunForm.vue`, `SimRunCard.vue`, `SimRunList.vue` | toggle, rows, times, Restart |
| `frontend/src/components/settings/ForgeServersCard.vue` | Main and Other |
| `frontend/e2e/sim-forge-servers.spec.ts`, `sim-lookahead.spec.ts` | updated for the new names (spec 031, AC-1) |

## Tests

| Test file | ACs |
|---|---|
| `e2e/sim-forge-choice.spec.ts` | AC-2 to AC-6 |
| `e2e/sim-game-time.spec.ts` | AC-7 to AC-9 |
| `e2e/sim-forge-servers.spec.ts` (updated) | AC-1, AC-3 |

## Order of work

1. Roles rename, models, migration, forge client.
2. Dispatcher with the Forge choice, live games, restart; API.
3. Run form toggle, run page rows and times, list times, Restart, Settings names.
4. Tests, full suite, READMEs, status.
