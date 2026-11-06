# Plan 009: Binder polish

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
| --- | --- |
| Backend | No changes. The new location dialog creates the location, then saves the layout with the binder PATCH (spec 007). |
| One toolbar | `LocationPage` hands its Edit and Delete actions to `CardBrowser` (`menu` items); the browser's ⋯ menu gains them and Binder settings. `BinderView` exposes `openSettings()`. The browser summary line hides when a `location` is given. |
| Fixed toolbar | Search, filters, sort and direction always render; in binder view filters and sort get `disabled`. The size toggle comes after them, so nothing before it moves. |
| Search in the binder | The browser's search text (`q`) goes to `BinderView`. Matches are computed in the browser from the binder's rows; the view keeps a match index, jumps to the match's page, and rings or fades pockets. |
| Card size | `CardSizeToggle` and `usePreference('binder.size')`. A pocket is 5, 7 or 9 rem wide; `BinderView` measures its width (`useElementSize`) and shows facing pages only when two pages fit. |
| Sidebar | `UnplacedTray` sits in a right panel with an edge tab; open state in `usePreference('binder.tray')`. A drag from a pocket opens it and remembers to close it after. On phones the panel is fixed over the pages. |
| Pagination | `BinderPagination.vue` under the pages: arrows, view labels (`1`, `2–3`), ellipses around the current view, used slots. |
| Hover preview | `CardPreview` open delay 800 ms; it ignores opening while `pointerdown` is held or `document.body` has `data-dragging` (set by `useBinderDrag`). |
| New location | `LocationDialog` shows `GridPicker`, facing pages and page count for kind Binder on create, then PATCHes the binder, then routes to the location. |
| Mana filter look | `ColorToggles`: selected gets `ring-2 ring-primary` and full opacity; when any is selected, the others get `opacity-40`. |
| Section filters | `SectionFilter.vue` inline in the settings: `ColorToggles` and `CheckGroup`s (type, rarity, finish, condition). Section headers show `ManaSymbol`s of the section's colors. |

## Frontend

```
components/browser/CardBrowser.vue     one toolbar, ⋯ items from the page, disabled filters in binder view, size toggle, no summary on locations
components/browser/filters/ColorToggles.vue  selected ring, others fade
components/binder/BinderView.vue       search matches, size, sidebar, pagination, openSettings()
components/binder/BinderPagination.vue page numbers and arrows
components/binder/BinderPage.vue       section symbols, match ring and fade, pocket width
components/binder/UnplacedTray.vue     sidebar body, filtered by the search
components/binder/SectionFilter.vue    inline section filter
components/binder/BinderSettingsDialog.vue  SectionFilter, symbols in rows
components/collection/LocationDialog.vue    binder layout on create, open the new location
components/CardPreview.vue             800 ms, never while pressed or dragging
pages/LocationPage.vue                 Edit and Delete into the browser's ⋯ menu
```

## Tests

| File | Covers |
| --- | --- |
| `binder-polish.spec.ts` | AC-1 to AC-8, AC-10, AC-11, AC-13, AC-14 |
| `browser.spec.ts`, `locations.spec.ts`, `binder*.spec.ts` (updated) | moved buttons, totals once, new location opens |
| `polish-browser.spec.ts` (updated) | AC-9, AC-12 |

## Order of work

1. Toolbar, ⋯ menu, totals once.
2. Binder search, size, pagination.
3. Sidebar and drag opening it; preview delay.
4. New location dialog; mana toggles; inline section filter and symbols.
5. Tests, full suite, READMEs, spec status.
