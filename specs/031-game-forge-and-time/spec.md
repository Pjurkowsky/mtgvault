# Spec 031: Pick the Forge, see where and how long games played

Status: Done
Depends on: 024-pod-simulation, 025-simulations-page, 029-forge-2-0-16

## Goal

Choose which Forge plays a run, see which Forge played or is playing each game
and how long it took, and restart a run that stopped before its games were done.

## Terms

- **Main**: this server's own Forge (spec 029's Fallback).
- **Other**: an extra Forge, e.g. a faster PC on the home network (spec 029's Main).
- **Forge choice**: Auto, Main or Other, picked per run.

## Acceptance criteria

### Main and Other

- **AC-1** The Forge card in Settings shows Main (first, starting as the server's
  `FORGE_URL`) and Other. Forges saved before this spec keep their address: the
  old Fallback becomes Main, the old Main becomes Other. Earlier games show Main
  or Other the same way.

### Picking the Forge

- **AC-2** The run form has a toggle group Auto, Main, Other. Auto comes first;
  the last choice is remembered in this browser. Anyone starting a run can pick.
- **AC-3** Auto plays each game on Other while it answers, otherwise on Main, as
  in spec 029 (including playing a game again when its Forge stops answering).
- **AC-4** Main or Other plays every game of the run on that Forge. When it doesn't
  answer, at the start or in the middle of a game, the run fails with
  "Other (192.168.1.20:8790) is not answering." and keeps its finished games.
- **AC-5** A run's page shows its Forge choice in the header's info tooltip, e.g.
  "Forge 2.0.16 · Look-ahead Normal · Auto".

### Restart

- **AC-6** A failed or cancelled run shows Restart to its owner. Restart asks for
  Auto, Main or Other (starting at the run's choice), keeps the finished games and
  queues the rest with the same settings. The run shows its first start time.

### Where and how long

- **AC-7** Each game row shows the address of the Forge that played it and how
  long it took, e.g. "192.168.1.20:8790 · 4m 12s". Hovering the address shows
  "Other · Forge 2.0.16". Games from before this spec show no address; their
  time still shows.
- **AC-8** Games still playing are listed live with "Playing on 192.168.1.20:8790"
  and a time counting up.
- **AC-9** The run header shows "Took 38m · games 1h 52m" when done (start to end,
  then the sum of the game times) and "Running 12m · games 25m" while playing.
  Each run in the Simulations list shows the same.

## Out of scope

- More than two Forges
- Moving a game that is playing to another Forge

## Assumptions (filled in during writing, not grilled)

- AC-1: the API's `forge_server` values become `main` and `other`; the old
  `fallback` games turn `main`, the old `main` games `other`.
- AC-4: the run fails at the first game the chosen Forge can't start; an empty
  Other fails the same way. Other runs, on the other Forge, keep playing.
- AC-6: a restarted run keeps its error until it starts again; Restart counts the
  run's time from its first start, so "Took" includes the wait. A cancel that is
  still in progress shows no Restart yet.
- AC-7: times under a minute show seconds ("42s"), over an hour hours and
  minutes ("1h 05m"). A game played again after a Forge stopped answering shows
  only its last Forge and time.
- AC-8: the list updates every few seconds, as the run page already does.
