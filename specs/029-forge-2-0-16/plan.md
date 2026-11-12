# Plan 029: Forge 2.0.16 and a Forge on another PC

## Decisions

| Topic | Choice |
|---|---|
| Upgrade | `ARG FORGE_VERSION=2.0.16` in `docker/forge/Dockerfile`. |
| Look-ahead in the runner | `MtgvaultSim --lookahead off\|light\|normal\|max` sets `game.AI_FLAT_MONTE_CARLO`, `_LITE` and `_MAX` itself; our runner builds a `Match` directly, so Forge's `HostedMatch` never sets them. |
| Look-ahead in the API | `SimRun.lookahead` (`off`, `light`, `normal`, `max`); existing runs get `off`, new runs default to `normal`. The worker sends it with each game; `server.py` passes it to the runner. |
| Profiles | Hard and Hardest added to `PROFILES` in `services.py`, `server.py` and `lib/sims.ts`. |
| Time limit | `minutes` defaults to 10 in `StartRunSerializer` and the form. |
| Recorded Forge | `SimGame.forge_version` and `SimGame.forge_server` (`main`, `fallback`). The migration sets `2.0.15` on existing games. |
| Settings | `ForgeServer` model, two rows (`main`, `fallback`): `url`, `key`, `slots`. Fallback's row is created with `settings.FORGE_URL`. `GET/PUT /api/sims/forge/` and `POST /api/sims/forge/test/` for staff. Saving clears the cached status. |
| Key | `FORGE_KEY` in the container; requests send `X-Forge-Key`. `server.py` answers 401 without it. The Docker health check sends it. |
| Client | `forge.call(..., server=)` talks to one Forge; `ForgeUnreachable` (connection errors, 5xx, 401) is apart from other `ForgeError`s. `forge.active()` returns Main if it answers, else Fallback, else None. |
| Worker | One dispatcher thread: every tick it picks the active Forge, and while that Forge has free slots it claims the next unplayed game (oldest run first, lowest number) and plays it on a thread. Claims live in memory, so a restart replays unfinished games as before. A run turns Playing on its first claim and Done, Cancelled or Failed when nothing of it is in flight. `ForgeUnreachable` releases the claim. |
| Fake Forge | `fake_forge --key --version`, plus `POST /_down {"seconds"}` to answer 503 for a while (AC-12). A second fake Forge (`fake-main`, key `secret`) runs in e2e as the Main to point at. |
| Test isolation | The Forge settings tests change server-wide settings, so they run in their own Playwright project after `sim-admin` and before `performance`. |

## Files

| File | Change |
|---|---|
| `docker/forge/Dockerfile` | 2.0.16, health check with the key |
| `docker/forge/MtgvaultSim.java` | `--lookahead` |
| `docker/forge/server.py` | key check, `lookahead`, Hard and Hardest |
| `backend/sims/models.py`, migration `0004` | `ForgeServer`, `SimRun.lookahead`, `SimGame.forge_version`, `forge_server` |
| `backend/sims/forge.py` | per-server calls, key header, `ForgeUnreachable`, `active()` |
| `backend/sims/worker.py` | dispatcher with slots, claims, retries |
| `backend/sims/services.py`, `serializers.py`, `views.py`, `urls.py` | profiles, look-ahead, minutes, Forge settings API, game Forge fields |
| `backend/sims/management/commands/fake_forge.py` | key, version, `/_down` |
| `frontend/src/lib/sims.ts` | profiles, look-ahead levels |
| `frontend/src/components/sims/SimRunForm.vue` | Look-ahead dropdown, 10 minutes |
| `frontend/src/components/sims/SimRunCard.vue` | header tooltip, game tooltip |
| `frontend/src/components/settings/ForgeServersCard.vue`, `pages/SettingsPage.vue` | the Forge card |
| `frontend/playwright.config.ts` | second fake Forge, `forge-servers` project |
| `README.md`, `backend/README.md`, `frontend/README.md` | Forge on another PC |

## Tests

| Test file | ACs |
|---|---|
| `e2e/sim-lookahead.spec.ts` | AC-2 to AC-6 |
| `e2e/sim-forge-servers.spec.ts` | AC-7 to AC-12 |
| Manual smoke test of the real image (`docker build`, one game per look-ahead level, key check) | AC-1, AC-9 |

## Order of work

1. Forge image: 2.0.16, look-ahead flag, profiles, key.
2. Models, migration, Forge client, worker.
3. API: look-ahead, minutes, profiles, recorded Forge, Forge settings.
4. Run form and run page.
5. Settings card.
6. Tests, smoke test, full suite, READMEs, status, push and tag.
