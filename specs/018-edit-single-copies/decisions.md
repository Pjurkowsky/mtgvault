# Spec 018: Edit single copies (decisions)

Status: Written into spec.md (2026-11-07).

## Request

- "if i have the same card in the binder and change one to foil both changes
  to be foil"

## Research

- Identical copies are one `CollectionItem` with a quantity (the merge rule,
  spec 001). In a binder each copy has its own `BinderSlot` pointing at that
  row (spec 007), so editing one pocket's card edits the row: every copy
  changes. Delete from a pocket deletes the whole row.
- `edit_item` merges a changed row into a matching one and moves its slots.

## Grilling (2026-11-07)

- Editing from a binder pocket changes only that pocket's copy: it splits off
  as its own row; Quantity is fixed at 1 there.
- The collection's Edit dialog gets "Change N of M copies" (default all);
  fewer splits them off.
- Delete from a pocket removes only that copy.
