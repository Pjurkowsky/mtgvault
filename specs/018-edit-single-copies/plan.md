# Plan 018: Edit single copies

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Backend | `collection/services.split_copies(row, n, slot=None)`: a new row with `n` copies (same fields, prices, dates), the original lowered; `slot` (or the newest surplus slots) moves to it. `PATCH /api/items/{id}/` takes `copies` and `slot`; `DELETE /api/items/{id}/?slot=` lowers by one and drops that slot. |
| Frontend | Binder pockets pass their slot id with edit and delete. `EditItemDialog` takes `slot`; without it, rows of 2+ copies show "Change N of M copies". |
| Tests | `edit-copies.spec.ts`: binder edit and delete, collection split and merge. |
