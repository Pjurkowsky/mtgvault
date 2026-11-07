# Spec 018: Edit single copies

Status: Done
Depends on: 001-collection, 007-binder-view

## Goal

Changing one copy of a card never changes its identical twins.

## Acceptance criteria

- **AC-1** Edit from a binder pocket (menu or card dialog) changes only that
  pocket's copy: it becomes its own row with the changes, keeps its pocket,
  and the other copies keep theirs. The dialog shows no Quantity there.
- **AC-2** In the collection, editing a row of several copies shows **Change
  [N] of M copies**, all by default. Fewer splits those copies off with the
  changes; Quantity then isn't shown. A split row that matches another row
  merges with it (the merge rule).
- **AC-3** Delete from a binder pocket removes only that copy: the row loses
  one copy and the pocket empties. The confirmation says 1 card.
- **AC-4** Split copies keep their purchase price, price when added and added
  date.

## Assumptions

- When copies split off in the collection, the pockets beyond what the
  remaining copies need go with them, newest first.
