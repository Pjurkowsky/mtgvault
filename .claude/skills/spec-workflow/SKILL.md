---
name: spec-workflow
description: How MTG Vault is built - every feature goes request, research, grilling, spec, plan, tasks, then implementation task by task with e2e tests and commits. Use for any new feature, change request, improvement list or "make a spec", and before changing behaviour that a spec in specs/ describes.
---

# Spec workflow

MTG Vault is built spec first. Code follows the spec; when the code must change,
the spec changes first. Every feature lives in `specs/NNN-name/`:

| File | What |
|---|---|
| `decisions.md` | Optional. The raw request and each grilling round's answers, while grilling |
| `spec.md` | What: goal, terms, acceptance criteria, out of scope, assumptions |
| `plan.md` | How: decisions table, files touched, tests, order of work |
| `tasks.md` | Steps: tasks grouped in phases, each naming its ACs, ticked when done |

Templates are in [references/templates.md](references/templates.md). Read the
newest finished spec in `specs/` before writing one: match its tone and size.

## 1. Take the request

- List every point the user asked for, in their words, in `decisions.md` under
  **Requests**. Nothing they asked for may silently drop out later.
- Pick the next free number: `specs/NNN-short-name/`.
- If the request extends an existing spec, add `Followed by: NNN-name` to the
  older spec's header and `Depends on:` in the new one.

## 2. Research before asking

Finding facts is your job, never the user's.

- Read the code the request touches: components, endpoints, models, tests.
- When the user asks to copy how others do it ("look at how X does Y"), research
  real projects first and summarise what they do, in a table, before asking anything.
- Use subagents for broad searches or web reading so findings arrive as answers.

## 3. Grill

Use the `grilling` skill. In short:

- Work in rounds. Each round asks every question that can be decided now
  (the frontier), numbered, each with a **recommended answer**, worded so "yes"
  accepts it. Prefer the AskUserQuestion tool with the recommendation as the
  first option, marked "(Recommended)".
- Questions are about behaviour and product choices. Facts you can look up are not questions.
- Answers open new questions. Ask them in the next round. Stop when nothing is
  left silently assumed.
- After each round, append the answers to `decisions.md`.
- End with a short table of every decision and ask if that is the shared picture.

## 4. Write spec, plan, tasks

Only after the user confirms. Then:

- **spec.md**: numbered `AC-N` criteria, each testable and observable by a user.
  Group them under short headings. Put what was decided as out of scope in
  **Out of scope**. Anything you filled in yourself goes under **Assumptions
  (filled in during writing, not grilled)**, each naming the AC it serves.
- **plan.md**: a decisions table (topic → choice), the files to add or change
  with one line each, a tests table (test file → ACs it covers), and the order of work.
- **tasks.md**: phases of tasks, each `- [ ] **TN Title** (AC-x, AC-y)`; the
  last phase is always tests, full suite, READMEs and spec status.
- Every AC is covered by at least one task and one test.
- Commit the spec files with `Spec NNN name: spec, plan and tasks`.
- Ask "Approve it and I'll build it?" and wait. Don't build an unapproved spec.

## 5. Build task by task

- One task (or a small group) at a time. After each: type check, run the e2e
  tests it touches, tick it in `tasks.md`, commit with
  `<what changed> (spec NNN TN)` or `(spec NNN TN-TM)`.
- A task is ticked only when its done check passes. If one can't pass yet
  (a CI workflow before the first push), leave it unticked and say why in the line.
- After API changes run `scripts/check-api.sh`; it regenerates
  `backend/openapi.yaml` and `frontend/src/api/schema.d.ts`. Commit both.
- Look at the UI you built: render it (a throwaway Playwright screenshot is fine,
  delete the file after) at desktop and phone width before calling it done.
- When the user changes their mind mid-build, update `spec.md`
  (AC text, assumptions) and `plan.md` in the same commit as the code.
- Finish with: the full e2e suite, READMEs updated (root, `backend/`,
  `frontend/`), `Status: Done` in `spec.md`.

## Tests

Playwright e2e tests are the only test layer. Each spec's ACs are proved in
`frontend/e2e/`, test titles start with the ACs they cover (`'AC-4, AC-5: ...'`).

- Postgres and Redis must run: `docker compose -f docker-compose.dev.yml up -d db redis`.
- Run from `frontend/`: `pnpm exec playwright test <files> --project=chromium`.
- The full suite: `pnpm exec playwright test --workers=2`. More workers have
  frozen a laptop. The scanner projects alone: add `--no-deps`.
- A timeout that passes when rerun alone is load, not a bug. Rerun before changing code.
- Changing behaviour means updating the older tests that assert the old behaviour,
  in the same commit, with a comment naming the new spec's AC.

## Databases

`backend/manage.py` run locally talks to the **developer's real database**
(`.env`). For shell checks, fixture syncs or experiments, always prefix:

```bash
DATABASE_URL=postgres://mtgvault:mtgvault@localhost:5432/mtgvault_e2e uv run manage.py ...
```

Shell checks with DRF's `APIClient` need `APIClient(SERVER_NAME='localhost')`.

## UI rules

- Minimal text: no headings or helper lines that repeat what a label or button
  says. Extra context goes in an `InfoTip` tooltip.
- Errors: `Alert variant="destructive"` (tinted). Toasts: green success, red error.
- Every delete asks for confirmation. Every icon-only button has a tooltip.
- Prices show in the user's currency; the others in a hover tooltip.
- Reuse existing components (`CardBrowser`, `FilterPopover`, `CardSizeToggle`,
  `IconButton`, `CardPreview` …) instead of near copies.
- Controls must not move when switching views or opening panels.

## Git

- Commit messages end with the AI's co-author line.
- Push, tag or publish only when the user asks.
- Never commit a user's own draft files (for example a spec folder they wrote)
  unless they say so.
- Don't add workarounds that hide a failing check; find the cause.

## Writing

Specs, READMEs and messages are plain and short. Use the `stop-slop` skill on
prose. Name things the way the UI names them.
