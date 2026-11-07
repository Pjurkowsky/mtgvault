# Spec 019: Scanning through binder glare

Status: Draft
Depends on: 003-scanner, 007-binder-view, 017-scanner-small-phones

## Goal

Cards behind glossy binder pockets get recognised: the scanner can ignore
glare frames and say to tilt, combine still frames, offer its best guesses
when unsure, and tune the camera. Fast scanning is on for new accounts.

## Acceptance criteria

### Options

- **AC-1** The scanner settings sheet has three switches, all off by default
  and saved to the account: Glare hint, Combine frames, Suggest guesses.
- **AC-2** With every switch off, the scanner behaves as before.

### Glare

- **AC-3** With Glare hint on, a frame where much of the card's art is washed
  out white is not used to identify it, and the status says
  "Glare: tilt the phone". Such frames neither log a card nor break a run of
  agreeing frames.
- **AC-4** A "Glare sensitivity" slider (Low to High, default in the middle)
  shows under Glare hint while it is on. High counts a small washed-out area
  as glare (about 5% of the art), the middle about 20%, Low only a large one
  (about 40%).

### Combine frames

- **AC-5** With Combine frames on, the scanner identifies a still card from
  the average of its last 5 frames (glare frames left out). Moving to another
  card starts over.

### Suggest guesses

- **AC-6** With Suggest guesses on, a card held still for 1.5 s without being
  logged, whose best match scores at least 0.45, shows a strip of its 3 best
  guesses above the result bar: art, name and set, plus a close button. Guesses
  outside locked sets are left out.
- **AC-7** Tapping a guess logs it like a scan (sound, result bar, binder
  pocket), and the scanner treats that card as just logged.
- **AC-8** The strip closes when a guess is tapped, when it is closed, when
  the card moves or leaves, or when a card logs by itself. Scanning keeps
  running while it is open.

### Camera

- **AC-9** The settings sheet has a Camera section with Exposure, Zoom and
  Focus (Auto, or a manual distance slider), each only when the camera
  supports it. Changes apply at once.
- **AC-10** Camera values are remembered on this device and applied whenever
  the scanner opens. Reset returns to the camera's defaults.

### Fast scanning

- **AC-11** Fast scanning is on for new accounts. Existing accounts keep
  their setting.

## Out of scope

- Torch control
- Retraining the recognition model, reading collector numbers
- Camera controls on iPhone Safari beyond what it reports

## Assumptions (filled in during writing, not grilled)

- Washed-out means a pixel bright and nearly colourless. Only the art box is
  measured: glare on the text box barely changed a match on real frames, glare
  on the art broke it from about 20% (AC-3, AC-4).
- Guesses: grilled as "best match 0.45 to under 0.6". On real frames glare gives
  wrong cards at 0.63-0.67 that change between frames, so the strip opens for
  any still card not logged after 1.5 s (AC-6).
- The guess strip keeps the guesses it opened with until it closes (AC-6).
- After the strip is closed with X, it does not reopen for the same still card (AC-8).
- Existing accounts that never saved scanner settings keep Fast scanning off (AC-11).
