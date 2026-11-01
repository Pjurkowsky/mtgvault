# MTG Vault

- `frontend/` — Vue 3 + Vite + shadcn-vue
- `backend/` — Django 6.1 + DRF + PostgreSQL ([details](backend/README.md))

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
- Postgres: `localhost:5432`

**Prod** (gunicorn + nginx serving the built frontend):

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

- Everything on http://localhost (`HTTP_PORT`): nginx serves the Vue app and proxies `/api`, `/admin` and `/static` to Django.
- Migrations run automatically when the backend starts.

Useful commands (swap `dev` for `prod` as needed):

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.dev.yml exec backend python manage.py makemigrations
docker compose -f docker-compose.dev.yml down        # add -v to wipe the database
```

After changing dependencies (`uv add` / `pnpm add`), rebuild with `--build`.
