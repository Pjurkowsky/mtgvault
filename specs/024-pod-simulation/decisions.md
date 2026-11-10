# Spec 024: Pod simulation (decisions so far)

Status: Requests taken (2026-11-10). Grilling round 1.

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
