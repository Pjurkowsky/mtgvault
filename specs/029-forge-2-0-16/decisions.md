# Decisions 029: Forge 2.0.16

## Requests

1. "spec the 2.0.16 upgrade" (move the Forge image from 2.0.15 to 2.0.16).
2. Background: the AI misplays seen in Spider-Man vs Lorehold games (always
   attacking the planeswalker, not using a big draw ability when it would have
   won, attacking with only the commander while a huge army waits). 2.0.16 adds
   a Flat Monte Carlo AI layer that may fix some of this.

## Facts found

- The version is pinned in one place: `ARG FORGE_VERSION=2.0.15` in
  `docker/forge/Dockerfile`. The image downloads the official release tarball
  (2.0.16: `forge-installer-2.0.16.tar.bz2`, 301 MB) and compiles
  `MtgvaultSim.java` against `forge-gui-desktop-<version>-jar-with-dependencies.jar`.
- `server.py` reads the version from the environment; its docstring says 2.0.15.
- The backend reads `/health` for `{available, version}`; the version is not
  shown in the UI and runs don't record which Forge played them.
- Compose pulls `ghcr.io/pjurkowsky/mtgvault-forge:${FORGE_IMAGE_VERSION:-latest}`;
  CI builds the image on pushes to master that touch `docker/forge/**` and on `v*` tags.
- Tests use the fake Forge (`fake_forge`, fixtures with 2 precons); they don't run real Forge.
- 2.0.16 (released 2026-11-11) turns on "Flat Monte Carlo" by default
  (`MATCH_AI_FLAT_MONTE_CARLO=true`): the AI tries its top few plays in a hidden-info
  copy of the game, plays each a few moves ahead and picks the best. Every profile
  gets ~25 `FLAT_MC_*` settings, e.g. 450 ms per decision, 2 s per turn.
- `AiAttackController` (who attacks, and whom) barely changed since 2.0.15.
- About 1,080 upstream commits since 2.0.15.

## Round 1

1. Flat Monte Carlo ("look-ahead") is a per-run switch, so runs with and without it can be compared.
2. Each run records the Forge version, and the run page shows it.
3. Check before release: smoke test only (the image builds, a real game finishes).
4. An "Aggro" AI profile is part of this spec. Other AI fixes (attack with
   everything when lethal, player over planeswalker) wait for a later spec.

## Facts found (round 2)

- 2.0.16's Reckless already has every attack setting at its most aggressive:
  `PLAY_AGGRO=true`, `CHANCE_TO_ATTACK_INTO_TRADE=100`, `ATTACK_INTO_TRADE_WHEN_TAPPED_OUT=true`,
  `RANDOMLY_ATKTRADE_ONLY_ON_LOWER_LIFE_PRESSURE=false`, `CHANCE_TO_ATKTRADE_WHEN_OPP_HAS_MANA=100`.
  It also changes ~47 non-combat settings (countering, flash, planar die…).

## Round 2

5. No Aggro profile: Reckless already has the most aggressive attack settings.
6. "Look-ahead AI": one switch per run in the run form, on by default, for every
   seat, remembered in this browser.
7. The Forge version and look-ahead show in a tooltip on the run page.
8. When done: push to master and tag v1.0.15.

## Facts found (round 3)

- Our runner builds a `Match` directly, not Forge's `HostedMatch`, so look-ahead is
  OFF unless the runner sets `game.AI_FLAT_MONTE_CARLO = true` itself.
- Desktop Forge also sets `AI_FLAT_MONTE_CARLO_MAX` ("maximum strength"): bigger
  budgets, and it also searches attack choices (`refineAttackWithFlatMonteCarlo`).
  Mobile uses a "lite" mode; neither is the bare profile values.
- 2.0.16 adds two profiles, Hard and Hardest: Default with bigger look-ahead budgets
  (Hard 800 ms per decision / 3.5 s per turn, Hardest 1.5 s / 6 s) and a slightly
  higher "in danger" threshold.
- Time limit per game defaults to 5 minutes; a game at the limit is a draw.

## Round 3

9. Look-ahead strength is chosen per run when creating it (replaces the plain switch of item 6).
10. Hard and Hardest join the seat profiles.
11. The default time limit per game goes from 5 to 10 minutes.

## New request (mid-grilling)

12. "implement a way to run forge container on other computer? and it would connect
    to that? so for example i will run forge on faster computer"

## Facts found (remote Forge)

- The app finds Forge through one env setting, `FORGE_URL` (default empty = Simulations hidden).
  Pointing it at `http://<other-pc>:8790` already works when that PC is reachable from
  the app server and its port 8790 is published.
- The Forge API has no password: anyone who can reach port 8790 can start or stop games.
- Only one Forge at a time; changing it means editing `.env` and restarting the app.

## Round 4

13. The run form has a "Look-ahead" dropdown: Off, Light (Forge mobile), Normal (profile
    values), Maximum (Forge desktop, also searches attacks). Normal by default.
14. Remote Forge: the app and the faster PC are on the same home network.
15. Remote Forge is part of this spec (029).

## Round 5

16. Admin Settings gets a Forge card: address and a Test button that shows the version.
    It saves without a restart; `FORGE_URL` in `.env` stays the starting value.
17. An optional key: `FORGE_KEY` on the Forge container, the same key in the settings.
    No key set means open, as now.
18. "Games at once", 1 to 8, default 1: a run's games are spread across them.
19. When the faster PC is off, games fall back to the local Forge (a second address).

## Round 6

20. Main and Fallback Forge each have their own address, key and games at once.
    `FORGE_URL` from `.env` fills the Fallback, so the local Forge is the safety net.
21. Per game: each new game starts on Main if it's up, otherwise on Fallback. Games
    already playing finish where they are; one run can use both.
22. Each game records its Forge version and which Forge played it (Main or Fallback).
    The run tooltip shows the version(s) and the look-ahead; a game row's tooltip shows its Forge.

## Confirmed

The decision table was confirmed: "yes, write the spec and implement", then
"plan and tasks before the implement", then "after implement push and show
instruction to run it on other pc in local network".
