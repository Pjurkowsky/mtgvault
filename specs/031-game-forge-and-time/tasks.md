# Tasks 031: Pick the Forge, see where and how long games played

## Backend

- [x] **T1 Main and Other roles, migration of saved Forges and games; `SimRun.forge`, `SimGame.forge_url`, `SimPlaying`** (AC-1, AC-2, AC-7, AC-8)
- [x] **T2 Dispatcher: Auto / Main / Other, chosen Forge not answering fails the run, live games** (AC-3, AC-4, AC-8)
- [x] **T3 API: `forge` on start, restart, game `forge_url` and `duration_ms`, run `playing` and `games_ms`; `scripts/check-api.sh`** (AC-2 to AC-9)

## Frontend

- [x] **T4 Run form toggle; Settings Main and Other** (AC-1, AC-2)
- [x] **T5 Run page: Forge and time per game, live games, run time, Forge choice in the tooltip, Restart; list run time** (AC-5 to AC-9)

## Tests and finish

- [x] **T6 e2e tests for AC-1 to AC-9, older Forge tests updated; screenshots at desktop and phone width** (AC-1 to AC-9)
- [x] **T7 Full suite (2 workers), `scripts/check-api.sh`, READMEs (Forge on another PC uses Other), spec status**
