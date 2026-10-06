#!/usr/bin/env bash
# Start the API in production mode without developer reload or debug behavior.
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$PROJECT_ROOT/.venv/bin/python"

if [[ "${BLOODFLOW_ENV:-production}" != "production" ]]; then
  printf 'BLOODFLOW_ENV must be production when using this startup script.\n' >&2
  exit 1
fi
if [[ -z "${BLOODFLOW_CORS_ORIGINS:-}" ]]; then
  printf 'Set BLOODFLOW_CORS_ORIGINS to the exact HTTPS origin of the deployed frontend.\n' >&2
  exit 1
fi
if [[ ! -x "$PYTHON" ]]; then
  printf 'Missing project Python environment. Run setup or install production dependencies first.\n' >&2
  exit 1
fi
if ! "$PYTHON" -c 'import fastapi, uvicorn' >/dev/null 2>&1; then
  printf 'FastAPI or Uvicorn is missing from .venv/. Install requirements-prod.txt first.\n' >&2
  exit 1
fi

cd "$PROJECT_ROOT"
API_HOST="${BLOODFLOW_API_HOST:-0.0.0.0}"
API_PORT="${BLOODFLOW_API_PORT:-8000}"
export BLOODFLOW_ENV=production

printf 'Starting BloodFlow-Q API in production mode at %s:%s (reload disabled).\n' "$API_HOST" "$API_PORT"
exec "$PYTHON" -m uvicorn backend.main:app --host "$API_HOST" --port "$API_PORT"
