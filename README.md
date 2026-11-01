# MTG Vault

- `frontend/` — Vue 3 + Vite + shadcn-vue ([details](frontend/README.md))
- `backend/` — Django 6.1 + DRF + PostgreSQL ([details](backend/README.md))
- `specs/` — feature specs. Each has `spec.md` (what), `plan.md` (how) and
  `tasks.md` (steps). Code follows the spec; change the spec first.

## Running with Docker

```bash
cp .env.example .env   # set SECRET_KEY and POSTGRES_PASSWORD
```

**Dev** (hot reload for both apps):

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:5173 (`/api` is proxied to Django)
- Backend: http://localhost:8000 (admin at `/admin/`, docs at `/api/docs/`)
- Postgres: `localhost:5432`, Redis: `localhost:6379`
- `worker` and `beat` run Celery: the card catalog and exchange rates sync
  daily at 13:00 UTC

**Prod** (gunicorn + nginx serving the built frontend):

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

- Everything on http://localhost (`HTTP_PORT`): nginx serves the Vue app and proxies `/api`, `/admin` and `/static` to Django.
- Migrations run automatically when the backend starts.
- Load the card catalog once after the first start (later the daily job
  keeps it fresh):
  `docker compose -f docker-compose.prod.yml exec backend python manage.py sync_cards`

Useful commands (swap `dev` for `prod` as needed):

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.dev.yml exec backend python manage.py makemigrations
docker compose -f docker-compose.dev.yml down        # add -v to wipe the database
```

After changing dependencies (`uv add` / `pnpm add`), rebuild with `--build`.

## Tests

End-to-end tests (Playwright) prove each spec's acceptance criteria. They use
their own database and ports, so they never touch your dev data.

```bash
docker compose -f docker-compose.dev.yml up -d db redis   # Postgres and Redis must be running
cd frontend
pnpm exec playwright install chromium               # first time only
pnpm e2e                                            # or pnpm e2e:ui
```

The tests load a fixed card sample (`backend/cards/fixtures/`) with fixed
exchange rates, so they need no network. Timing tests (`performance.spec.ts`)
run alone after the others.

After any API change, run `scripts/check-api.sh` to regenerate the API schema
and frontend types.
