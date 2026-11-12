# 027 Deck versions: decisions

Depends on: 004-decks, 005-deck-improvements, 024-pod-simulation, 025-simulations-page

## Requests

1. Deck versions: save a version of a deck.
2. Branch out from a version into other versions.
3. Test versions in the simulation, for example.
4. A diff view between versions in the deck: choose two different ones and
   compare the changes between them (added mid-grilling).

## Research

- A deck (`decks.Deck`) is its cards (`DeckCard`: printing, zone, quantity,
  categories, swap pairs), plus format, visibility, a box in the collection and
  chosen token printings. There is no copy or history of a deck today.
- Simulations (`sims.SimSeat`) already store a copy of each seat's cards and a
  label when a run starts, so a run doesn't change when the deck does. Seats come
  from My decks, Public decks or the Opponent pool (`source` deck or pool).
- Other sites: Archidekt saves **snapshots** (frozen copies of a deck you can
  view, compare with the current list and restore). Moxfield keeps a
  **changelog** of every edit and lets you **copy** a deck into a new one.

## Round 1

1. **Branches and saved versions**: a deck has branches (Main plus others), each
   an editable list you switch between; on any branch you save frozen, named
   versions; a new branch can start from any version.
2. A version or branch keeps **cards, zones, quantities, printings and
   categories**. Swap proposals, token printings and the box stay with the deck.
3. Simulations: any seat can be a **branch or saved version**, and **Compare
   versions** runs 2+ versions of the tested deck against the same opponents
   and shows their win rates side by side.
4. Versions and branches are **visible like the deck**: on a public deck others
   view them (read only) and can pick them in Simulations.

## Round 2

5. Branches and versions live in a **side panel** on the deck page.
6. **Main** counts for the rest of the app (missing cards, the box, scans);
   other branches only show which cards you own. "Make main" swaps Main.
7. A saved version can be **viewed** read only, **compared**, **restored** (the
   list before is saved as a version first) and **branched from**.
8. Versions are saved **by hand**, name and note optional (empty name: v1, v2…
   per branch); saved automatically only before a restore; no limit.

## Round 3

9. The side panel works **like Unplaced** (right edge, slides over, arrow tab,
   remembered): branches on top (switch, New branch, Rename, Delete, Make main),
   then the shown branch's versions newest first with Save version; each version
   has View, Compare, Restore, Branch from it. The shown branch is in the URL.
10. Comparing two versions opens a **dialog from the side panel**.
11. Swap proposals live **with each branch** (they link its cards); a new branch
    or version keeps the swaps of the list it came from. (Replaces "swaps stay
    with the deck" in answer 2.)
12. Compare versions in Simulations: **both, as an option**: one run where each
    version plays the same games, or separate runs grouped together.

## Round 4

13. The compare dialog: **two pickers**, each any saved version of any branch or
    a branch's current list (default: the version Compare was clicked on vs the
    shown branch now), a ⇄ flip, then Added, Removed, Quantity changed and Moved
    zone with small card images and totals.
14. Compare versions in the run form: a **One run / Separate runs** switch. One
    run: every version plays the same games (same seat orders and seeds), one
    queue entry, one results page side by side. Separate runs: one run per
    version, started together, grouped on the Simulations page as one row that
    opens a comparison.
15. Viewing a version: the **deck page read only** (Deck, Stats, Combos) with a
    bar: "Viewing Main v2 · Restore · Branch from it · Back to Main"; the version
    is in the URL.
16. Versions and branches can be **deleted with a confirm**; deleting a branch
    deletes its versions; Main can't be deleted; finished runs keep their copy.

## Round 5

17. On a branch other than Main, Missing cards, Optimize, the box and scanning
    are **shown and act on that branch**. (Conflicts with answer 6; see round 6.)
18. A simulation seat picks the deck, then a **version dropdown**: Main (current)
    by default, then each branch's current list and saved versions. Runs label
    the seat "Deck · Branch v1" and search finds it.
19. Others **can copy** a public deck's branch or version into their own decks.

## Round 6

20. **Views follow the branch, the box stays Main**: Missing cards and Optimize
    work on the open branch; the deck's box and scanning into the deck only on
    Main (hidden on other branches). (Settles answers 6 and 17.)
21. Copying is **like a fork**.
22. **Fork** copies the whole deck into your decks, private: every branch and
    saved version, swaps included. It shows "Forked from <user> / <deck>"
    linking back while that deck is public; the original shows a fork count.
    Forking while viewing a branch or version makes that branch your Main.
