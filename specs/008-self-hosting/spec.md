# Spec 008: Self-hosting

Status: Draft
Depends on: 000-accounts, 003-scanner

## Goal

Anyone can run MTG Vault on their own server from one image published on
GitHub. The recommended setup is a short `compose.yml` and `.env` with the
official Postgres and Valkey images. The same image also runs alone, with
Postgres and Redis inside, from a single `docker run`. The only required
setting is the site's address. HTTPS comes from the owner's own reverse proxy.

## Terms

- **Image**: `ghcr.io/pjurkowsky/mtgvault`. It holds the frontend, backend,
  Celery worker and beat, nginx, and a bundled Postgres and Redis.
- **Compose setup**: `compose.yml` with three services: `mtgvault`,
  `postgres` (`postgres:18`) and `valkey` (`valkey/valkey:9`).
- **All-in-one**: the image started alone. Its bundled Postgres and Redis run
  inside it.
- **Data folder**: `${DATA_LOCATION:-./data}` next to `compose.yml`. Its
  subfolders are `app/`, `postgres/` and `valkey/`.
- **App data**: what the image keeps in `/data`: scanner bundles, secrets,
  backups and the beat schedule. In the all-in-one it also holds the
  bundled database and Redis.
- **Site URL**: the public address set in `MTGVAULT_URL`, for example
  `https://cards.example.com`.

## Usage

Compose (recommended):

```bash
curl -O https://raw.githubusercontent.com/pjurkowsky/mtgvault/master/compose.yml
curl -o .env https://raw.githubusercontent.com/pjurkowsky/mtgvault/master/.env.selfhost.example
# set MTGVAULT_URL and DB_PASSWORD in .env
docker compose up -d
```

All-in-one:

```bash
docker run -d --name mtgvault -p 8080:80 -v mtgvault:/data \
  -e MTGVAULT_URL=https://cards.example.com \
  ghcr.io/pjurkowsky/mtgvault:release
```

Point the reverse proxy at `http://<server-ip>:8080`, then sign up. The first
account becomes the admin.

## Acceptance criteria

### Image

- **AC-1** One image runs the whole app: nginx serving the frontend and
  proxying the API, gunicorn, the Celery worker, Celery beat, Postgres and
  Redis. A process supervisor restarts any process that dies.
- **AC-2** When `DATABASE_URL` is set, the bundled Postgres doesn't start.
  When `REDIS_URL` is set, the bundled Redis doesn't start. The app uses the
  given ones.
- **AC-3** The image is built for linux/amd64 and linux/arm64.
- **AC-4** The container listens on port 80. The bundled Postgres and Redis
  listen only inside the container.
- **AC-5** All app data lives in `/data`. Removing the container and starting
  a new one on the same data keeps everything.

### Compose

- **AC-6** `compose.yml` runs `mtgvault` with
  `${MTGVAULT_VERSION:-release}`, `postgres:18` and `valkey/valkey:9`.
  - Each service has `restart: unless-stopped`.
  - Postgres has a `pg_isready` health check and Valkey a `ping` check.
  - `mtgvault` waits for both with `condition: service_healthy`.
- **AC-7** Data is stored in bind mounts under `${DATA_LOCATION:-./data}`:
  `app/`, `postgres/` and `valkey/`. Backing up means copying one folder.
- **AC-8** The site is published on `${MTGVAULT_PORT:-8080}`, on all
  interfaces. Postgres and Valkey are never published.
- **AC-9** `DB_PASSWORD` is required. `docker compose up` stops with a clear
  message when it's empty. `.env.selfhost.example` lists every setting, with a
  command for generating the password.
- **AC-10** `compose.yml` replaces `docker-compose.prod.yml`.
  `docker-compose.dev.yml` stays as it is.

### Configuration

- **AC-11** `MTGVAULT_URL` is required and has no default. The container
  refuses to start, with a clear log message, when it's missing or doesn't
  start with `https://` or `http://`.
- **AC-12** The site URL sets `ALLOWED_HOSTS` to its host and
  `CSRF_TRUSTED_ORIGINS` to its origin. The login cookie is Secure when the
  URL is https.
