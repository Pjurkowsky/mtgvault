# Tasks 024: Pod simulation

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

## Forge

- [x] **T1 Forge image, MTG Vault runner and HTTP API; real games recorded as fixtures** (AC-2, AC-5, AC-6, AC-28)
- [x] **T2 sims models, precons into the pool, support check, fake Forge for tests** (AC-8, AC-11)

## Runs

- [x] **T3 Start a run, run_sims worker, seat orders, cancel, delete, API** (AC-6, AC-7, AC-14 to AC-18, AC-22)

## Simulate tab

- [x] **T4 Simulate tab, run form, opponent picker; sim-availability.spec.ts, sim-pod.spec.ts** (AC-1, AC-3 to AC-7)
- [x] **T5 Opponent pool: add this deck or a list, rename, remove; sim-pool.spec.ts** (AC-8 to AC-10)
- [x] **T6 Unsupported cards step, suggestions, sim swaps; sim-unsupported.spec.ts** (AC-11 to AC-13)
- [x] **T7 Queue panel, run list, results, cancel and delete; sim-runs.spec.ts** (AC-14 to AC-22)

## Replay

- [ ] **T8 Log parser and replay API, replay page, board, events, Log tab; sim-replay.spec.ts** (AC-23 to AC-28)

## Finish

- [ ] **T9 Compose and dev services, run_sims in the image, forge image in CI; check with the real image** (AC-2)
- [ ] **T10 Full suite (2 workers), READMEs, spec status**
