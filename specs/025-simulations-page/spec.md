# Spec 025: Simulations page

Status: Done
Depends on: 024-pod-simulation
Followed by: 026-replay-improvements

## Goal

Simulations get their own page in the top bar instead of a tab on each deck:
one place to start a run with any deck, watch the queue, and browse every run
and game played. Admins can stop runs that clog the queue.

## Terms

- **Tested deck**: the deck a run measures, the first seat of the form (spec
  024's seat 1). Its win rate is the run's win rate.
- **Admin**: a staff account (spec 008).

Spec 024's other terms (pod, opponent pool, run, AI profile, sim swap, turn)
stay as they are.

## Acceptance criteria

### Page

- **AC-1** When the server has a Forge service, the top bar shows
  **Simulations** to logged-in users. It opens `/simulations`: the queue, the
  run form and the runs. Visitors who aren't logged in don't see the item, and
  the page, run pages and replays send them to log in. Without a Forge service
  the item is hidden.
- **AC-2** Deck pages no longer have a Simulate tab.

### Run form

- **AC-3** The form starts with four empty seats. The first is the tested deck,
  marked Tested; it can't be removed. Each seat is picked from Opponent pool,
  My decks and Public decks (spec 024 AC-4), the tested deck too. Run stays off
  until every seat has a deck.
- **AC-4** Add to pool offers a pasted list (spec 024 AC-8) and, on each deck in
  My decks and Public decks, an Add to pool button that copies that deck.
- **AC-5** AI profiles, seat order, games, time limit and the unsupported-cards
  step work as in spec 024 (AC-5 to AC-7, AC-11 to AC-13), for every seat.

### Runs

- **AC-6** Below the form, runs are listed newest first, 20 at a time with Show
  more. Each row shows the tested deck, its commander's art, the opponents'
  commanders, who ran it, when, the status (Queued, Playing 4 / 10, Done,
  Cancelled, Failed) and the win rate once there are results.
- **AC-7** An **All / Mine** switch filters the list to everyone's runs or the
  user's own. A search box matches the name or commander of any deck in the
  pod.
- **AC-8** Clicking a row opens the run's own page, `/simulations/:run`, with
  spec 024's full results (AC-15, AC-19 to AC-22), its cancel and delete
  buttons, and a link back to Simulations. It updates while the run is queued
  or playing.
- **AC-9** Replays move to `/simulations/:run/games/:n`. Back returns to the run's
  page. The old `/decks/.../simulations/...` links no longer work.

### Who sees what

- **AC-10** A run is visible to every logged-in user, except a run whose tested
  deck is a private deck: only its owner sees that one. A run whose tested deck
  is a pool deck is visible to everyone and stays when the pool deck is removed.
- **AC-11** The queue lists every queued and playing run. For a run the user
  can't see, it shows "Private deck" instead of the deck's name and doesn't
  open. Other runs open their run page.
- **AC-12** Admins see everything: private deck names in the queue, and every
  run and replay.

### Admin

- **AC-13** Admins can cancel any queued or playing run, from its queue row or
  its run page, with a confirm. Only the user who started a run can delete it.
- **AC-14** Admins have **Cancel all** on the queue: after a confirm it stops
  the playing run (its finished games are kept) and cancels every queued one.
- **AC-15** A run an admin cancelled shows "Cancelled by" and the admin's
  username, to everyone who sees the run.

## Out of scope

- Redirects from the old replay links (decided: they stop working)
- Admins deleting other users' runs
- A Simulate button or link on the deck page
- Notifications when an admin cancels a run

## Assumptions (filled in during writing, not grilled)

- AC-1: the `/api/sims/` endpoints, except the Forge status, need a login.
- AC-3: the tested seat can be moved like the others; in Fixed order its place
  in the form is its place at the table, as before.
- AC-4: spec 024's "Add this deck to pool" button goes, since there is no
  "this deck" on the page; adding a deck from its row replaces it.
- AC-6: the win rate is the tested deck's; a run with no finished games shows
  none.
- AC-7: the switch and search live in the page URL (`?mine=1&q=…`), so Back keeps them.
- AC-10: visibility follows the deck as it is now: making a deck private hides
  its runs from others, making it public shows them.
- AC-11: the queue updates every 3 seconds while anything is queued or playing,
  as in spec 024.
- AC-15: a run the runner cancelled shows just Cancelled.