- **AC-13** With an `http://` URL the container starts and logs a warning that
  phones can scan only over https.
- **AC-14** Behind a reverse proxy that passes the original `Host` and
  `X-Forwarded-Proto`, these all work:
  - sign-up and login
  - the admin
  - fast scanning

  The container's nginx keeps those headers instead of overwriting them.
- **AC-15** Optional settings:

  | Variable | Default |
  |---|---|
  | `SECRET_KEY` | generated on first start, saved in `/data/secrets` |
  | `DATABASE_URL` | bundled Postgres (set by `compose.yml`) |
  | `REDIS_URL` | bundled Redis (set by `compose.yml`) |
  | `TZ` | `UTC` |
  | `GUNICORN_WORKERS` | `2` |
  | `BACKUP_KEEP` | `14` |

### First start

- **AC-16** On first start, the all-in-one does three things:
  - creates the `mtgvault` database and user
  - generates a random password for that user
  - saves the password in `/data/secrets/postgres_password`

  Later starts reuse the password.
- **AC-17** Every start waits for the database, then runs migrations before
  the web server accepts requests.
- **AC-18** When the card catalog is empty, the card sync and the scanner
  bundle download start right away. They don't wait for the daily schedule.
- **AC-19** Registration stays open to anyone (spec 000). The first account
  created on a site with no users becomes the admin (staff and superuser).
  Every later account is a normal user. When two accounts are created at the
  same time, only one becomes the admin.
- **AC-20** Admins see an Admin item in the account menu, which opens
  `/admin/`. Other users never see it.

### Operation

- **AC-21** The image has a Docker `HEALTHCHECK` on `/api/health/`. That view
  answers only when the database is reachable.
- **AC-22** Every night Celery beat writes a `pg_dump` of the database to
  `/data/backups`, named by date. It keeps the newest `BACKUP_KEEP` dumps.
  This works with both the bundled and the compose database.
- **AC-23** `docker compose exec mtgvault backup` (or `docker exec mtgvault
  backup`) writes a dump right away.
- **AC-24** Logs from every process go to the container's stdout.

### Publishing

- **AC-25** A GitHub Actions workflow builds the image on every push to
  `master` and on `v*` tags. It pushes the image to GHCR using the
  repository's own token.

  | Tag | Points to |
  |---|---|
  | `release`, `latest` | the newest version tag |
  | `X.Y.Z`, `X.Y` | that version |
  | `edge` | `master` |
  | `sha-<short>` | every build |

- **AC-26** Before pushing, the workflow starts the image with a test site URL
  and waits for the health check to pass.
- **AC-27** The README's self-hosting section covers:
  - compose first, then `docker run`
  - the reverse proxy requirements (AC-14), with Caddy and nginx examples
  - that Docker-published ports bypass ufw
  - signing up right after the first start
  - backups and restoring a dump
  - upgrades: pull, then up; pinning `MTGVAULT_VERSION`
  - moving from `docker-compose.prod.yml` by dump and restore

## Out of scope

- Built-in HTTPS or certificates, including a bundled Caddy
- Closing or limiting registration
- Email (password reset, notifications)
- Automatic Postgres major version upgrades
- A backup taken automatically before migrations

## Assumptions (filled in during writing, not grilled)

- The bundled Postgres is major version 18, like the compose one. A future
  major version needs a dump and restore, which the README describes (AC-27).
- s6-overlay supervises the processes (AC-1).
- `DB_PASSWORD` uses letters and digits only, because it goes into
  `DATABASE_URL`. The README says so (AC-9).
- The bundled Redis keeps its data in `/data/redis`, and the compose Valkey in
  `valkey/`. Then the refresh-token grace window and the EDHREC cache survive
  a restart. Losing them would only cost cache misses (AC-5, AC-7).
- The nightly backup runs at 03:00 UTC, like the other schedules (AC-22).
  `TZ` only sets the time in the logs.
- `.env.selfhost.example` is separate from the dev `.env.example` (AC-9).
- Phones need the site URL, not the LAN address, because browsers allow the
  camera only on https (AC-13, spec 003).
