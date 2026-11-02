# Plan 003: Card scanner

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| Recognition | Port manavault's browser pipeline (`pipeline.ts`, `recognizer.ts`, the worker, `scan-decision.ts`, `bundle-cache.ts`) to `frontend/src/scanner/recognition/`. These files keep their MPL-2.0 header naming the source. |
| Runtime | `onnxruntime-web@1.30.0` (WASM) in a Web Worker. |
| Model files | Server-side: a `scanner` app downloads published `scanner-bundle-*` releases from GitHub into `SCANNER_DIR/<version>/`. `printings.json` is skipped; our catalog resolves matches. |
| Matching art to printings | Store Scryfall `illustration_id` and `promo` on `Printing` (sync change). |
| Cart | `CollectionItem.in_cart` flag. Cart rows have no location. The collection, totals, exports and public pages filter `in_cart=False`. |
| Fast scanning | Two routes: `/scan` (normal) and `/scan/fast`, served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`. `credentialless` keeps Scryfall images working without `crossorigin` attributes; browsers without it stay single-threaded. |
| Sounds | Generated with the Web Audio API. No audio files. |
| Settings | `ScannerSettings` (one per user). |

## Backend

### Catalog changes

- `Printing.illustration_id` (uuid, null, indexed) and `Printing.promo` (bool).
  `scryfall.py` reads them, from the front face for double-faced cards.
- The fixture and the dev database need a resync to fill them.

### Cart (`collection`)

- `CollectionItem.in_cart` (bool, default False). It's part of the unique row
  key, so a cart row and an owned row of the same card stay separate. Cart
  rows always have `location = None`.
- `services.ROW_KEY` gains `in_cart`. `edit_item`: setting a location on a
  cart row moves it out of the cart (`in_cart=False`).
- Filters: `location=cart` selects `in_cart=True`. Every other value, or no
  location, adds `in_cart=False`. The item list, bulk actions and exports all
  go through `apply_filters`, so they pick this up.
- Other queries add `in_cart=False`: location totals, the Unfiled count,
  public pages, the directory, and `CardDetailView.owned`.
- `GET /api/locations/` gains `cart: Totals`.
- Bulk `move` always clears `in_cart`, so moving cart cards puts them in the
  collection (AC-21).

### `scanner` app

```
models.py       ScannerSettings(user 1:1, fast, sounds, ding_low, ding_high,
                show_total, locked_sets[]), created on first read
bundles.py      list releases (GitHub API), pick the newest published
                scanner-bundle-*, download manifest + 4 files to
                SCANNER_DIR/<version>.partial, verify sha256 against
                manifest.files, rename into place, write `current`
                (atomic replace); keep the previous version, delete older ones
tasks.py        sync_scanner_bundle (Celery beat daily, 04:00 UTC)
management/commands/sync_scanner_bundle.py   [--from-dir DIR] for tests/offline
resolve.py      gallery id -> catalog printing -> ranked printings (AC-9)
views.py        endpoints below
```

| Method | Path | Auth | Purpose | ACs |
| --- | --- | --- | --- | --- |
| GET | `/api/scanner/bundle/` | login | Current version, constants, file URLs and sizes; 503 if none installed | 3, 24 |
| GET | `/api/scanner/bundles/<version>/<file>` | public | Model file, `Cache-Control: public, max-age=31536000, immutable` | 24 |
| GET, PATCH | `/api/scanner/settings/` | login | Scanner settings | 12, 15, 16 |
| GET | `/api/scanner/locked-illustrations/` | login | Illustration ids printed in the locked sets | 8 |
| POST | `/api/scanner/scans/` | login | `{gallery_id, illustration_id}`: resolve, save to the cart (merge), return the row, the cart totals and whether the price crosses each sound threshold | 5, 9, 10, 13, 14, 17 |
| POST | `/api/scanner/scans/<item_id>/undo/` | login | Remove one copy | 11 |

The model files are public because the worker fetches them without our
bearer token, and they're public on GitHub anyway.

Resolving a gallery id (`resolve.py`):

1. Strip a `-<n>` face suffix. Look up that printing.
2. If it isn't in our catalog (for example digital-only), use any printing
   with the same `illustration_id`. If there's none, return 404 "Card not in
   catalog".
3. Rank every printing of the card: in a locked set, then same illustration,
   then owned by the user, then English, then non-promo, then newest.

### Settings and compose

- `SCANNER_DIR` (default `BASE_DIR / 'var/scanner'`, gitignored).
- Prod compose: a `scanner` named volume on backend and worker. Dev: inside
  the bind mount.
- nginx: `location = /scan/fast` adds the two isolation headers. The Vite dev
  server gets a small plugin that does the same for `/scan/fast`.

## Frontend

```
src/scanner/
  recognition/            ported from manavault (MPL-2.0 headers)
    pipeline.ts           geometry + constants
    recognizer.ts         detector → embed → search, tracking shortcut
    recognizer.worker.ts  loads the bundle, answers identify requests
    bundle-cache.ts       Cache Storage per version
    messages.ts           worker protocol
  decision.ts             evaluateFrame, pacing (ported scan-decision.ts)
  camera.ts               useCamera: getUserMedia, grabFrame (640 px fit)
  sounds.ts               click and dings (Web Audio)
  useScanner.ts           frame loop: grab → worker → decision → POST scan
