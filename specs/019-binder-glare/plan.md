# Plan 019: Scanning through binder glare

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Settings | `ScannerSettings`: `glare_hint`, `glare_sensitivity` (0-100, default 50), `combine_frames`, `suggest_guesses`; `fast` default True. Migration adds rows with `fast=False` for users without one. |
| Glare | Worker samples a grid over the card's art box and returns the washed-out share. With a limit set, a frame over it skips embedding and returns `glare: true`. Limit = 0.40 - 0.35 × sensitivity / 100. |
| Combine | Worker keeps the embeddings of frames whose refined window agrees with the previous one (up to 5), averages and normalises them, and searches the average. |
| Decision | `evaluateFrame` returns a `glare` outcome that keeps the tracker as is. `trackGuesses` (pure) times a still card that has not logged and yields the top 3 allowed candidates. |
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
| `e2e/scanner-glare.spec.ts` (glare feed; camera capabilities stubbed as on Android) | AC-1 to AC-5, AC-8 to AC-10 |
| `e2e/scanner-guesses.spec.ts` (out-of-focus feed) | AC-6 to AC-8 |
| `e2e/scanner-settings.spec.ts` | AC-11 |

## Order

Backend settings, then worker and decision, then UI, then camera, then tests.
