#!/usr/bin/env bash
# Start Vite using the dependencies installed under frontend/node_modules/.
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_HOST="${BLOODFLOW_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${BLOODFLOW_FRONTEND_PORT:-5173}"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf 'Node.js and npm are required. Install Node.js from its official website, then run ./setup.sh.\n' >&2
  exit 1
fi
if [[ ! -x "$PROJECT_ROOT/frontend/node_modules/.bin/vite" ]]; then
  printf 'Frontend packages are missing. From the project folder, run ./setup.sh first.\n' >&2
  exit 1
fi

cd "$PROJECT_ROOT/frontend"
printf 'Starting the BloodFlow-Q frontend at http://%s:%s\n' "$FRONTEND_HOST" "$FRONTEND_PORT"
exec npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort
