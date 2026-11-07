# Plan 019: Scanning through binder glare

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Settings | `ScannerSettings`: `glare_hint`, `glare_sensitivity` (0-100, default 50), `combine_frames`, `suggest_guesses`; `fast` default True. Migration adds rows with `fast=False` for users without one. |
| Glare | Worker samples a grid inside the card quad (inset past the border) and returns the washed-out share. With a limit set, a frame over it skips embedding and returns `glare: true`. Limit = 0.40 - 0.35 × sensitivity / 100. |
| Combine | Worker keeps the embeddings of frames whose refined window agrees with the previous one (up to 5), averages and normalises them, and searches the average. |
| Decision | `evaluateFrame` returns a `glare` outcome that keeps the tracker as is. `trackGuesses` (pure) times a still, unsure card and yields the top 3 allowed candidates. |
| Guesses UI | `GuessStrip.vue` above the result bar; a tap calls `useScanner.pick` (`markLogged`, then the usual log). |
| Camera | `useCamera` reads `getCapabilities`/`getSettings`, applies `exposureCompensation`, `zoom`, `focusMode`/`focusDistance` with `applyConstraints`, saves to localStorage, resets to the values read at start. |
| Slider | shadcn-vue `Slider` on reka-ui. |

## Files

- `backend/scanner/models.py`, `serializers.py`, migration 0002
- `frontend/src/scanner/recognition/{pipeline,recognizer,recognizer.worker,messages,client}.ts`: glare share, combine, options per frame
- `frontend/src/scanner/decision.ts`: glare outcome, `trackGuesses`
- `frontend/src/scanner/useScanner.ts`: options, guesses, `pick`
- `frontend/src/scanner/camera.ts`: camera controls
- `frontend/src/components/scanner/ScannerSettingsSheet.vue`, `GuessStrip.vue`, `components/ui/slider/`
- `frontend/src/pages/ScanPage.vue`: glare status, strip
- `frontend/src/pages/SettingsPage.vue`: fast default

## Tests

| Test | ACs |
|---|---|
| `e2e/scanner-glare.spec.ts` (scanner project; glare camera feed) | AC-1 to AC-8 |
| `e2e/scanner-settings.spec.ts` | AC-1, AC-4, AC-9, AC-10, AC-11 |

## Order

Backend settings, then worker and decision, then UI, then camera, then tests.
