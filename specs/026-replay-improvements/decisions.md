# 026 Replay improvements: decisions

Depends on: 024-pod-simulation, 025-simulations-page

## Requests

1. Show each player's hand and library; the view is just a list of cards.
2. Cards can be clicked.
3. Show who is attacking whom.
4. Show which creatures blocked and which went to the graveyard.
5. Player panel: graveyard, exile and the other counts always at the bottom.
6. Don't shift the layout when cards are added; keep enough room.
7. The turn's events in a sidebar like the binder's Unplaced sidebar.
8. Step through the events one by one (card by card) in the sidebar.
9. Autoplay the game, with settings for how fast.

## Research

- The runner (`docker/forge/MtgvaultSim.java`) writes a step per Forge log entry,
  with a board snapshot when it changed: life, lost, hand and library **counts**,
  battlefield (row, tapped, token, power / toughness, counters, attached to,
  owner), graveyard, exile, commanders. No hand or library cards, no combat.
- Forge knows both: `Player.getCardsIn(ZoneType.Hand / Library)` (library top
  first) and `game.getCombat()` (attackers, the player or planeswalker each
  attacks, blockers per attacker) while combat lasts.
- So requests 1, 3 and 4 need a runner change, a new Forge image, and new
  recorded games for the fake Forge. Games played before keep counts only.
- Size: a 4-player game is about 30 KB gzipped today. Libraries and hands in
  every snapshot repeat a lot and compress well.
- Replay page (`SimGamePage.vue`): players in a grid, events in a fixed column
  (a drawer on phones). `ReplayPlayer` rows grow with their cards, so panels
  change height; graveyard and exile are popovers in the footer.
- The binder's `UnplacedSidebar`: fixed to the window's right edge, slides over
  the page, an arrow tab on the edge shows and hides it, remembered per browser.

## Round 1

1. Old replays keep hand and library **counts**; their lists say the cards
   weren't recorded for that game.
2. The library lists **top card first**.
3. Hand, Library, Graveyard and Exile each open **small card images**.
4. Clicking a card (board or list) shows its **large image**, full screen.

## Round 2

5. Combat: **arrows** from each attacker to the player (or planeswalker) it
   attacks, and from each blocker to the creature it blocks.
6. Deaths: **both**, each an option the user chooses: a creature that dies stays
   in its spot faded with a skull for that step; cards that just reached a
   graveyard are highlighted in its list.
7. Layout: every row keeps room for one line of cards even when empty, so the
   first card doesn't shift anything. Wrapping to a second line may shift.
8. Events move into a **sidebar like Unplaced**: right edge, slides over the
   page, arrow tab, remembered.

## Round 3

9. **← →** step one event, **Shift + ← →** a whole turn. The sidebar has
   Previous / Next event buttons that run across turns.
10. Autoplay settings: **speed**, **step by event or turn**, **pause at combat**,
    **follow a player**.
11. The death options are **settings in the sidebar**.
12. Arrows show **during combat steps on every screen size**.

## Round 4

13. Following a player, autoplay plays **only their turns**; manual stepping
    still goes everywhere.
14. **Play / Pause next to the turn buttons**; speed, step unit, pause at combat,
    follow and the death options in a settings section of the sidebar.

## After building

15. The zone dialogs fill most of the screen with S / M / L card sizes; closing a
    full-screen card leaves the dialog open (bug).
16. Card names in events are **hoverable**, each showing its card.
17. Hovering a ghost shows the card and **what hit it this turn**: the events
    naming it, the last three, else "Put into the graveyard".
