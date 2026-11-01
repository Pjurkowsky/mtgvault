#!/usr/bin/env bash
# Regenerate the OpenAPI schema and the frontend types, then fail if either
# differs from what is committed. Run after any API change.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd backend && uv run manage.py spectacular --validate --fail-on-warn --file openapi.yaml)
(cd frontend && pnpm --silent gen:api)

files=(backend/openapi.yaml frontend/src/api/schema.d.ts)
if [ -n "$(git status --porcelain -- "${files[@]}")" ]; then
  git --no-pager diff -- "${files[@]}"
  echo "API schema or generated types are out of date. Commit the regenerated files." >&2
  exit 1
fi
echo "API schema and types are up to date."
