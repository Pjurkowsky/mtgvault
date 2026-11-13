# Spec 031: Where and how long each game played (decisions so far)

Status: Written into spec.md (2026-11-14).

## Requests

- "how can i see where the simluation is running i mean on which device/container??"
- "also i would like to see where how much time it took to complete each game and simulation"
- "show this information in the table where the run went from and how long it took"

## Research

- The run page lists games under the stats tables (`SimRunCard.vue`): "Game N",
  the result, the seat order, Replay. Which Forge played it shows only in a
  tooltip on "Game N", and only once the game is done (spec 029, AC-6).
- `SimGame.duration_ms` is saved for every game but not in the API. A run's
  `started_at` and `finished_at` are in the API but not shown.
- A game gets its row only when it ends; games still playing are only in the
  worker's memory, so nothing shows where they play.

## Round 1

- Where: each game row shows the address of the Forge that played it, saved per game.
- Live: games still playing are listed, e.g. "Playing on <address> · 1m 20s", counting up.
- Run time: both, wall time and the sum of game times ("Took 38m · games 1h 52m";
  "Running 12m" while playing).
- The Simulations list shows the run time too.

## Round 2

- Request: "can we also choose where the game will be played before the run it
  should be a toggle group with 3 options"
- Names: Main is this server's own Forge (always set), Other is the extra PC.
  Settings renames its cards to match (spec 029's Main becomes Other, Fallback becomes Main).
- Toggle in the run form: Auto / Main / Other. Auto plays on Other while it
  answers, otherwise Main (spec 029's behaviour). Everyone can pick.
- Chosen Forge not answering: the run fails, and a Restart button plays what's left.
- Restart: keeps finished games, queues the rest with the same settings; Auto /
  Main / Other can be picked again.

## Round 3

- Restart: on failed and cancelled runs, for the run's owner.
- A Main or Other run whose Forge stops answering mid-game fails, keeping
  finished games; the error names the Forge. Auto runs still replay the game on
  the other Forge.
