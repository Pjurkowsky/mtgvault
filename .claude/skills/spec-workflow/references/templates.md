# Templates

Copy these into `specs/NNN-name/`. Keep the headings; drop what a spec doesn't need.

## decisions.md

```markdown
# Spec NNN: Name (decisions so far)

Status: Grilling (YYYY-MM-DD). Written into spec.md when done.

## Requests

- Each point the user asked for, in their words

## Research

- What other projects do, or what the code does now (only if researched)

## Round 1

- Topic: the answer, and the reason if one was given

## Round 2

- …
```

## spec.md

```markdown
# Spec NNN: Name

Status: Draft
Depends on: 000-accounts, …

## Goal

Two to four sentences: who gets what, and why it matters.

## Terms

- **Term**: what it means here.

## Principle

One rule that decides unclear cases (optional).

## Acceptance criteria

### Group

- **AC-1** One observable behaviour. A user (or a test) can check it.
- **AC-2** …

## Out of scope

- What was decided not to do

## Assumptions (filled in during writing, not grilled)

- A choice the user didn't make, with the AC it serves (AC-3).
```

## plan.md

````markdown
# Plan NNN: Name

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Backend | Models, endpoints, or "No changes." |
| Topic | The concrete technical choice, naming files and functions |

## Files

```
path/to/file.vue        what changes, in a few words
path/to/new_file.py     new, what it holds
```

## Tests

| File | Covers |
|---|---|
| `feature.spec.ts` | AC-1 to AC-4 |
| `older.spec.ts` (updated) | moved buttons |

## Order of work

1. Data and API.
2. The main UI.
3. Tests, full suite, READMEs, spec status.
````

## tasks.md

```markdown
# Tasks NNN: Name

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Tick a task only when its done check passes. Run `scripts/check-api.sh`
after API changes.

## Phase 1: Data and API

- [ ] **T1 Short title naming what exists when done** (AC-1, AC-2)

## Phase 2: UI

- [ ] **T2 …** (AC-3)

## Phase 3: Tests and wrap up

- [ ] **T3 e2e: feature; update older tests**
- [ ] **T4 Full suite (2 workers), READMEs, spec status**
```
