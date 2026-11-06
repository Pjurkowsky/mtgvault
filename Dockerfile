# syntax=docker/dockerfile:1
# Self-hosted MTG Vault (spec 008): frontend, backend, Celery, nginx, and a
# bundled Postgres and Redis that stay off when DATABASE_URL / REDIS_URL are set.
#   docker build -t mtgvault .

FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.14-slim

ARG S6_OVERLAY_VERSION=3.2.1.0
ARG TARGETARCH

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg xz-utils nginx redis-server tzdata \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && . /etc/os-release \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18 postgresql-client-18 \
 && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default \
 && ln -sf /dev/stdout /var/log/nginx/access.log && ln -sf /dev/stderr /var/log/nginx/error.log

RUN case "${TARGETARCH:-amd64}" in amd64) arch=x86_64 ;; arm64) arch=aarch64 ;; *) echo "unsupported ${TARGETARCH}" && exit 1 ;; esac \
 && base=https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION} \
 && curl -fsSL "$base/s6-overlay-noarch.tar.xz" | tar -C / -Jxp \
 && curl -fsSL "$base/s6-overlay-${arch}.tar.xz" | tar -C / -Jxp

COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /uvx /bin/
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:/usr/local/mtgvault/bin:/command:$PATH"

WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/ ./
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput \
 && useradd --system --home /app --shell /usr/sbin/nologin mtgvault

COPY --from=frontend /app/dist /srv/frontend
COPY docker/nginx.conf /etc/nginx/conf.d/mtgvault.conf
COPY docker/s6-rc.d/ /etc/s6-overlay/s6-rc.d/
COPY docker/bin/ /usr/local/mtgvault/bin/
RUN chmod +x /usr/local/mtgvault/bin/* /etc/s6-overlay/s6-rc.d/*/run 2>/dev/null; true

ENV DEBUG=False \
    SECRET_KEY_FILE=/data/secrets/secret_key \
    SCANNER_DIR=/data/scanner \
    BACKUP_DIR=/data/backups \
    GUNICORN_WORKERS=2 \
    TZ=UTC \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
    S6_VERBOSITY=1

VOLUME /data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS http://127.0.0.1/api/health/ || exit 1
ENTRYPOINT ["/init"]
