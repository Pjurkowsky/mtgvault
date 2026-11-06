# Plan 008: Self-hosting

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Dockerfile | `Dockerfile` at the repo root, multi-stage. The `frontend` stage runs `pnpm build`. The final stage is `python:3.14-slim` with the uv venv, nginx, `postgresql-18` and `postgresql-client-18` from the PGDG apt repo, `redis-server` and s6-overlay v3. `backend/Dockerfile` and the frontend `prod` target stay for the dev compose. |
| Supervisor | s6-overlay v3 services in `docker/s6-rc.d/`:<br>• `init` (oneshot): check the URL, secrets, database setup<br>• `postgres` and `redis` (longrun)<br>• `migrate` (oneshot, after `init` and `postgres`): wait for the DB, migrate, first run<br>• `gunicorn`, `worker` and `beat` (longrun, after `migrate`)<br>• `nginx` (longrun, after `gunicorn`)<br>`S6_BEHAVIOUR_IF_STAGE2_FAILS=2`, so a failed `init` or `migrate` stops the container. |
| Turning bundled off | The `postgres` and `redis` run scripts check `DATABASE_URL` and `REDIS_URL` first. When one is set, the script marks itself down (`s6-svc -Od .`) and sleeps. |
| Entry checks | `docker/bin/mtgvault-init`:<br>• validates `MTGVAULT_URL` (`https://` or `http://`) and warns on http<br>• writes `/data/secrets/secret_key` if `SECRET_KEY` is unset<br>• with the bundled DB, runs `initdb` into `/data/postgres` on first start, with a generated password in `/data/secrets/postgres_password`, and creates the `mtgvault` user and database<br>• exports `DATABASE_URL` and `REDIS_URL` for the other services through `/run/s6/container_environment` |
| Settings | `config/settings.py`: when `MTGVAULT_URL` is set, it derives:<br>• `ALLOWED_HOSTS` from the host, plus `localhost` for the health check<br>• `CSRF_TRUSTED_ORIGINS` from the origin<br>• `AUTH_COOKIE_SECURE` from the scheme<br>• `SECURE_PROXY_SSL_HEADER`<br>`USE_X_FORWARDED_HOST` stays off; nginx keeps `Host`. The dev env vars still work when `MTGVAULT_URL` is unset. `SECRET_KEY` falls back to the secret file. |
| nginx | `docker/nginx.conf`: the current `frontend/nginx.conf`, proxying to `127.0.0.1:8000`. A `map` sets `X-Forwarded-Proto` to `$http_x_forwarded_proto`, or `$scheme` when the header is absent. |
| First run | Management command `first_run`: when `Card` is empty, it queues `sync_cards` and `sync_scanner_bundle`. It runs in `migrate`. |
| Paths | `SCANNER_DIR=/data/scanner`. Beat uses `--schedule /data/celerybeat-schedule`. `BACKUP_DIR=/data/backups`. |
| First admin | `RegisterView` creates the user inside `transaction.atomic()` and takes `pg_advisory_xact_lock` first. If no other user exists, the new one gets `is_staff` and `is_superuser`. |
| Admin item | `MeSerializer` adds `is_staff` (read-only). `AppLayout` shows Admin, with an icon, in the account menu for staff. It is a plain link to `/admin/`. |
| Backups | `core/backup.py`: `run_backup()` runs `pg_dump -Fc` with the connection from `DATABASES` into `BACKUP_DIR/mtgvault-YYYY-MM-DD-HHMM.dump`, then deletes all but the newest `BACKUP_KEEP`. It is used by the `core.tasks.backup_database` beat task (03:00 UTC) and the `backup` management command. `docker/bin/backup` wraps the command. |
| Health | `health` runs `SELECT 1` and returns 503 when it fails. The `HEALTHCHECK` curls `http://127.0.0.1/api/health/` every 30 s, with a 120 s start period. |
| Compose | `compose.yml`:<br>• `mtgvault` sets `DATABASE_URL=postgres://mtgvault:${DB_PASSWORD:?…}@postgres:5432/mtgvault` and `REDIS_URL=redis://valkey:6379/0`<br>• `postgres:18` uses `POSTGRES_PASSWORD: ${DB_PASSWORD:?…}`<br>• `valkey/valkey:9` runs `--save 60 1`<br>• bind mounts under `${DATA_LOCATION:-./data}`; health checks; `service_healthy` |
| Env example | `.env.selfhost.example` lists `MTGVAULT_URL`, `DB_PASSWORD` (with `openssl rand -hex 24`), `MTGVAULT_VERSION`, `MTGVAULT_PORT`, `DATA_LOCATION`, `TZ`, `GUNICORN_WORKERS` and `BACKUP_KEEP`. |
| `manage` | `docker/bin/manage` runs `python /app/manage.py "$@"`, with `DATABASE_URL` and `REDIS_URL` read from the container environment. |
| Workflow | `.github/workflows/image.yml`:<br>• QEMU and buildx<br>• `docker/metadata-action` tags: semver `{{version}}` and `{{major}}.{{minor}}`; `release` and `latest` on tags (not prereleases); `edge` on master; `sha`<br>• build amd64 with `--load`<br>• smoke test<br>• build and push both platforms, using the GHA cache |
| Smoke test | `scripts/selfhost-check.sh` runs the self-hosted setups end to end, both in CI and locally. |

