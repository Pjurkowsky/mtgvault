# Spec 029: Forge 2.0.16 and a Forge on another PC

Status: Done
Depends on: 024-pod-simulation, 025-simulations-page, 027-deck-versions

## Goal

Play simulations with Forge 2.0.16 and its new look-ahead AI, and let a faster PC
on the home network play the games, with the server's own Forge as a fallback.

## Terms

- **Look-ahead**: Forge 2.0.16's Flat Monte Carlo AI. Before a play it tries its
  best few options in a copy of the game that hides what it shouldn't know,
  plays each a few moves ahead and picks the one that scores highest.
- **Main** and **Fallback**: the two Forges MTG Vault knows. New games go to Main
  when it answers, otherwise to Fallback.
- **Games at once**: how many games one Forge plays at the same time.

## Acceptance criteria

### Forge 2.0.16

- **AC-1** The Forge image runs Forge 2.0.16: its `/health` reports `2.0.16`, and
  a real Commander game between two precons finishes with each look-ahead level.
- **AC-2** A seat's AI profile is one of Default, Cautious, Reckless, Experimental,
  Hard or Hardest.
- **AC-3** The run form has a Look-ahead dropdown: Off, Light, Normal, Maximum.
  Normal comes first; the last choice is remembered in this browser. Every game of
  the run plays with it.
- **AC-4** The time limit per game starts at 10 minutes (form and API).
- **AC-5** On a run's page, an info tooltip in the header shows the Forge
  version(s) its games played on and its look-ahead, e.g. "Forge 2.0.16 ·
  Look-ahead Normal". Runs from before this spec show "Forge 2.0.15 · Look-ahead Off".
- **AC-6** Hovering a game's number shows which Forge played it, e.g.
  "Main · Forge 2.0.16".

### Forge on another PC

- **AC-7** Staff see a Forge card in Settings with Main and Fallback, each with an
  address, an optional key and Games at once (1 to 8, default 1). Saving takes
  effect without a restart. Fallback starts as the server's `FORGE_URL`.
  Others don't see the card, and its API refuses them.
- **AC-8** Each Forge has a Test button: it shows the version that answered, or a
  tinted error when the Forge can't be reached or the key is wrong. It tests what
  is typed, saved or not.
- **AC-9** A Forge container started with `FORGE_KEY` refuses requests without
  that key; without `FORGE_KEY` it is open, as before.
- **AC-10** Each new game starts on Main when it answers, otherwise on Fallback.
  Games already playing finish where they are, so one run can use both.
  Simulations is available while either Forge answers.
- **AC-11** A Forge plays up to its Games at once at the same time. When the
  oldest run has no game left to start, a free slot starts a game of the next
  queued run.
- **AC-12** When a Forge stops answering during a game, that game is played again
  on whichever Forge answers, instead of failing the run.

## Out of scope

- An "Aggro" profile (Reckless already attacks as hard as profile settings allow)
- Other AI fixes: attack with everything when lethal, the player over a planeswalker
- More than two Forges, or Forges outside the home network (no TLS)
- Comparing 2.0.15 and 2.0.16 win rates

## Assumptions (filled in during writing, not grilled)

- AC-3: Light is Forge's phone setting, Normal each profile's own look-ahead
  settings, Maximum Forge's desktop setting (bigger search, also on attacks).
  Off plays like 2.0.15. Hard and Hardest differ from Default only in look-ahead,
  so with Off they play like Default.
- AC-5: a run with no games yet shows only the look-ahead. Older games show
  "Forge 2.0.15" because every earlier game played on the 2.0.15 image.
- AC-7: the key is shown to staff as typed (it's a home-network password, not
  an account secret). An empty Main means games use Fallback only.
- AC-9: `/health` needs the key too, so Test catches a wrong key.
- AC-10: "answers" means `/health` replies with the right key; the worker checks
  every few seconds. The card list and precons come from Main when it answers.
- AC-11: Main only gets new games while it answers; Fallback slots are used only
  while Main doesn't. Both Forges should run the same image version: a 2.0.15
  Forge doesn't know Hard, Hardest or look-ahead.
- AC-12: a game is played again from the start; a Forge error that isn't about
  reaching it (a bad deck, a failed game) still counts as before.
