# MTG Vault

> **Vibe-coded.** This whole project, code, tests, specs and docs, was written
> by an AI (Claude) from conversation, with no hand-written code. Use it
> accordingly.

- `frontend/` — Vue 3 + Vite + shadcn-vue ([details](frontend/README.md))
- `backend/` — Django 6.1 + DRF + PostgreSQL ([details](backend/README.md))
- `specs/` — feature specs. Each has `spec.md` (what), `plan.md` (how) and
  `tasks.md` (steps). Code follows the spec; change the spec first.
- `AGENTS.md` — how an AI agent works here: research, grill, spec, plan, tasks,
  build ([the full workflow](.claude/skills/spec-workflow/SKILL.md)).

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

### Your own scanner model

The scanner uses ManaVault's published models by default. To use bundles you train
with [Oracle](https://github.com/cfbender/oracle) (for example its binder-glare
model, see Oracle's `docs/binder-glare.md`), copy Oracle's output folder onto the
server, for example to `./data/app/bundles` (seen inside the container as
`/data/bundles`). Then, as an admin, open **Settings → Scanner model**, choose
**Server folder**, enter `/data/bundles` and **Save**. The newest bundle in the
folder installs at once and the daily sync keeps following the folder; choose
**GitHub releases** to go back.

### Pod simulation (optional)

**Simulations** in the top bar plays Commander decks against each other with
[Forge](https://github.com/Card-Forge/forge). It needs the separate
`ghcr.io/pjurkowsky/mtgvault-forge` image. With compose, set
`FORGE_URL=http://forge:8790` in `.env`, then:

```bash
docker compose --profile forge up -d
```

All-in-one: run the Forge image next to it on a shared Docker network and set
`FORGE_URL` to its address. Each game uses about 1 GB of memory and takes from
under a minute to a few minutes; a stronger **Look-ahead** (Forge 2.0.16's AI that
tries its best plays a few moves ahead) plays better and slower. `FORGE_CPUS=3`
caps Forge at three cores, so the rest of the server stays responsive. Without
a Forge, or while none answers, Simulations is hidden.

#### Forge on another PC

A faster PC on the same network can play the games. In Settings it is **Other**;
the server's own Forge (`FORGE_URL`) is **Main**.

1. On the PC, install Docker (Docker Desktop on Windows or macOS), then start
   Forge with a password of your choice:

   ```bash
   docker run -d --name mtgvault-forge --restart unless-stopped \
     -p 8790:8790 -e FORGE_KEY=choose-a-password -e FORGE_MEMORY=2g \
     ghcr.io/pjurkowsky/mtgvault-forge:latest
   ```

   Update it later with `docker pull ghcr.io/pjurkowsky/mtgvault-forge:latest`,
   then remove and start the container again.
2. Find the PC's address on your network (`ipconfig` on Windows, `ip addr` on
   Linux), e.g. `192.168.1.20`, and allow incoming TCP port 8790 in its firewall.
3. In MTG Vault, as an admin, open **Settings → Forge**. Under **Other** enter
   `http://192.168.1.20:8790`, the same key, and **Games at once** (each game
   needs a CPU core and `FORGE_MEMORY` of memory). Press **Test**: it shows
   the Forge version. Then **Save**.

The run form's **Forge** picks where a run plays. **Auto** plays each game on
Other while it answers, otherwise on Main, and a game whose Forge stops
answering plays again on the other one. **Main** or **Other** plays only there;
if that Forge doesn't answer the run fails, and **Restart** plays what is left,
on the Forge you pick again. Keep both on the same image version. Each run's
page shows where each game played and how long it took, including games still
playing, and the run's total time.

Each game has a replay: every player's battlefield, hand, library, graveyard and
exile, arrows for attacks and blocks, and the turn's events in a sidebar. Step
by event (← →) or turn (Shift + ← →), or press Play with a speed, pause at
combat and follow one player. Games played with a Forge image older than spec
026 show hand and library counts only.

A seat can play any branch or saved version of a deck (the versions panel on a
deck's page), and **Compare versions** plays 2 to 4 of them against the same
pod, in one run or as separate runs, to see which list wins more.

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
- Pod simulation: `docker compose -f docker-compose.dev.yml --profile forge up -d`
  adds `forge` (built from `docker/forge`, port 8790) and `sims` (`run_sims`)

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
fake camera showing a Sol Ring: plain, with glare over its art, and out of
focus (`e2e/camera.setup.ts`, built once into `e2e/.cache/`). Both need
network the first time.

The simulation tests use `manage.py fake_forge`, which replays recorded Forge
games from `backend/sims/fixtures/forge/`, so they need neither Forge nor Java.
`sim-admin.spec.ts` runs after the other tests (its own project), since an
admin's Cancel all stops every run.

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
affected. Card data, images and card tags come from [Scryfall](https://scryfall.com),
EDHREC data (salt scores, commander themes) from [EDHREC](https://edhrec.com),
combos from [Commander Spellbook](https://commanderspellbook.com), sealed products
(precons and booster contents) from [MTGJSON](https://mtgjson.com), their photos from
[TCGplayer](https://www.tcgplayer.com). Pod simulation
runs [Forge](https://github.com/Card-Forge/forge) (GPL-3.0) unchanged in its own
image, `docker/forge`, with a small runner compiled against it. Mana symbols in
`frontend/src/assets/mana/` are Scryfall's card symbol images.

## License

MTG Vault is licensed under the [GNU Affero General Public License v3.0](LICENSE)
(AGPL-3.0-or-later). You may use, change and share it; if you run a changed
version for others over a network, you must offer them its source.

The scanner files ported from ManaVault keep their own license, the
[Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/) (see Credits).
