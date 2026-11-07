# Plan 012: Ownership labels

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Labels | `OWN_STATES` in `lib/decks.ts` holds the names; the filter, badges, tooltips and card dialog read it. State keys (`in_box`, `owned`) and the `own=` URL values stay. |
| Tests | `deck-filters.spec.ts` ticks Owned and Free in collection; `deck-import.spec.ts` reads the new name. |