pages/ScanPage.vue        full-screen viewfinder, status, result bar, sheets
components/scanner/
  ResultBar.vue           image, name, set, Price, finish toggle, +1, change printing, undo
  ScannerSettingsSheet.vue sounds, thresholds, total, locked sets, threads info
  RunningTotal.vue
```

- **Routes:** `/scan` and `/scan/fast` (both need login) render `ScanPage`.
  The camera button navigates to `/scan`, or does a full page load of
  `/scan/fast` when Fast scanning is on.
- **Worker threads:** `crossOriginIsolated ? 0 (auto) : 1`.
- **Locked sets:** `allowed(candidate)` checks the candidate's
  `illustration_id` against the locked illustrations list.
- **Cart:**
  - The Locations grid gets a Cart tile.
  - `LocationPage` handles `id = 'cart'`.
  - `CardBrowser` gets `cart` mode: no Add card or Import, a "Move to want
    list" button (disabled) in the bulk bar, and a scanner button.
  - `EditItemDialog` hides location for cart rows.
- **Settings page:** a "Scanner" card with the Fast scanning switch.
- **Camera button:** in the browser toolbar, an `IconButton` "Scan cards".

## Tests

### Backend checks during tasks (shell)

- Bundle install from a local folder, with a broken hash rejected.
- Resolution order with locked sets and owned printings.
- Cart rows hidden from every collection endpoint.

### End-to-end

| File | Covers |
| --- | --- |
| `cart.spec.ts` | AC-17 to AC-22: scans via the API endpoint, the Cart tile, the cart page, move, hidden from the collection |
| `scanner-settings.spec.ts` | AC-12, AC-15, AC-16: the settings sheet and the Fast scanning switch |
| `scanner.spec.ts` (project `scanner`) | AC-1 to AC-11, AC-13, AC-14: the real models and a fake camera |

The `scanner` Playwright project:
- Chromium launches with `--use-fake-device-for-media-stream
  --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=<card>.mjpeg`.
- The MJPEG is a Scryfall card image in our fixture (Sol Ring C21), written
  once by a setup step.
- The model bundle is installed into `var/scanner-e2e` by
  `sync_scanner_bundle`, once per machine (about 50 MB, needs network the
  first time).
- This project runs after the others, like the performance tests.

### Gaps

- **Real phones:** the camera tests use a still image. Real phones (focus,
  glare, motion) are checked by hand at wrap-up.
- **Threads:** the multi-threaded speedup isn't asserted. The test only
  checks that `/scan/fast` is cross-origin isolated.

## Order of work

1. **Catalog and cart backend:** `illustration_id`/`promo`, `in_cart`,
   filters and totals, regenerated API types.
2. **Scanner backend:** settings, bundle install command and Celery task,
   resolve and scan endpoints, file serving, `/scan/fast` headers.
3. **Recognition port:** onnxruntime-web, the worker, a smoke test against
   the real bundle with a card image.
4. **Scanner UI:** camera, frame loop, status, result bar, sounds, running
   total, settings sheet, Fast scanning.
5. **Cart UI:** tile, cart page, move, want-list button.
6. **Tests:** cart, settings, scanner with the fake camera, then the full
   suite.
7. **Wrap up:** check on a real phone (if available), READMEs with
   MPL/credits, spec status.
