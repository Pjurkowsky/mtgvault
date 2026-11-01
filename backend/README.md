# MTG Vault — backend

Django 6.1 + Django REST Framework + PostgreSQL 18, managed with [uv](https://docs.astral.sh/uv/).

## Setup

```bash
cp .env.example .env          # then set a real SECRET_KEY
docker compose up -d db       # start Postgres
uv sync                       # install dependencies
uv run manage.py migrate
uv run manage.py createsuperuser
uv run manage.py runserver    # http://localhost:8000
```

## Endpoints

| Path | Description |
| --- | --- |
| `GET /api/health/` | Health check (public) |
| `POST /api/auth/token/` | Get JWT `access` + `refresh` (username/password) |
| `POST /api/auth/token/refresh/` | Get a new access token |
| `POST /api/auth/token/verify/` | Check a token |
| `/api/docs/` | Swagger UI |
| `/api/schema/` | OpenAPI schema |
| `/admin/` | Django admin |

All other API endpoints require `Authorization: Bearer <access token>` by default.
