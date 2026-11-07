# Working on MTG Vault with an AI agent

This project is built spec first, by an AI agent in conversation with its owner.
Any agent working here follows the same workflow:

1. **Take the request** and list every point in `specs/NNN-name/decisions.md`.
2. **Research** the code (and other projects, when asked) before asking anything.
3. **Grill** the user in rounds of questions, each with a recommended answer,
   until nothing is assumed.
4. **Write** `spec.md` (acceptance criteria), `plan.md` (how) and `tasks.md`
   (steps); commit them and wait for approval.
5. **Build** task by task: e2e tests for each AC, tick the task, commit.
6. **Finish** with the full test suite, updated READMEs and `Status: Done`.

The full workflow, with the repo's test, database, UI and git rules, is in
[`.claude/skills/spec-workflow/SKILL.md`](.claude/skills/spec-workflow/SKILL.md),
with templates in its `references/`. The grilling method is in
[`.claude/skills/grilling/SKILL.md`](.claude/skills/grilling/SKILL.md).

Most important rules:

- Code follows `specs/`. Change the spec before changing behaviour it describes.
- Playwright e2e is the only test layer; run the full suite with `--workers=2`.
- Local `manage.py` hits the real dev database: prefix shell checks with
  `DATABASE_URL=postgres://mtgvault:mtgvault@localhost:5432/mtgvault_e2e`.
- Run `scripts/check-api.sh` after any API change.
- Push, tag or publish only when asked.
