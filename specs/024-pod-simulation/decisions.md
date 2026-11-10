# Spec 024: Pod simulation (decisions so far)

Status: Grilled (2026-11-10). Summary awaiting confirmation.

Depends on: 022-deck-insights (where the request and first research came from).

## Requests

1. "search if there is a possible way to simulate for example commander pods to
   get some stats how your deck is doing (i would like to use some ready to use
   thing)" (spec 022, request 2)

## Research

### The tool (from spec 022's research)

| Option | What | Notes |
|---|---|---|
| Forge 2.0.15 | `forge.sh sim -d a.dck b.dck c.dck d.dck -f commander -n N -c 300` | Headless AI-vs-AI. Winner per game on stdout, turn from the log. GPL-3, Java 17, its own container. AI plays combos and politics poorly. Tens of seconds to minutes a game |
| XMage | | No AI-vs-AI command line |

### The code now

- Background jobs: Celery with Redis (`config/celery.py`), daily syncs in
  `CELERY_BEAT_SCHEDULE` (cards, combos, scanner bundle, backup).
- Self-hosting: one image (`Dockerfile`, s6 runs nginx, gunicorn, Celery) plus
  Postgres and Valkey in `compose.yml`. No Java in the image.
- Decks: `Deck`, `DeckCard` with zones commander / main / side / maybe. Text
  export exists (spec 014); Forge needs its own `.dck` format
  (`[Commander]` and `[Main]` sections, `N Name|SET`).

## Round 1

- Opponents: your own decks, Forge's Commander precons, other users' public
  decks, and a shared opponent pool. Any user can add a deck to the pool.
- Forge runs in an optional `forge` service in `compose.yml`. Without it, the
  Simulate controls are hidden.
- The user picks the number of games and the time limit for each game.
- A finished run shows your win rate and average winning turn, a row for each
  deck in the pod (wins, average winning turn, how often it went first), then
  each game (winner, turn, seat order).

## Round 2

- The opponent pool is server-wide. It starts with Forge's precons. A user adds
  a deck to it from the deck's menu (as a copy taken then) or by pasting a list,
  and everyone can pick from it.
- Game count and time limit have no upper limits. The defaults are 10 games and
  5 minutes. A game that hits the time limit counts as a draw.
- Each game's Forge log is kept with its run and opens in a dialog.
- Runs live in a new Simulate tab on the deck page: the run form at the top,
  earlier runs below, newest first, each kept until deleted (with a confirm).

## Round 3

- Opponents can include other users' public decks, and anyone can run a
  simulation of a deck they can open.
- Unsupported cards are listed before a run; the user swaps each one for an
  alternative. Swaps apply to simulations only, are remembered per deck, and
  suggestions are Forge-supported cards from EDHREC Similar and cards sharing
  categories, or any card typed in.
- The opponent pool is fully open: anyone can add, rename or remove any deck.
- One run at a time. The Simulate tab shows the queue above the run form: the
  running run (deck, user, games done / total) and the queued ones in order,
  your own highlighted.
- Runs show on the deck's Simulate tab for everyone who can open the deck,
  labelled with who ran them. Private decks: only the owner.
- Only the user who started a run can cancel or delete it.

## Round 4

- Forge: a pinned upstream release; the version is a build arg so a fork can
  replace it later (Forge is GPL-3; a published modified image needs its source
  published). Changing the AI is a later spec.
- Seat order: the user chooses per run.
- Each run copies the pod's lists when it starts; old runs show the lists they used.
- Progress updates live on the Simulate tab only; no toast or notification.

## Round 5

- Seat modes: Rotate (default), Random, Fixed (the order the pod is arranged in).
- Pods hold 2 to 6 decks (1 to 5 opponents), 4 by default.
- The opponent pool is managed only inside the Simulate tab (from the opponent
  picker): add the current deck or a pasted list, rename, remove.
- The opponent seats start empty.

## Round 6

- Each seat has its own AI profile (Default, Cautious, Reckless, Experimental),
  Default preset.
- Every unsupported card must be swapped before a run can start.
- The same swap step applies to every deck in the pod, opponents included.
- Swaps never change a player's deck. Swaps for a player's deck (yours or a
  public one) are simulation-only and remembered for the user who made them.
  Pool decks are separate copies, so a swap there edits the pool copy itself.

## Research: replaying a game in the browser

No ready-made browser replay exists for Forge, XMage or Cockatrice games.
Forge's new Local Replay (`.frp`, PR #12266, Oct 2026) skips AI-vs-AI `sim`
games and is Java-serialized. `forge sim` prints the full game log as
`Type: message` lines (Turn, Phase, Zone Change, Add To Stack, Combat, Damage,
Life, Land, Mana …, 20 types in `GameLogEntryType`). A structured log with card
ids would need a Java hook (later, with a fork).

## Round 7

- A finished game opens in our own viewer built from the log: step turn by
  turn, each player's life, that turn's plays, combat and damage, and a
  best-effort battlefield and graveyard per player rebuilt from zone changes.
  The raw log stays available.

## Round 8

- Steps go one turn at a time (buttons and arrow keys). A turn's events can be
  expanded, and clicking an event shows the board at that moment.
- Board: a panel per player with name, life and commander; the battlefield as
  small card images grouped into lands, creatures and other; graveyard and exile
  as counts that open a list. Hovering a card shows it.
- The viewer is its own page (`/decks/:id/simulations/:run/games/:n`) with a
  shareable link, visible to whoever can see the run. The raw log is a tab there.
