#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PYTHON="$ROOT/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$ROOT/../BloodFlow-Q1/.venv/bin/python"
fi
if [[ ! -x "$PYTHON" ]]; then
  echo 'Python environment missing. Run ./setup.sh first.'
  read -r -p 'Press Enter to close.'
  exit 1
fi
for PORT in 8000 5173; do
  if /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT is already occupied. Stop that server before launching this checkout."
    read -r -p 'Press Enter to close.'
    exit 1
  fi
done
cd "$ROOT/frontend"
npm install --no-audit --no-fund
cd "$ROOT"
API_PID=''
WEB_PID=''
cleanup() {
  [[ -z "$API_PID" ]] || kill "$API_PID" 2>/dev/null || true
  [[ -z "$WEB_PID" ]] || kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM
BLOODFLOW_ENV=development BLOODFLOW_CORS_ORIGINS=http://127.0.0.1:5173 "$PYTHON" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!
(cd "$ROOT/frontend" && VITE_API_BASE_URL=http://127.0.0.1:8000 exec npm run dev -- --host 127.0.0.1 --port 5173) &
WEB_PID=$!
for ((attempt=0; attempt<60; attempt++)); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
    open -a 'Brave Browser' http://127.0.0.1:5173
    echo 'BloodFlow-Q is running. Select Demo mode in Brave. Keep this window open; Ctrl+C stops the servers.'
    wait "$API_PID" "$WEB_PID"
    exit 0
  fi
  kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null || exit 1
  sleep 1
done
echo 'Startup timed out. Review the errors above.'
exit 1
