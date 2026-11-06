# Tasks 008: Self-hosting

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Tick a task only when its done check passes. Run `scripts/check-api.sh`
after API changes.

## Phase 1: Backend and app

- [ ] **T1 Settings from `MTGVAULT_URL`, secret key file, forwarded proto; health checks the DB** (AC-12, AC-14, AC-15, AC-21)
- [ ] **T2 `run_backup()`, nightly beat task, `backup` command, keep `BACKUP_KEEP`** (AC-22, AC-23)
- [ ] **T3 `first_run` command: sync when the catalog is empty** (AC-18)
- [ ] **T4 First account becomes admin; `is_staff` on Me; Admin item in the account menu; e2e `admin-link`** (AC-19, AC-20)

## Phase 2: The image

- [ ] **T5 Root `Dockerfile`: frontend build, Python, nginx, Postgres 18, Redis, s6-overlay** (AC-1, AC-3, AC-4)
- [ ] **T6 s6 services and `mtgvault-init`: URL check, secrets, bundled DB setup, turning bundled off, migrations before web, logs to stdout** (AC-2, AC-5, AC-11, AC-13, AC-16, AC-17, AC-24)
- [ ] **T7 `docker/nginx.conf`, `HEALTHCHECK`, `manage` and `backup` wrappers** (AC-14, AC-21, AC-23)
- [ ] **T8 `scripts/selfhost-check.sh aio` passes** (all-in-one rows of the plan's Tests)

## Phase 3: Compose

- [ ] **T9 `compose.yml`, `.env.selfhost.example`; remove `docker-compose.prod.yml`** (AC-6 to AC-10)
- [ ] **T10 `scripts/selfhost-check.sh compose` passes** (compose rows of the plan's Tests)

## Phase 4: Publishing and wrap up

- [ ] **T11 GitHub Actions workflow: multi-arch build, smoke test, tags, push to GHCR** (AC-3, AC-25, AC-26)
- [ ] **T12 README self-hosting section; backend and frontend READMEs; e2e suite (2 workers); spec status** (AC-27)
