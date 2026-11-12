# Spec 024: Pod simulation

Status: Done
Depends on: 004-decks, 008-self-hosting, 022-deck-insights
Followed by: 025-simulations-page (the Simulate tab moves to a Simulations page)

## Goal

Play a Commander deck against other decks with Forge's AI and see how it does:
how often it wins, on which turn, against whom, and what happened in each game,
turn by turn, in the browser.

## Terms

- **Forge**: the open-source MTG engine (GPL-3) whose AI plays the games. It
  runs in its own optional `forge` service.
- **Pod**: the decks at the table, 2 to 6. Seat 1 is the deck being simulated.
- **Opponent pool**: a server-wide list of decks for opponent seats. It starts
  with Forge's Commander precons. Pool decks are copies, apart from any player's deck.
- **Run**: a number of games played by one pod, started by one user.
- **AI profile**: Forge's play style for a seat: Default, Cautious, Reckless or
  Experimental.
- **Unsupported card**: a card Forge doesn't implement.
- **Sim swap**: a supported card that stands in for an unsupported one in
  simulations only.
- **Turn** (in results): the deck's own turn count, as players count it (its
  eighth turn is turn 8). Forge's game turn counts every player's turn; the
  replay shows both.

## Acceptance criteria

### Availability

- **AC-1** When the server has a Forge service, a Commander deck's page has a
  Simulate tab for anyone who can open the deck (the owner, and anyone for a
  public deck). Without a Forge service, or on other formats, the tab is hidden.
- **AC-2** Self-hosters turn Forge on by adding the `forge` service from
  `compose.yml` and setting `FORGE_URL`. The README says how, and how much
  memory Forge needs while a game runs.

### Pod

- **AC-3** The run form shows seat 1 as this deck and empty opponent seats:
  three to start, with Add seat up to five and a remove button on each.
  A run needs at least one opponent.
- **AC-4** An opponent seat is picked from three groups: Opponent pool, My
  decks and Public decks (other users'), each searchable by deck or commander
  name. Only Commander decks with a commander are listed.
- **AC-5** Each seat has an AI profile select, Default to start.
- **AC-6** Seat order is Rotate (default), Random or Fixed. Rotate moves the
  first seat by one each game, so each deck goes first about equally often.
  Random shuffles the seats each game. Fixed keeps the order of the form, which
  can be changed with move up and move down buttons on each seat.
- **AC-7** Games (default 10) and Time limit per game in minutes (default 5)
  take any whole number of 1 or more. A game that reaches the limit is a draw.

### Opponent pool

- **AC-8** The opponent picker has Add to pool with two choices: this deck
  (copied as it is now, named after the deck) or a pasted list in the import
  format, with a name. A pasted list needs a commander.
- **AC-9** Any user can rename or remove any pool deck, precons included.
  Removing asks first. Runs that used a removed deck keep their copy.
- **AC-10** Pool decks show their commander's art, name and who added them
  (Forge for precons).

### Unsupported cards

- **AC-11** Before a run starts, every deck in the pod is checked against
  Forge's card list. If any card is unsupported, Run opens a step listing the
  unsupported cards per deck, each with a swap picker, and the run can't start
  until every one has a swap.
- **AC-12** The swap picker suggests Forge-supported cards: EDHREC's similar
  cards first, then cards sharing the card's first category, within the deck's
  colour identity. Any supported card can be typed in instead.
- **AC-13** Sim swaps never change a player's deck. For a player's deck (yours
  or a public one) they are remembered for the user who chose them and filled
  in on their next run. For a pool deck, a swap replaces the card in the pool
  copy itself, for everyone.

### Queue and runs

- **AC-14** The server plays one run at a time. A started run waits in a queue.
  Above the run form, the Simulate tab shows the queue: the run that is playing
  (deck, user, games done / total) and the queued runs in order, the user's own
  highlighted. It updates while the tab is open.
- **AC-15** Each run copies the pod's lists, sim swaps applied, when it starts.
  Later changes to those decks don't change it, and the run shows the lists it
  used.
- **AC-16** The run list below the form shows the deck's runs, newest first,
  each with who ran it, when, the pod, the status (Queued, Playing 4 / 10,
  Done, Cancelled, Failed) and, when there are results, the win rate.
- **AC-17** The user who started a run can cancel it while it is queued or
  playing (games already finished are kept) and delete it after, both with a
  confirm. Nobody else can.
- **AC-18** Runs on a public deck are visible to anyone who can open the deck.
  Runs on a private deck are visible only to its owner.

### Results

- **AC-19** A run with finished games shows the deck's win rate (wins out of
  finished games) and its average winning turn.
