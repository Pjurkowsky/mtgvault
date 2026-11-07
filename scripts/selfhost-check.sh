#!/usr/bin/env bash
# End-to-end check of the self-hosted image (spec 008).
#   scripts/selfhost-check.sh aio      the image alone, with its bundled Postgres and Redis
#   scripts/selfhost-check.sh compose  compose.yml with postgres and valkey
# IMAGE=mtgvault:local by default; build it with: docker build -t mtgvault:local .
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=${IMAGE:-mtgvault:local}
MODE=${1:-aio}
PORT=${PORT:-8093}
NAME=mtgvault-check
SITE=mtgvault.test
WORK=$(mktemp -d)
pass() { echo "ok   $*"; }
fail() { echo "FAIL $*"; exit 1; }

logs_have() {  # grep -q on a pipe would trip pipefail
  local logs; logs=$(docker logs "$1" 2>&1); grep -q "$2" <<<"$logs"
}

wait_healthy() {
  for _ in $(seq 1 90); do
    curl -fs "http://127.0.0.1:$PORT/api/health/" >/dev/null && return 0
    sleep 2
  done
  return 1
}

# POST JSON through the reverse-proxy headers a real proxy would send.
api() {
  curl -s -o "$WORK/body" -D "$WORK/headers" -w '%{http_code}' \
    -H "Host: $SITE" -H 'X-Forwarded-Proto: https' -H 'Content-Type: application/json' \
    "http://127.0.0.1:$PORT$1" -d "$2"
}

register() {
  api /api/auth/register/ "{\"username\":\"$1\",\"email\":\"$1@example.com\",\"password\":\"correct-horse-42\",\"currency\":\"EUR\"}"
}

refuses_url() {  # the container exits non-zero for a bad MTGVAULT_URL (AC-11)
  local code
  code=$(timeout 60 docker run --rm ${1:+-e MTGVAULT_URL="$1"} "$IMAGE" >/dev/null 2>&1; echo $?)
  [ "$code" != 0 ] && [ "$code" != 124 ] || fail "starts with MTGVAULT_URL='$1' (exit $code)"
  pass "refuses MTGVAULT_URL='${1:-<unset>}'"
}

accounts_and_proxy() {
  [ "$(register first)" = 201 ] || fail "first sign-up: $(cat "$WORK/body")"
  grep -q '"is_staff":true' "$WORK/body" || fail "first account is not admin"
  pass "first account is admin (AC-19)"
  grep -i '^set-cookie:' "$WORK/headers" | grep -qi 'secure' || fail "login cookie not Secure"
  pass "login cookie Secure behind https proxy (AC-12)"
  [ "$(register second)" = 201 ] || fail "second sign-up"
  grep -q '"is_staff":false' "$WORK/body" || fail "second account is admin"
  pass "later accounts are normal users"

  # Admin login: CSRF must accept the site's origin (AC-12, AC-14).
  # The cookie is Secure, so curl won't send it over our plain-http hop; pass it by hand.
  local cookie token code
  cookie=$(curl -s -D - -o "$WORK/login" -H "Host: $SITE" -H 'X-Forwarded-Proto: https' \
    "http://127.0.0.1:$PORT/admin/login/" | grep -io 'csrftoken=[^;]*')
  token=$(grep -o 'name="csrfmiddlewaretoken" value="[^"]*"' "$WORK/login" | sed 's/.*value="//; s/"$//')
  code=$(curl -s -H "Cookie: $cookie" -o /dev/null -w '%{http_code}' -H "Host: $SITE" -H 'X-Forwarded-Proto: https' \
    -H "Origin: https://$SITE" -H "Referer: https://$SITE/admin/login/" \
    --data-urlencode "csrfmiddlewaretoken=$token" --data-urlencode username=first \
    --data-urlencode password=correct-horse-42 --data-urlencode next=/admin/ \
    "http://127.0.0.1:$PORT/admin/login/")
  [ "$code" = 302 ] || fail "admin login through the proxy returned $code"
  pass "admin login through the proxy (AC-14)"
}

backup_check() {
  docker exec "$1" backup >/dev/null || fail "backup command"
  docker exec "$1" sh -c 'ls /data/backups/mtgvault-*.dump' >/dev/null || fail "no dump in /data/backups"
  pass "backup writes a dump (AC-23)"
}

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$NAME-data" >/dev/null 2>&1 || true
  if [ -f "$WORK/.env" ]; then
    docker compose -p "$NAME" --env-file "$WORK/.env" -f compose.yml down -v >/dev/null 2>&1 || true
    docker run --rm -v "$WORK:/w" alpine rm -rf /w/data >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

