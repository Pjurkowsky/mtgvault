# Spec 019 decisions: scanning through binder glare

## Requests

1. "how can we improve scanner so it could actually work with the reflections from binder?"
2. "start the spec on the binder glare" (ideas 1-3 from the answer: glare detection with a
   tilt hint, combining frames as you tilt, picking from the top guesses when unsure)

## Research

- Per frame the worker finds the card (detector, refined pass), embeds it (128-dim vector,
  `embed.onnx`) and searches the gallery (`search.onnx`, top 5, each with an art_crop URL).
- `decision.ts`: never log below 0.6; a clear match (≥ 0.75 and 0.08 ahead) needs 2 agreeing
  still frames, any other 3. A washed-out art matches the blank "Whiteout" art and is ignored.
- Nothing measures glare today; each frame is judged on its own.
- Embeddings can be averaged in the worker while the card stays in the same window (the
  tracked/seed path), then searched once.
- Test camera: one still MJPEG frame of Sol Ring on a grey table (e2e/camera.setup.ts); a glare
  frame can be drawn on top of it the same way.

## Round 1

- Glare: skip frames with a lot of washed-out card, status pill "Glare: tilt the phone".
- Combine: always average the fingerprints of the last few still frames (glare frames left out).
- Unsure: after ~1.5 s of a still card scoring 0.45-0.6, show the top 3 guesses to tap.
- Modes: all (collection, deck, binder).

## Round 2

- Guesses: a strip of 3 art thumbnails (name + set) above the result bar, with an X. Closes on a
  tap, X, another card, or an automatic log. Scanning keeps running.
- Guesses respect locked sets.
- A tapped guess counts as just logged (no automatic re-log of the same card).
- Guesses can be turned off in scanner settings.

## Request 3 (mid-round)

- "made all those changes as options in scanner settings"
- "also make fast scanning as a default"
- Research: Fast scanning is `ScannerSettings.fast` (default False, spec 003 AC-16), a switch on
  the Settings page; when on the scanner opens /scan/fast (cross-origin isolated, several threads).
  The scanner settings sheet holds Sounds, ding thresholds, Running total, Locked sets.

## Round 3

- Three switches in the scanner settings sheet (Glare hint, Combine frames, Suggest guesses),
  all off by default, saved to the account.
- Fast scanning: on by default for new accounts only; existing accounts keep their value.
- The glare limit is a slider in the settings sheet.

## Round 4

- "Glare sensitivity" slider, Low to High, shown only while Glare hint is on. High ≈ 5% of the
  card washed out counts as glare, Low ≈ 40%, default in the middle (≈ 20%).

## Request 4

- "could you also enable to tweak some camera options that could help?"
- Research: camera.ts asks for the rear camera at 1920x1080 and sets nothing else. A track's
  `getCapabilities()` lists what can be changed (`exposureMode`/`exposureCompensation`, `zoom`,
  `focusMode`/`focusDistance`, `torch`), set with `applyConstraints`. Chrome on Android reports
  most of them; Safari on iPhone few or none.

## Round 5

- Controls: Exposure slider, Zoom slider, Focus (auto, or a manual distance slider). No torch.
- Each shows only when the camera supports it.
- In a Camera section of the scanner settings sheet; changes apply live.
- Saved per device (this browser), not on the account.
- Camera defaults until changed; a Reset button restores them.
