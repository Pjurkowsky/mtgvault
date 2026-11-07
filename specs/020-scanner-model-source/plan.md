# Plan 020: Scanner model source

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Storage | `ScannerSource` singleton (pk 1): `kind` github/folder, `repo`, `path`, `syncing`, `last_sync_at`, `last_error`. Migration 0003. |
| Install | `bundles.sync()` reads the source, runs `install_latest(repo)` or `install_newest_in(path)`, records the result. A file lock in `SCANNER_DIR` keeps one install at a time. |
| Folder | Subfolders (not links) with `manifest.json`, newest by `created` then name; `install_from_dir`. |
| Trigger | PUT saves and starts `sync` in a daemon thread; POST `sync/` the same. The Celery task and the command call `sync()`. |
| API | `GET/PUT /api/scanner/source/`, `POST /api/scanner/source/sync/`, `IsAdminUser`. Response adds `installed` {version, created}. |
| UI | `ScannerSourceCard.vue` on Settings (staff only): Select, Input, Save, Sync now, status, destructive Alert; polls while `syncing`. |

## Files

- `backend/scanner/models.py`, migration `0003_scanner_source.py`
- `backend/scanner/bundles.py`, `tasks.py`, `management/commands/sync_scanner_bundle.py`
- `backend/scanner/serializers.py`, `views.py`, `urls.py`
- `frontend/src/components/settings/ScannerSourceCard.vue`, `frontend/src/pages/SettingsPage.vue`
- `backend/openapi.yaml`, `frontend/src/api/schema.d.ts`

## Tests

| Test | ACs |
|---|---|
| `e2e/scanner-source.spec.ts` | AC-1 to AC-6, AC-8 |

AC-7 (GitHub) is the existing release install with the repository swapped; the e2e suite does
not reach GitHub beyond the first bundle download.

## Order

Model and install logic, API, UI, tests.
