# Plan 014: Export options and steady layout

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Layout | `style.css`: `html { overflow-y: auto; scrollbar-gutter: stable }`, `body { padding-right: 0 !important }` so reka-ui's scroll lock touches neither. |
| Text box | `ExportDialog`: `Textarea` with `field-sizing-fixed h-64 w-full whitespace-pre overflow-x-auto`, `wrap="off"`. |
| Options | `ExportDialog` takes `options: {key, label}[]` and passes the remembered values (`usePreference('export.<key>')`) to `load(options)`; reloads on change. |
| Backend | `printings` (default true) on collection export, public export, deck export and missing export; `categories` on deck export; `other_decks` on missing export. Text formatting in `collection/textlist.py` (`format_rows(items, printings)`) and `decks/textlist.py` (`format_deck(cards, printings, categories)`); merging by name when printings are off. Missing rows count `missing` plus, with `other_decks`, `in_other_decks` shortfall. |

## Tests

| File | Covers |
|---|---|
| `export-options.spec.ts` | AC-1 to AC-6 (AC-1 with visible scrollbars) |

## Order of work

1. Layout fix.
2. Backend options; `scripts/check-api.sh`.
3. Export dialog options and fixed text box.
4. Tests, full suite, READMEs, spec status.