- **AC-20** A table lists each deck in the pod: name, commander, AI profile,
  wins, draws, average winning turn and how many games it went first.
- **AC-21** A game list shows each game's number, winner (or Draw), the turn it
  ended on, the seat order and a link to its replay.
- **AC-22** A game that Forge fails to play shows Failed with Forge's error and
  doesn't count in the stats. The run goes on with the next game.

### Replay

- **AC-23** Each game has its own page with a link that can be shared, visible
  to whoever can see the run. Back returns to the deck's Simulate tab.
- **AC-24** The replay steps through the game one turn at a time with Previous
  and Next buttons, a turn slider and the left and right arrow keys. The header
  shows the turn number, the active player and the result.
- **AC-25** Each player has a panel with name, commander, life and the cards
  they control on the battlefield as small images in rows for creatures, other
  permanents and lands. Tapped cards are turned sideways. Graveyard and exile
  show counts that open a list, and hand and library show their counts.
  Counters and power / toughness show on creatures. Hovering a card shows it large. The active
  player's panel is highlighted, and a player who lost is dimmed with
  "Lost on turn N".
- **AC-26** Panels sit in a grid of 2 columns for up to 4 players, 3 for 5 or
  6, and one column at phone width.
- **AC-27** A column lists the turn's events (casts, attacks, damage, life
  changes, cards entering and leaving play) in order. Clicking an event shows
  the board at that moment. At phone width the events open in a drawer.
- **AC-28** The board is Forge's own game state, recorded after each event, so
  it matches the game exactly. A Log tab on the page shows Forge's full log as
  text.

## Out of scope

- Changing Forge's AI or using a Forge fork (a later spec; the Forge version is
  a build setting so a fork can replace it)
- Toasts or browser notifications when a run finishes
- The cards in hands and libraries (the replay shows only their counts)
- The stack in the replay
- Simulating formats other than Commander
- More than one run playing at once
- Adding a deck to the pool from the deck's menu or another page

## Assumptions (filled in during writing, not grilled)

- AC-1: "Commander deck" is a deck in the Commander format with at least one
  card in the Commander zone; the tab shows on other Commander decks with a hint
  that a commander is needed.
- AC-4: "Public decks" lists other users' public Commander decks; a private
  deck of the runner's own appears under My decks.
- AC-7: there is no upper limit, as decided; the form warns when games ×
  minutes is over 8 hours.
- AC-8: the copy takes the Commander and Mainboard zones; Sideboard and
  Maybeboard are left out. Pool decks don't need 100 cards.
- AC-11: Forge's card list is fetched from the Forge service and cached for a
  day. A double-faced card matches by its front face's name.
- AC-12: up to 10 EDHREC suggestions and 10 category suggestions.
- AC-14: the tab polls every 3 seconds while a run is queued or playing.
- AC-17: cancelling a playing run stops the current game; it isn't counted.
- AC-19: draws and failed games aren't wins; the win rate counts draws in the
  total, failed games not.
- AC-25: a card controlled by another player shows on its controller's panel.
  Commander damage isn't shown.
- AC-6: Forge lets a random player choose who starts; MTG Vault's runner makes
  the first seat in the order start, so Rotate and Fixed hold.
