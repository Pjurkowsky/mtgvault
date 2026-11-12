# Spec 027: Deck versions

Status: Done
Depends on: 004-decks, 005-deck-improvements, 024-pod-simulation, 025-simulations-page

## Goal

Try ideas on a deck without losing what worked: keep several lists of one deck
side by side, save versions to go back to, see what changed between any two,
and let the simulator say which list wins more.

## Terms

- **Branch**: one editable list of a deck. Every deck has **Main**, the deck you
  own and build; other branches are ideas ("Aggro", "Budget").
- **Version**: a frozen copy of a branch's list at a moment, with a number
  (v1, v2… per branch), an optional name and note.
- **List**: a branch's current cards or a version's cards: every card with its
  zone, quantity, printing, categories and swap proposals.
- **Fork**: your own private copy of someone's public deck, with its history.

## Acceptance criteria

### Branches

- **AC-1** The deck page has a versions panel on the window's right edge, like
  the binder's Unplaced sidebar: it slides over the page, an arrow tab shows and
  hides it, and the choice is remembered.
- **AC-2** The panel lists the deck's branches, Main first. Clicking one shows
  that branch on the deck page; the branch is in the URL, so a link opens it.
- **AC-3** New branch makes a named branch from the shown branch's list or from
  a version (Branch from it, AC-9). The panel shows where each branch came from
  ("from Main v2").
- **AC-4** A branch can be renamed, made Main (the old Main becomes an ordinary
  branch) and deleted after a confirm, which deletes its versions too. Main
  can't be deleted.
- **AC-5** Every branch is edited the same way: adding, removing, importing,
  categories, swap proposals, Missing cards and Optimize work on the shown
  branch. The deck's box and scanning into the deck work on Main only and are
  hidden on other branches.
- **AC-6** Everywhere else, a deck is its Main: deck lists and tiles, card
  counts in the collection, Wants, scanning, and Simulations unless a seat
  picks a branch or version (AC-17).

### Versions

- **AC-7** The panel lists the shown branch's versions, newest first, each with
  its number, name and date. Save version asks for an optional name and note
  and freezes the branch's list.
- **AC-8** View opens the version on the deck page, read only (Deck, Stats and
  Combos), under a bar "Viewing Main v2" with Restore, Branch from it and Back.
  The version is in the URL.
- **AC-9** Branch from it makes a new named branch with the version's list.
- **AC-10** Restore, after a confirm, saves the branch's current list as a
  version ("Before restoring v2") and replaces it with the version's list.
- **AC-11** A version can be deleted after a confirm.

### Compare

- **AC-12** Compare opens a dialog with two pickers. Each picks any version of
  any branch, or a branch's current list; it starts with the version Compare was
  clicked on against the shown branch now. A ⇄ button swaps the sides.
- **AC-13** The dialog lists, from the first list to the second, cards Added,
  Removed, with a Quantity change (30 → 28) and Moved to another zone
  (Main → Maybe), each with small card images, and the totals (+12 −10).

### Others' decks

- **AC-14** On a public deck, others see the panel read only: they switch
  branches, view versions and compare, but don't save, restore or change
  anything.
- **AC-15** Fork, on anyone's public deck and your own decks, copies the deck
  into your decks, private, with every branch and version. Forked while viewing
  a branch or version, that list becomes your Main. The fork shows "Forked from
  user / deck" (a link while that deck is public); the original shows how many
  forks it has.

### Simulations

- **AC-16** After a seat's deck is picked, a dropdown picks its list: Main
  (current) to start, then each branch's current list and every version. Runs
  name the seat "Deck · Branch v1", and the run search finds it.
- **AC-17** The run form has **Compare versions** for the tested seat: pick 2 to
  4 lists of the tested deck, and choose **One run** or **Separate runs**.
- **AC-18** One run: each list plays the set number of games against the same
  opponents, with the same seat orders and seeds, as one queue entry. Its page
  shows each list's win rate, average win turn and games side by side.
- **AC-19** Separate runs: one run per list, started together. The Simulations
  list shows them as one row that opens a comparison of their results, and each
  run still has its own page.

## Out of scope

- Merging branches
- A history of every edit (versions are saved by hand)
- Versions of token printings, the box or the deck's name, format and
  visibility (they belong to the deck)
- Forking a private deck of someone else

## Assumptions (filled in during writing, not grilled)

- AC-2: existing decks become a Main branch with no versions. Branch names are
  unique in a deck, up to 40 characters.
- AC-3: New branch copies the list as it is, swap proposals included.
- AC-5: legality, combos, insights and the Stats tab use the shown list.
- AC-7: versions save the list only; a version of an empty branch is allowed.
  No limit on how many.
- AC-8: Back returns to the version's branch.
- AC-12: picking the same list on both sides shows "No changes". Compare from the
  panel's header starts with the shown branch's newest version, or Main when it has none.
- AC-13: cards are matched by card (oracle id) and zone; a printing change alone
  isn't a change.
- AC-15: the fork is named "<deck>" (or "<deck> (2)" when you have one with that
  name); its box, token printings and Simulations runs aren't copied.
- AC-16: a run keeps its own copy of each list, so deleting a branch or version
  leaves finished runs as they are. The dropdown lists each branch's current list
  followed by its versions. A list with no commander can't play.
- AC-17: Compare versions needs the tested seat's deck to have 2 or more lists;
  the total games are lists × games and the time limit is per game, as now.
- AC-18: a One run's win rate on the Simulations list is its best list's, with
  that list's name.
