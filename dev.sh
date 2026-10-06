#!/usr/bin/env bash
# Run the API and Vite together; Ctrl+C stops both local development servers.
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""
API_HOST="${BLOODFLOW_API_HOST:-127.0.0.1}"
API_PORT="${BLOODFLOW_API_PORT:-8000}"
FRONTEND_HOST="${BLOODFLOW_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${BLOODFLOW_FRONTEND_PORT:-5173}"
PYTHON="$PROJECT_ROOT/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  printf 'The local Python environment is missing. From the project folder, run ./setup.sh first.\n' >&2
  exit 1
fi

# A server left running from an older checkout can answer /health while
# missing newer routes such as /demo-run. Refuse to start beside it so the
# presenter gets a clear restart instruction instead of a stale or mixed demo.
check_local_port_free() {
  local port="$1"
  if "$PYTHON" - "$port" <<'PY'
import socket
import sys

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
    probe.settimeout(0.3)
    raise SystemExit(1 if probe.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 0)
PY
  then
    return 0
  fi

  printf 'Port %s already has a local server. Stop the old server in its terminal with Ctrl+C, then run ./dev.sh again.\n' "$port" >&2
  printf 'To identify it on macOS, run: lsof -nP -iTCP:%s -sTCP:LISTEN\n' "$port" >&2
  return 1
}

check_local_port_free "$API_PORT" || exit 1
check_local_port_free "$FRONTEND_PORT" || exit 1

stop_servers() {
  trap - EXIT INT TERM
  for process_id in "$BACKEND_PID" "$FRONTEND_PID"; do
    if [[ -n "$process_id" ]]; then
      kill "$process_id" >/dev/null 2>&1 || true
    fi
  done
  for process_id in "$BACKEND_PID" "$FRONTEND_PID"; do
    if [[ -n "$process_id" ]]; then
      wait "$process_id" >/dev/null 2>&1 || true
    fi
  done
  printf '\nBloodFlow-Q development servers stopped.\n'
}

trap stop_servers EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$PROJECT_ROOT/scripts/start-backend.sh" &
BACKEND_PID=$!
"$PROJECT_ROOT/scripts/start-frontend.sh" &
FRONTEND_PID=$!

printf 'Both services are launching. Open http://%s:%s when Vite reports ready.\n' "$FRONTEND_HOST" "$FRONTEND_PORT"
printf 'The API and interactive API docs are at http://%s:%s and http://%s:%s/docs.\n' "$API_HOST" "$API_PORT" "$API_HOST" "$API_PORT"
printf 'Keep this terminal open. Press Ctrl+C here to stop both services.\n\n'

# Wait for both child processes. Ctrl+C runs the cleanup trap above.
wait "$BACKEND_PID" "$FRONTEND_PID"
