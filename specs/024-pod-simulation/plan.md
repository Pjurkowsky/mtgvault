# Plan 024: Pod simulation

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Forge service | `docker/forge/Dockerfile`: Eclipse Temurin 17 JRE plus a pinned Forge release (`ARG FORGE_VERSION`), and a small HTTP wrapper (`docker/forge/server.py`, Python stdlib) on port 8790. `GET /health` returns the version, `GET /cards` returns supported card names, `GET /precons` returns the bundled Commander `.dck` files, `POST /games` plays one game, `DELETE /games/{id}` kills it. Image `ghcr.io/pjurkowsky/mtgvault-forge`. |
| One game | `POST /games {decks: [dck text], profiles, timeout_s}` writes the `.dck` files and runs `forge.sh sim -d … -f commander -n 1 -c timeout`. It returns `{status: won\|draw\|failed, winner_seat, turn, log, error}`. The order of `decks` is the seat order. The per-seat AI profile is set by the wrapper; T1 checks how `sim` takes it (CLI flag or per-player preference), and if it can't vary per seat, the spec is changed first. |
| Wiring | `FORGE_URL` env (empty means off). `compose.yml` gets a `forge` service under `profiles: [forge]`; `docker-compose.dev.yml` gets one too. Deck detail gains `simulate: bool` (Forge configured, Commander format). |
| Models (new app `sims`) | `PoolDeck` (name, commander names, cards JSON `[{name, quantity, commander}]`, added_by null for precons, created). `SimSwap` (user, deck, from_name, to_name; unique user+deck+from). `SimRun` (deck, user, status, games, minutes, seat_mode, position, created/started/finished, error). `SimSeat` (run, index, label, source `deck\|pool\|public`, source id, profile, cards JSON snapshot). `SimGame` (run, number, status, winner_seat, turn, seat_order array, log text, error, duration). |
| Queue | Celery queue `forge` with its own worker, concurrency 1 (`docker/s6-rc.d/celery-forge`). Starting a run enqueues `sims.tasks.play_run(id)`. The task plays games one by one, checks `status == cancelling` between games, and stores each game as it finishes. Cancel during a game also calls `DELETE /games/{id}`. Queue order is `created` among runs that are queued or playing. |
| Support check | `sims/forge.py`: `client()`, `supported_names()` cached in Redis 24 h; `unsupported(cards)` normalises DFC names to the front face. Precons are imported into `PoolDeck` on the first call when the pool is empty (`ensure_precons`). |
| Suggestions | `GET /api/sims/suggest/?name=&identity=`: EDHREC similar for the card (`cards/edhrec.py`), then `CardInsight` cards with the same first category inside the identity, both filtered to supported names, 10 each. |
| Seat order | `seat_orders(n_seats, games, mode)`: rotate = shift by game index; random = `random.Random(run.id + game)` shuffle; fixed = identity. |
| Replay | `sims/replay.py`: `parse(log, seats)` turns Forge's `Type: message` lines into `{players, turns: [{number, active, events: [{text, kind, board}]}]}`. Each event carries the board after it (life, battlefield with tapped flag and type row, graveyard, exile per player), rebuilt from Zone Change, Land, Life, Damage, Combat and tap lines. Card names map to printings (newest) for images. Parsing runs on request and is cached by game id. |
| API | `GET/POST /api/decks/{id}/sims/` (list, start), `GET/DELETE /api/sims/runs/{id}/`, `POST /api/sims/runs/{id}/cancel/`, `GET /api/sims/runs/{id}/games/{n}/` (replay JSON plus log), `GET /api/sims/queue/`, `GET/POST /api/sims/pool/`, `PATCH/DELETE /api/sims/pool/{id}/`, `POST /api/sims/check/` (pod → unsupported cards with saved swaps), `PUT /api/sims/swaps/` (user's swaps for a deck), `GET /api/sims/suggest/`. Public decks use the same run ids; visibility is checked against the run's deck. |
| Fake Forge for tests | `sims/management/commands/fake_forge.py`: the wrapper's API answered from fixtures (`sims/fixtures/forge/`: card list, 2 precons, real game logs recorded from Forge in T1). Its games take about a second, and a deck named "Hangs" times out, so cancel can be tested. Playwright's webServer starts it and sets `FORGE_URL`. |
| UI | `DeckSimulate.vue` (queue panel, `SimRunForm`, run list), `SimRunForm.vue` (seats, `OpponentPicker`, profiles, seat mode, games, minutes), `OpponentPicker.vue` (pool / my / public tabs, Add to pool, rename, remove), `SimSwapStep.vue` (unsupported cards with suggestions), `SimRunCard.vue` (status, stats, pod table, games). Page `SimGamePage.vue` with `ReplayBoard.vue`, `ReplayPlayer.vue` (one panel) and `ReplayEvents.vue`. Routes `/decks/:id/simulations/:run/games/:n` and `/u/:username/decks/:id/simulations/:run/games/:n`. |
| Licence | Forge stays a separate program in its own image. The README credits Forge (GPL-3) and links its source. |

## Files

| File | Change |
|---|---|
| `docker/forge/Dockerfile`, `docker/forge/server.py` (new) | Forge image and HTTP wrapper |
| `compose.yml`, `docker-compose.dev.yml`, `.env.selfhost.example` | `forge` service, `FORGE_URL` |
| `docker/s6-rc.d/celery-forge` (new), `Dockerfile` | forge queue worker |
| `.github/workflows/*` | build and publish the forge image with releases |
| `backend/sims/` (new app): `models.py`, migration, `forge.py`, `replay.py`, `tasks.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`, `fixtures/forge/`, `management/commands/fake_forge.py` | everything above |
| `backend/config/settings.py`, `urls.py` | app, `FORGE_URL`, Celery route for `forge` |
| `backend/decks/serializers.py` | `simulate` on deck detail |
| `backend/openapi.yaml`, `frontend/src/api/schema.d.ts` | regenerated |
| `frontend/src/pages/DeckPage.vue` | Simulate tab |
| `frontend/src/components/sims/*` (new) | the components above |
| `frontend/src/pages/SimGamePage.vue` (new), `src/router/index.ts` | replay page and routes |
| `frontend/playwright.config.ts` | fake Forge webServer |
| `README.md`, `backend/README.md`, `frontend/README.md` | Forge setup, credits |

## Tests

| File | Covers |
|---|---|
| `sim-availability.spec.ts` | AC-1 |
| `sim-pod.spec.ts` | AC-3 to AC-7 |
| `sim-pool.spec.ts` | AC-8 to AC-10 |
| `sim-unsupported.spec.ts` | AC-11 to AC-13 |
| `sim-runs.spec.ts` | AC-14 to AC-22 |
| `sim-replay.spec.ts` | AC-23 to AC-28 |
| Manual check with the real Forge image (T1, T9) | AC-2 |

## Order of work

1. Forge image and wrapper; record real game logs as fixtures; check the AI
   profile per seat.
2. Models, pool with precons, support check, fake Forge.
3. Runs: start, queue task, cancel, delete, API.
4. Simulate tab: availability, run form, opponent picker, pool.
5. Unsupported cards step, suggestions, sim swaps.
6. Run list and results.
7. Log parser and replay page.
8. Compose, s6 worker, image publishing, READMEs, full suite, spec status.
