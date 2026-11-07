# Spec 016: Single-slash card names in imports (decisions)

Status: Written into spec.md (2026-11-07).

## Request

- Importing prepared cards fails: `1 Kirol, History Buff / Pack a Punch (SOS) 198`
  gives "No card named …". "could you support this format also?"

## Research

- Scryfall names two-part cards with a double slash: `Kirol, History Buff //
  Pack a Punch` (layout `prepare`), like split, adventure and double-faced
  cards (`Fire // Ice`). Some sites export them with a single slash.
- `collection/textlist.parse` matches the full name or the front face name,
  so `Kirol, History Buff` alone already works; ` / ` does not.
- Collection import and deck import share that parser.
- A few joke cards have slashes without spaces (`Who/What/When/Where/Why`);
  only a slash with spaces around it means two faces.

No grilling needed: the request names the format; nothing else changes.
