#!/usr/bin/env bash
# Start FastAPI using only the project's virtual environment.
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$PROJECT_ROOT/.venv/bin/python"
API_HOST="${BLOODFLOW_API_HOST:-127.0.0.1}"
API_PORT="${BLOODFLOW_API_PORT:-8000}"

if [[ ! -x "$PYTHON" ]]; then
  printf 'The local Python environment is missing. From the project folder, run ./setup.sh first.\n' >&2
  exit 1
fi
if ! "$PYTHON" -c 'import fastapi, uvicorn' >/dev/null 2>&1; then
  printf 'FastAPI or Uvicorn is missing from .venv/. Run ./setup.sh to install project dependencies.\n' >&2
  exit 1
fi

cd "$PROJECT_ROOT"
printf 'Starting the BloodFlow-Q API at http://%s:%s\n' "$API_HOST" "$API_PORT"
exec "$PYTHON" -m uvicorn backend.main:app --reload --host "$API_HOST" --port "$API_PORT"
