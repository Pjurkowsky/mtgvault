# MTG Vault — backend

Django 6.1 + Django REST Framework + PostgreSQL 18, managed with [uv](https://docs.astral.sh/uv/).

## Setup

The easiest way is Docker from the project root — see the [main README](../README.md).

To run Django directly on your machine (Postgres from the dev compose file):

```bash
cp .env.example .env          # then set a real SECRET_KEY
docker compose -f ../docker-compose.dev.yml up -d db
uv sync
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