## Files

```
Dockerfile                            new, the self-hosted image
.dockerignore                         new, for the root build context
docker/s6-rc.d/                       new, services and dependencies
docker/bin/mtgvault-init              new, URL check, secrets, bundled DB setup
docker/bin/manage, docker/bin/backup  new, wrappers on PATH
docker/nginx.conf                     new, proxy to 127.0.0.1:8000, keeps forwarded headers
compose.yml                           new
.env.selfhost.example                 new
docker-compose.prod.yml               removed
backend/config/settings.py            MTGVAULT_URL, secret file, BACKUP_*, beat backup entry
backend/core/views.py                 health checks the DB
backend/core/backup.py, tasks.py      new, dump and keep
backend/core/management/commands/     new, backup, first_run
backend/users/views.py                first account becomes admin
backend/users/serializers.py          is_staff on Me
frontend/src/layouts/AppLayout.vue    Admin item for staff
scripts/selfhost-check.sh             new, smoke test
.github/workflows/image.yml           new
README.md                             self-hosting section
```

## Tests

| Check | Covers |
|---|---|
| `scripts/selfhost-check.sh aio`: `docker run` with a temp volume and `MTGVAULT_URL=http://localhost:8080` | AC-1, AC-4, AC-5, AC-11, AC-13, AC-16 to AC-19, AC-21, AC-23<br>• healthy<br>• sign-up through the API, and the first user is staff<br>• a second sign-up is not staff<br>• `backup` writes a dump<br>• restart on the same volume keeps the user<br>• a missing or bad URL exits non-zero |
| `scripts/selfhost-check.sh compose`: the compose setup with a temp `DATA_LOCATION` | AC-2, AC-6 to AC-9<br>• healthy<br>• no Postgres or Redis process in `mtgvault`<br>• folders under `DATA_LOCATION`<br>• an empty `DB_PASSWORD` fails |
| Forwarded headers: curl through the check with `Host` and `X-Forwarded-Proto: https` | AC-12, AC-14<br>• CSRF accepts the origin<br>• the cookie is Secure |
| `e2e/admin-link.spec.ts` (makes the user staff with `manage.py shell` on the e2e DB) | AC-20 |
| Shell check on the e2e DB: `run_backup()` keeps `BACKUP_KEEP` | AC-22 |
| Workflow run on a branch, inspecting the tags | AC-3, AC-25, AC-26 |

## Order of work

1. Settings, health, backup, first run, first admin, Admin item.
2. Dockerfile, s6 services, init and nginx; the all-in-one check passes.
3. `compose.yml` and the env example; the compose check passes.
4. Workflow, README, removing the prod compose, spec status.
