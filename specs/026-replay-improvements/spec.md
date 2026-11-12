# Spec 026: Replay improvements

Status: Done
Depends on: 024-pod-simulation, 025-simulations-page

## Goal

Follow a simulated game the way it was played: every player's hand and
library, who attacks whom and who blocks, what dies, step by step or on
autoplay, on a board that stays still while cards come and go.

## Terms

- **Step**: one event of the game (spec 024 AC-27), with the board right after it.
- **Combat**: from attackers being declared until combat ends.
- **Older game**: a game recorded before this spec, without hand, library and
  combat details.

## Acceptance criteria

### Zones

- **AC-1** Each player's panel ends with Hand, Library, Graveyard and Exile, each
  with its count, always at the bottom of the panel.
- **AC-2** Clicking one opens its cards as images in a dialog that fills most of
  the screen, with S / M / L card sizes (remembered). The library lists its top
  card first.
- **AC-3** In an older game, Hand and Library show their counts and opening them
  says the cards weren't recorded for this game.

### Cards

- **AC-4** Clicking any card, on the battlefield, in a zone or a commander,
  shows its large image full screen. Closing it leaves an open zone dialog open.
- **AC-16** With players side by side, the board is mirrored toward its centre:
  the left column's rows, labels and zones line up on the right; the right
  column's stay on the left, with the player's life on the left of their header.
- **AC-17** Power / toughness counters show their total: two +1/+1 counters read
  "+2/+2". Other counters show how many, as "2 Finality" (one shows just its name).
- **AC-5** Each battlefield row (Creatures, Other, Lands) keeps room for one line
  of cards while empty, so the first card entering doesn't move anything.

### Combat

- **AC-6** During combat, an arrow runs from each attacking creature to the
  player or planeswalker it attacks, and from each blocking creature to the
  creature it blocks, on every screen size.
- **AC-7** With **Show deaths on the board** on, a creature or other permanent
  that left the battlefield for a graveyard at this step stays in its place,
  faded with a skull, for this step only.
- **AC-8** With **Highlight new graveyard cards** on, cards that reached a
  graveyard at this step are highlighted in its list, and its count is marked.

- **AC-15** Hovering a card that died (AC-7) shows the card and why: this turn's
  events that name it, the last three, for example "Blasphemous Act (157) deals
  13 damage to Pilgrim's Eye (232)." With none: "Put into the graveyard".

### Events and stepping

- **AC-9** The turn's events sit in a sidebar on the window's right edge, like
  the binder's Unplaced sidebar: it slides over the page, an arrow tab shows and
  hides it, and the choice is remembered.
- **AC-10** The sidebar has Previous and Next event buttons that run across
  turns. **← →** step one event, **Shift + ← →** a whole turn. The current event
  is highlighted and scrolled into view.
- **AC-14** Card names in the events are underlined: hovering one shows the card,
  clicking shows it full screen.

- **AC-18** The controls above the board work like a movie player: previous
  turn (double arrow), previous event, Play / Pause, next event, next turn
  (double arrow).

### Autoplay

- **AC-11** Play / Pause next to the turn buttons steps through the game by
  itself until the end or Pause.
- **AC-12** The sidebar's settings set the speed (Slow 2 s, Normal 1 s, Fast
  0.4 s, Very fast 0.1 s a step), whether autoplay steps by event or by turn,
  Pause at combat (autoplay stops when attackers are declared) and Follow a
  player (autoplay plays only that player's turns). Manual stepping isn't
  affected by Follow.
- **AC-13** The settings and the two death options (AC-7, AC-8, both on to
  start) are remembered in the browser.

## Out of scope

- Turning older games into new ones (they keep counts only)
- The stack, and cards being cast before they resolve
- Commander damage
- Showing face-down cards' real names

## Assumptions (filled in during writing, not grilled)

- AC-2: a hidden
  face-down card shows as "Face-down card".
- AC-4: the large image is the card's newest printing, as the board shows;
  a token shows its token image.
- AC-6: an attack on a planeswalker points at that card; arrows redraw when
  the window is resized or the sidebar opens.
- AC-7: "this step" is the step where the card left; a card exiled or bounced
  just disappears.
- AC-9: the sidebar starts open on a screen 1280 px or wider and closed on smaller ones.
  On those wide screens the page leaves room for it while open, so it covers none
  of the board; the board doesn't move sideways.
- AC-10: stepping past a turn's last event goes to the next turn's first event;
  a turn without events counts as one step.
- AC-14: names are matched against the game's cards, after the players' deck
  names, so "Krenko Forest" isn't read as Forest.
- AC-15: the card names in the reason are bold, not hoverable (it already sits in
  a hover preview).
- AC-16: with three columns (five or six players) the middle column is centred;
  on a phone (one column) nothing changes.
- AC-11: Play at the end starts again from the first step; any manual step,
  turn change or the slider pauses autoplay.
- AC-12: Pause at combat stops on the step where attackers are declared;
  Follow skips to that player's next turn and plays its steps at the set speed.
