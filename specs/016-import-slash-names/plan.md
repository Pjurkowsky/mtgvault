# Plan 016: Single-slash card names in imports

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Parser | `collection/textlist.parse`: a name without `//` has `\s+/\s+` replaced by ` // ` before the lookup. Error messages quote the line's own name. |
| Tests | `import-names.spec.ts`: `Fire / Ice` (fixture) in a collection import and a deck import. |
