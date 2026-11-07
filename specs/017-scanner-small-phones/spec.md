# Spec 017: Scanner on small phones, reliable sound

Status: Done
Depends on: 003-scanner, 005-deck-improvements, 007-binder-view

## Goal

The scanner fits a 320px-wide phone in every mode, and every logged card makes
its sound.

## Acceptance criteria

### Layout

- **AC-1** The top bar stays one row at 320px in every mode (collection, deck,
  binder): the destination and binder slot truncate, Change is an icon button
  with a tooltip, and close and settings stay on screen.
- **AC-2** Below 400px the result bar is compact: a smaller thumbnail, and
  Change printing and Undo as icon buttons with tooltips, so its actions fit
  one row next to +1 (and the finish toggle when it has room).
- **AC-3** The scanner fills the whole screen: no empty strip at the edge.

### Sound

- **AC-4** The first tap anywhere in the app (such as the one that opens the
  scanner) enables scanner sounds, so the first logged card already sounds.
- **AC-5** Each sound plays whole: when the browser had paused audio (after a
  while, or switching apps), it resumes before the sound starts.

## Out of scope

- Volume settings, new sounds
- Playing through the iPhone silent switch

## Assumptions

- The sounds keep their pitch and level (spec 003, AC-13).
