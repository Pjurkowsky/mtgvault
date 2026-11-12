# 025 Simulations page: decisions

Depends on: 024-pod-simulation

## Requests

1. Move the Simulate tab from the deck page to the site's top bar.
2. Let users see the queue there.
3. Let users see all games played there.
4. Allow an admin to cancel the queue (asked during round 2).

## Research

- Top bar (`AppLayout.vue`): MTG Vault, Decks (logged in), Users (everyone).
- Today the Simulate tab lives on `DeckPage.vue`; seat 1 is always that deck.
  Replay links are `/decks/:id/simulations/:run/games/:n` and
  `/u/:username/decks/...`. Back on the replay page returns to the deck's tab.
- API: runs are listed only per deck (`GET /api/decks/{id}/sims/`); starting a
  run is `POST /api/decks/{id}/sims/`. `GET /api/sims/queue/` is already global.
- Visibility (024 AC-18): runs on a private deck are visible only to its owner.
  The queue endpoint shows every queued run's deck name to everyone, private
  decks included.

## Round 1

1. Top bar: a **Simulations** item opens `/simulations` (queue, run form, runs),
   shown only when Forge is set up.
2. Who: **logged-in users only**, like Decks.
3. Seat 1 (the deck tested): **my decks, public decks and pool decks**.
4. Deck page: the Simulate tab is **removed completely**, no button.
5. Runs: every run the user may see, newest first, 20 and Show more, an
   **All / Mine** filter and a deck search.
6. Each run is a **row** (deck, user, opponents' commanders, status, win rate)
   that opens a run page `/simulations/:run` with today's full run card.
7. Replays move to `/simulations/:run/games/:n`; **old links are not redirected**.
8. Queue: others see **"Private deck"** instead of a private deck's name; runs on
   private decks stay visible only to the owner.

## Round 2

9. Runs whose tested deck is a **pool deck** are visible to every logged-in
   user. Removing the pool deck keeps its runs.
10. Run pages and replays **need a login**; the `/u/:username/...` replay links go.
11. The run search matches the name or commander of **any deck in the pod**.
12. Seat 1 starts **empty** and uses the same picker (Pool, My decks, Public).

## Round 3

13. Admins (staff) can **cancel** any queued or playing run. Only the runner deletes.
14. A cancel button on each queue row and on the run page, plus **Cancel all** on
    the queue, with a confirm.
15. Admins **see everything**: private deck names in the queue, and they can open
    any run and its replays.
16. A run an admin cancelled shows **"Cancelled by <admin's username>"**.
17. **Cancel all** stops the playing run (finished games kept) and cancels every
    queued run.
