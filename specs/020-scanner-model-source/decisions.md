# Spec 020 decisions: where the scanner model comes from

## Requests

1. "i would like to help this model in detecing cards that are placed in the binder, so cards
   are seen by the camera with some glare or overlighting" (the model work is Oracle spec 001)
2. "if this would be better we will replace theirs with ours"
3. "add some setting from where the model should be taken"

## Research

- `scanner/bundles.py` installs the newest `scanner-bundle-*` release of cfbender/manavault,
  checks every file's SHA-256 against the manifest and switches `current` atomically.
  `install_from_dir` installs one folder (`sync_scanner_bundle --from-dir`), by hand only.
- The Celery beat job `sync-scanner-bundle-daily` (04:00) always installs from cfbender/manavault.
- Oracle's local publish writes `<folder>/<version>/` plus `current` and `previous` links.
- Staff users already have an Admin menu item (spec 008 AC-20); `is_staff` is on the user API.
- e2e runs no Celery worker.

## Grilling (held in Oracle's spec 001 decisions, rounds 2-7)

- Bundles reach MTG Vault through a folder on the server, not a GitHub release.
- The model source is set in the app, on a staff-only "Scanner model" section of Settings,
  not in Django admin or an env var.
- Source: GitHub releases (owner/repo, default cfbender/manavault) or Server folder (path).
- A folder source installs the newest bundle in the folder by manifest `created`.
- Saving installs right away; the daily sync follows the saved source.
- It shows the installed version and date, the last sync result with its error, and Sync now.
  A failed sync shows a red alert and keeps the previous bundle.
- Copying bundles from the training desktop to the server is out of scope.