case "$MODE" in
  aio)
    refuses_url ""
    refuses_url "ftp://$SITE"
    docker run -d --name "$NAME" -p "$PORT:80" -v "$NAME-data:/data" \
      -e MTGVAULT_URL="https://$SITE" "$IMAGE" >/dev/null
    wait_healthy || { docker logs "$NAME" | tail -40; fail "not healthy"; }
    pass "healthy on bundled Postgres and Redis (AC-1, AC-21)"
    docker exec "$NAME" test -s /data/secrets/postgres_password || fail "no generated database password"
    docker exec "$NAME" test -s /data/secrets/secret_key || fail "no generated secret key"
    pass "secrets generated in /data/secrets (AC-15, AC-16)"
    logs_have "$NAME" 'card sync and scanner bundle download queued' || fail "first sync not queued"
    pass "first sync queued on an empty catalog (AC-18)"
    # The scanner's ONNX runtime imports an .mjs module; browsers refuse it unless it is JavaScript.
    mjs=$(docker exec "$NAME" sh -c 'ls /srv/frontend/assets | grep "\.mjs$" | head -1')
    curl -s -o /dev/null -D - "http://127.0.0.1:$PORT/assets/$mjs" | grep -qi '^content-type: application/javascript' \
      || fail "$mjs is not served as JavaScript"
    pass "scanner modules served as JavaScript (spec 003)"
    accounts_and_proxy
    backup_check "$NAME"

    # A new container on the same volume keeps everything (AC-5).
    docker rm -f "$NAME" >/dev/null
    docker run -d --name "$NAME" -p "$PORT:80" -v "$NAME-data:/data" \
      -e MTGVAULT_URL="https://$SITE" "$IMAGE" >/dev/null
    wait_healthy || fail "not healthy after restart"
    [ "$(api /api/auth/login/ '{"login":"first","password":"correct-horse-42"}')" = 200 ] || fail "login after restart"
    pass "data survives a new container (AC-5)"
    ;;

  compose)
    cat > "$WORK/.env" <<EOF
MTGVAULT_URL=http://127.0.0.1:$PORT
DB_PASSWORD=
MTGVAULT_PORT=$PORT
DATA_LOCATION=$WORK/data
EOF
    if docker compose -p "$NAME" --env-file "$WORK/.env" -f compose.yml config >/dev/null 2>&1; then
      fail "compose accepts an empty DB_PASSWORD"
    fi
    pass "empty DB_PASSWORD is refused (AC-9)"
    sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$(openssl rand -hex 16)/" "$WORK/.env"
    sed -i "s#^MTGVAULT_URL=.*#MTGVAULT_URL=https://$SITE#" "$WORK/.env"
    # Run the local image under the name compose.yml expects.
    docker tag "$IMAGE" ghcr.io/pjurkowsky/mtgvault:check
    echo MTGVAULT_VERSION=check >> "$WORK/.env"
    docker compose -p "$NAME" --env-file "$WORK/.env" -f compose.yml up -d --quiet-pull 2>&1 | tail -3
    wait_healthy || { docker compose -p "$NAME" --env-file "$WORK/.env" -f compose.yml logs mtgvault | tail -40; fail "not healthy"; }
    pass "healthy on postgres and valkey services (AC-6)"
    app=$(docker compose -p "$NAME" --env-file "$WORK/.env" -f compose.yml ps -q mtgvault)
    if docker exec "$app" sh -c 'pgrep -x postgres || pgrep -x redis-server' >/dev/null; then
      fail "bundled Postgres or Redis runs in compose mode"
    fi
    pass "bundled Postgres and Redis stay off (AC-2)"
    for dir in app postgres valkey; do [ -d "$WORK/data/$dir" ] || fail "no $dir/ under DATA_LOCATION"; done
    pass "data in DATA_LOCATION/app, postgres, valkey (AC-7)"
    accounts_and_proxy
    backup_check "$app"
    docker rmi ghcr.io/pjurkowsky/mtgvault:check >/dev/null
    ;;

  http)
    docker run -d --name "$NAME" -p "$PORT:80" -v "$NAME-data:/data" \
      -e MTGVAULT_URL="http://127.0.0.1:$PORT" "$IMAGE" >/dev/null
    wait_healthy || fail "not healthy on an http URL"
    logs_have "$NAME" 'Phones can scan cards only over https' || fail "no http warning"
    pass "http URL starts with a warning (AC-13)"
    [ "$(curl -s -o /dev/null -w '%{http_code}' -D "$WORK/headers" -H 'Content-Type: application/json' \
      "http://127.0.0.1:$PORT/api/auth/register/" \
      -d '{"username":"plain","email":"plain@example.com","password":"correct-horse-42","currency":"EUR"}')" = 201 ] \
      || fail "sign-up over http"
    if grep -i '^set-cookie:' "$WORK/headers" | grep -qi 'secure'; then fail "cookie Secure on http"; fi
    pass "cookie not Secure on http (AC-12)"
    ;;

  *) echo "usage: $0 aio|compose|http"; exit 2 ;;
esac
echo "All $MODE checks passed"
