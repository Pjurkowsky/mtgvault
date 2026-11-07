# Spec 017: Scanner on small phones, reliable sound (decisions)

Status: Written into spec.md (2026-11-07).

## Requests

- "fix scanning view on mobile with less resolution/width"
- "fix also the sound in scanning view, it is not always present and sometimes
  it is almost silent no matter the price"

## Research

- At 320px wide, scanning into a deck or binder overflows the top bar: the
  destination name and total wrap over three lines, the binder slot wraps,
  Change and the settings button go off-screen. The result bar's buttons stack
  into three rows and cover a third of the screen.
- The scanner is `fixed inset-0`, but `html { scrollbar-gutter: stable }`
  (spec 014) leaves an empty strip where a desktop scrollbar would be.
- Sounds (`scanner/sounds.ts`): the AudioContext is made on the first sound or
  a tap inside the scanner. Browsers keep it suspended until a tap on the page,
  so scans before a tap are silent. `resume()` is not awaited: a tone scheduled
  while suspended plays from where the clock has moved on, so only its fading
  tail is heard ("almost silent"). iOS also suspends ("interrupted") audio
  after switching apps.

## Grilling (2026-11-07)

- Top bar: one row, truncate everything; Change becomes an icon button.
- Result bar: compact on narrow phones, icon buttons for Change printing and
  Undo.
- Sound: the sounds must always play; no volume changes asked for.
- iPhone: respect the silent switch; music keeps playing.
