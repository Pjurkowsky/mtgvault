# MTG Vault

- `frontend/` — Vue 3 + Vite + shadcn-vue ([details](frontend/README.md))
- `backend/` — Django 6.1 + DRF + PostgreSQL ([details](backend/README.md))
- `specs/` — feature specs. Each has `spec.md` (what), `plan.md` (how) and
  `tasks.md` (steps). Code follows the spec; change the spec first.

## Self-hosting

One image, `ghcr.io/pjurkowsky/mtgvault`, runs the whole app: the frontend,
the API, background jobs, and a bundled Postgres and Redis that stay off when
you bring your own. HTTPS comes from your reverse proxy.

### Compose (recommended)

```bash
mkdir mtgvault && cd mtgvault
curl -O https://raw.githubusercontent.com/pjurkowsky/mtgvault/master/compose.yml
curl -o .env https://raw.githubusercontent.com/pjurkowsky/mtgvault/master/.env.selfhost.example
# In .env: set MTGVAULT_URL, and DB_PASSWORD (openssl rand -hex 24)
docker compose up -d
```

This runs `mtgvault`, `postgres:18` and `valkey/valkey:9`. All data lands in
`./data` (`DATA_LOCATION`): `app/` holds scanner files, generated secrets and
backups, `postgres/` and `valkey/` the databases. The site is on port 8080
(`MTGVAULT_PORT`) for your reverse proxy.

Docker-published ports bypass `ufw`. To reach the site only through a proxy on
the same server, publish `127.0.0.1:8080:80` instead.

### All-in-one

```bash
docker run -d --name mtgvault --restart unless-stopped -p 8080:80 -v mtgvault:/data \
  -e MTGVAULT_URL=https://cards.example.com ghcr.io/pjurkowsky/mtgvault:release
```

Everything, including the database, lives in the `/data` volume. Set
`DATABASE_URL` or `REDIS_URL` to use your own Postgres or Redis instead.

### First start

- Migrations run, and the card catalog and the scanner models download in the
  background (a few minutes).
- **Sign up right away: the first account becomes the admin.** Everyone can
  register; admins get an Admin item in the account menu (`/admin/`).
- Another admin: `docker compose exec mtgvault manage createsuperuser`.

### Settings

| Variable | Default | |
|---|---|---|
| `MTGVAULT_URL` | required | The address people open. `http://` works, but phones can scan only over https. |
| `DB_PASSWORD` | required (compose) | Letters and digits only. |
| `MTGVAULT_VERSION` | `release` | `release` (newest version), `1.2`, `1.2.3`, or `edge` (master). |
| `MTGVAULT_PORT` | `8080` | Host port (compose). |
| `DATA_LOCATION` | `./data` | Data folder (compose). |
| `SECRET_KEY` | generated | Saved in `/data/secrets`. |
| `DATABASE_URL`, `REDIS_URL` | bundled | Your own Postgres or Redis (all-in-one). |
| `TZ` | `UTC` | |
| `GUNICORN_WORKERS` | `2` | |
| `BACKUP_KEEP` | `14` | Nightly dumps kept. |

### Reverse proxy

The proxy must pass the original `Host` and `X-Forwarded-Proto`. Caddy does
both by default:

```
cards.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

nginx:

```nginx
server {
    listen 443 ssl;
    server_name cards.example.com;
    # ssl_certificate ...;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Backups

A database dump is written every night at 03:00 UTC to `data/app/backups`
(`/data/backups` in the container); the newest 14 are kept. One right now:

```bash
docker compose exec mtgvault backup
```

Restore a dump into an empty database (compose):

```bash
docker compose stop mtgvault
docker compose exec -T postgres pg_restore -U mtgvault -d mtgvault --clean --if-exists \
  < data/app/backups/mtgvault-2026-11-06-030000.dump
docker compose start mtgvault
```

All-in-one: `docker exec -i mtgvault with-contenv sh -c 'pg_restore --clean --if-exists -d "$DATABASE_URL"' < dump`.

### Upgrades

```bash
docker compose pull && docker compose up -d
```

Migrations run on start. Pin `MTGVAULT_VERSION` (for example `1.2`) to choose
when to move. A new Postgres major version needs a dump and restore: take a
backup, stop everything, move `data/postgres` aside, change the image, start,
and restore.

### Moving from `docker-compose.prod.yml`

```bash
docker compose -f docker-compose.prod.yml exec -T db pg_dump -Fc -U mtgvault mtgvault > mtgvault.dump
docker compose -f docker-compose.prod.yml down
# set up compose.yml and .env as above, then:
docker compose up -d postgres
docker compose exec -T postgres pg_restore -U mtgvault -d mtgvault --clean --if-exists < mtgvault.dump
docker compose up -d
```

Sign in with your old account; the first-account rule only applies to a site
with no users.

## Development with Docker

```bash
cp .env.example .env   # set SECRET_KEY and POSTGRES_PASSWORD
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:5173 (`/api` is proxied to Django)
- Backend: http://localhost:8000 (admin at `/admin/`, docs at `/api/docs/`)
- Postgres: `localhost:5432`, Redis: `localhost:6379`
- `worker` and `beat` run Celery: the card catalog and exchange rates sync
  daily at 13:00 UTC

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.dev.yml exec backend python manage.py makemigrations
docker compose -f docker-compose.dev.yml down        # add -v to wipe the database
```

After changing dependencies (`uv add` / `pnpm add`), rebuild with `--build`.

Build and check the self-hosted image locally:

```bash
docker build -t mtgvault:local .
scripts/selfhost-check.sh aio      # also: compose, http
```

## Tests

End-to-end tests (Playwright) prove each spec's acceptance criteria. They use
their own database and ports, so they never touch your dev data.

```bash
docker compose -f docker-compose.dev.yml up -d db redis   # Postgres and Redis must be running
cd frontend
pnpm exec playwright install chromium               # first time only
pnpm e2e                                            # or pnpm e2e:ui
```

The scanner tests (`scanner` project) use the real recognition models
(downloaded once into `backend/var/scanner-e2e`, about 50 MB) and Chromium's
fake camera showing a Sol Ring (`e2e/camera.setup.ts`, built once into
`e2e/.cache/`). Both need network the first time.

The tests load a fixed card sample (`backend/cards/fixtures/`) with fixed
exchange rates, so they need no network. Timing tests (`performance.spec.ts`)
run alone after the others.

After any API change, run `scripts/check-api.sh` to regenerate the API schema
and frontend types.

## Credits

The card scanner reuses [ManaVault](https://github.com/cfbender/manavault)'s
browser recognition pipeline and its published models, trained in
[Oracle](https://github.com/cfbender/oracle). Both are licensed under the
[Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/). The ported files in
`frontend/src/scanner/recognition/` and `frontend/src/scanner/decision.ts`
keep that license and name their source files; the rest of MTG Vault is not
affected. Card data and images come from [Scryfall](https://scryfall.com),
EDHREC data from [EDHREC](https://edhrec.com). Mana symbols in
`frontend/src/assets/mana/` are Scryfall's card symbol images.
