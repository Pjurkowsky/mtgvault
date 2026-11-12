# Plan 026: Replay improvements

## Decisions

| Topic | Choice |
|---|---|
| Runner | `MtgvaultSim.java` adds `hand_cards` and `library_cards` (id, name; library top first) to each seat of a board, and on battlefield cards `attacking` (`{"seat": n}` or `{"card": id}`) and `blocking` (attacker ids) while `game.getCombat()` has them. The counts `hand` and `library` stay. |
| Fixtures | Re-record `game-2` and `game-4` with the new runner (same decks), so the fake Forge serves hands, libraries and combat. Tests that quote numbers from the recording are updated. |
| Replay API | `replay.build` remaps `attacking.seat` to run seats, and adds hand and library card names to the image lookup. `BoardSeat` gains `hand_cards` and `library_cards` (null in older games); battlefield cards gain `attacking` and `blocking`. |
| Deaths and new graveyard cards | Worked out in the browser by comparing a board with the one before it: ids that left a battlefield and are now in a graveyard. |
| Arrows | An SVG overlay over the board, drawn from card and panel positions (`data-card-id`, `data-seat`) after each step and on resize. |
| Layout | Panels are a flex column; zones footer `mt-auto`. Rows have a minimum height of one card. |
| Zone lists | One `ReplayZoneDialog` with small images; a card opens the large image (`FullscreenCard`). |
| Sidebar | `ReplaySidebar`, built like `UnplacedSidebar` (fixed right edge, arrow tab, `usePreference('replay.sidebar')`): Previous / Next event, the turn's events, settings. Replaces the events column and the phone drawer. |
| Position | The page keeps a step cursor (`turn`, `event`); helpers move by event or turn across turn edges. |
| Autoplay | A timer in `useReplayPlayer` reading the settings; `usePreference` for speed, unit, pause at combat, follow, and the two death options. |

## Files

| File | Change |
|---|---|
| `docker/forge/MtgvaultSim.java` | hand and library cards, combat |
| `backend/sims/fixtures/forge/game-2.json.gz`, `game-4.json.gz` | re-recorded |
| `backend/sims/management/commands/fake_forge.py` | a deck named "Unrecorded" plays a game without the new details (AC-3) |
| `backend/sims/replay.py`, `serializers.py` | new fields, remapping, images |
| `frontend/src/pages/SimGamePage.vue` | cursor, keys, autoplay, sidebar, arrows |
| `frontend/src/composables/useReplayPlayer.ts` | new: stepping and autoplay |
| `frontend/src/components/sims/ReplayPlayer.vue`, `ReplayCard.vue` | layout, zones, click, combat and death marks |
| `frontend/src/components/sims/ReplaySidebar.vue`, `ReplayZoneDialog.vue`, `ReplayArrows.vue` | new |
| `frontend/src/components/sims/ReplayEvents.vue` | highlight and scroll |

## Tests

| Test file | ACs |
|---|---|
| `e2e/sim-replay.spec.ts` | spec 024's replay tests, updated to the new recording and sidebar |
| `e2e/sim-replay-zones.spec.ts` (new) | AC-1 to AC-5 |
| `e2e/sim-replay-combat.spec.ts` (new) | AC-6 to AC-8 |
| `e2e/sim-replay-play.spec.ts` (new) | AC-9 to AC-13 |

## Order of work

1. Runner, Forge image, re-recorded fixtures; replay API.
2. Panel layout, zones, card click.
3. Sidebar, stepping, keys.
4. Combat arrows, deaths, graveyard highlight.
5. Autoplay and settings.
6. Tests, screenshots, full suite, READMEs, status; push.
