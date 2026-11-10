# Plan 024: Pod simulation

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Forge service | `docker/forge/Dockerfile`: Eclipse Temurin 17 plus a pinned Forge release (`ARG FORGE_VERSION`, unpacked and trimmed of the adventure mode, music and skins), MTG Vault's runner `MtgvaultSim.java` compiled against Forge's jar, and a small HTTP API (`server.py`, Python stdlib) on port 8790. `GET /health` returns the version, `GET /cards` returns supported card names, `GET /precons` returns the Commander precons (`res/quest/commanderprecons`, 179), `POST /games` starts one game, `GET /games/{id}` polls it, `DELETE /games/{id}` kills it. Image `ghcr.io/pjurkowsky/mtgvault-forge`. |
| One game | `MtgvaultSim` (our code, Forge unchanged) loads the `.dck` files, creates one AI per seat with its profile, and plays one Commander game with a time limit. Its AI controller makes the first seat start (Forge would let a random player choose), so the order of `decks` is the turn order. A `GameLog` observer writes a JSON line per log entry (Phase and Mana lines skipped): game turn, active seat, type, text and, when it changed, the board (each seat's life, lost, hand and library counts, battlefield with id, name, row, tapped, token, power / toughness, counters, attached to, owner; graveyard, exile, commanders). The last line is the result: status won / draw / failed, winner seat, game turn, the game turn each seat lost on, error, the full text log. It also skips Forge's Sentry crash reporting. A 4-player game takes about a minute and about 30 KB gzipped. |
| Wiring | `FORGE_URL` env (empty means off). `compose.yml` gets a `forge` service under `profiles: [forge]`; `docker-compose.dev.yml` gets one too. Deck detail gains `simulate: bool` (Forge configured, Commander format). |
| Models (new app `sims`) | `PoolDeck` (name, commander names, cards JSON `[{name, quantity, commander}]`, added_by null for precons, created). `SimSwap` (user, deck, from_name, to_name; unique user+deck+from). `SimRun` (deck, user, status, games, minutes, seat_mode, fixed_order, cancel_requested, created/started/finished, error). `SimSeat` (run, index, label, source `deck\|pool\|public`, source id, profile, cards JSON snapshot). `SimGame` (run, number, status, winner_seat, turn, winner_turn, lost_on, seat_order array, replay as gzipped JSON of steps and log, error, duration). |
| Queue | A worker command `manage.py run_sims` (its own s6 service) takes the oldest queued run, plays its games one by one (`POST /games`, then polls `GET /games/{id}` every second), and stores each game as it finishes. Between polls it checks for a cancel; a cancel kills the game with `DELETE /games/{id}`. One worker process means one run at a time. Queue order is `created` among queued runs. A run left Playing by a restart goes back to Queued. |
| Support check | `sims/forge.py`: `client()`, `supported_names()` cached in Redis 24 h; `unsupported(cards)` normalises DFC names to the front face. Precons are imported into `PoolDeck` on the first call when the pool is empty (`ensure_precons`). |
| Suggestions | `GET /api/sims/suggest/?name=&identity=`: EDHREC similar for the card (`cards/edhrec.py`), then `CardInsight` cards with the same first category inside the identity, both filtered to supported names, 10 each. |
| Seat order | `seat_orders(n_seats, games, mode)`: rotate = shift by game index; random = `random.Random(run.id + game)` shuffle; fixed = the turn order the form arranged (`fixed_order`, seat 0 is always this deck). |
| Replay | `SimGame.steps` stores the runner's steps gzipped (`BinaryField`). The replay API returns players (deck, commander, profile), steps grouped by game turn (each with the board carried forward), each seat's own turn count, and printings for every card name on the boards (newest printing; tokens from the token catalogue by name, else text). |
| API | `GET/POST /api/decks/{id}/sims/` (list, start), `GET/DELETE /api/sims/runs/{id}/`, `POST /api/sims/runs/{id}/cancel/`, `GET /api/sims/runs/{id}/games/{n}/` (replay JSON plus log), `GET /api/sims/queue/`, `GET/POST /api/sims/pool/`, `PATCH/DELETE /api/sims/pool/{id}/`, `POST /api/sims/check/` (pod → unsupported cards with saved swaps), `PUT /api/sims/swaps/` (user's swaps for a deck), `GET /api/sims/suggest/`. Public decks use the same run ids; visibility is checked against the run's deck. |
| Fake Forge for tests | `sims/management/commands/fake_forge.py`: the same HTTP API answered from fixtures (`sims/fixtures/forge/`: card list, two precons, game files recorded from the real runner). Each game takes about a second; a deck named "Hangs" never finishes, so cancel can be tested. Playwright starts it and `run_sims --health-port`, with `FORGE_URL` set. |
| UI | `DeckSimulate.vue` (queue panel, `SimRunForm`, run list), `SimRunForm.vue` (seats, `OpponentPicker`, profiles, seat mode, games, minutes), `OpponentPicker.vue` (pool / my / public tabs, Add to pool, rename, remove), `SimSwapStep.vue` (unsupported cards with suggestions), `SimRunCard.vue` (status, stats, pod table, games). Page `SimGamePage.vue` with `ReplayBoard.vue`, `ReplayPlayer.vue` (one panel) and `ReplayEvents.vue`. Routes `/decks/:id/simulations/:run/games/:n` and `/u/:username/decks/:id/simulations/:run/games/:n`. |
| Licence | Forge stays a separate program in its own image. The README credits Forge (GPL-3) and links its source. |

## Files

| File | Change |
|---|---|
| `docker/forge/Dockerfile`, `MtgvaultSim.java`, `server.py` (new) | Forge image, runner and HTTP API |
| `compose.yml`, `docker-compose.dev.yml`, `.env.selfhost.example` | `forge` service, `FORGE_URL` |
| `docker/s6-rc.d/sims` (new), `Dockerfile` | `run_sims` worker |
| `.github/workflows/*` | build and publish the forge image with releases |
| `backend/sims/` (new app): `models.py`, migration, `forge.py`, `replay.py`, `tasks.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`, `fixtures/forge/`, `management/commands/fake_forge.py`, `run_sims.py` | everything above |
| `backend/config/settings.py`, `urls.py` | app, `FORGE_URL` |
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

1. Forge image, runner and HTTP API; record real games as fixtures.
2. Models, pool with precons, support check, fake Forge.
3. Runs: start, queue task, cancel, delete, API.
4. Simulate tab: availability, run form, opponent picker, pool.
5. Unsupported cards step, suggestions, sim swaps.
6. Run list and results.
7. Log parser and replay page.
8. Compose, s6 worker, image publishing, READMEs, full suite, spec status.
