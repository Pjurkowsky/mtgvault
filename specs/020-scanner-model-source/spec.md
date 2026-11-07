# Spec 020: Scanner model source

Status: Draft
Depends on: 003-scanner, 008 (staff Admin item), Oracle 001-binder-glare

## Goal

Staff choose where the scanner's recognition model comes from: ManaVault's
GitHub releases, as today, or a folder on the server holding bundles we train
ourselves (Oracle's binder-glare model). Switching installs at once.

## Acceptance criteria

### Settings section

- **AC-1** Staff users see a "Scanner model" section on Settings; other users
  don't, and the API refuses them.
- **AC-2** It shows the installed model's version and date, and a Source
  select: GitHub releases (with a Repository field, default
  `cfbender/manavault`) or Server folder (with a Path field).
- **AC-3** Save stores the source and installs from it right away. While it
  installs the section says so; then it shows the new version or the error.
- **AC-4** Sync now installs the newest model from the saved source again.
- **AC-5** A failed install shows its error in a red alert and the previous
  model stays installed and in use.

### Sources

- **AC-6** A folder source installs the newest bundle in the folder (one
  subfolder per bundle, newest by its manifest's `created`), checking every
  file against the manifest like a release.
- **AC-7** A GitHub source installs the newest `scanner-bundle-*` release of
  that repository.
- **AC-8** The daily sync and `manage.py sync_scanner_bundle` follow the saved
  source. Without a saved source it is GitHub, cfbender/manavault, as before.

## Out of scope

- Copying bundles from the training machine to the server
- Uploading a bundle through the browser
- Per-user model choice

## Assumptions (filled in during writing, not grilled)

- The install runs in the background of the web server, so Save returns at
  once; the section checks every 2 s until it ends. One install at a time (AC-3, AC-4).
- The repository must look like `owner/name` and the path must be absolute
  (AC-2).
- The folder's `current` and `previous` links (Oracle's layout) are ignored;
  the newest real subfolder wins (AC-6).
- The last sync result is the latest install attempt from any trigger: Save,
  Sync now, the daily job or the command (AC-3 to AC-5, AC-8).
