#!/usr/bin/env bash
# Install BloodFlow-Q dependencies locally; no global Python/npm packages are changed.
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

for command_name in python3 node npm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    printf 'Install Python 3, Node.js, and npm from their official sources, then run ./setup.sh again.\n' >&2
    exit 1
  fi
done

if [[ ! -x "$PROJECT_ROOT/.venv/bin/python" ]]; then
  printf 'Creating the project-local Python environment at .venv/…\n'
  python3 -m venv "$PROJECT_ROOT/.venv"
fi

printf 'Installing Python packages into .venv/ (global Python is unchanged)…\n'
"$PROJECT_ROOT/.venv/bin/python" -m pip install --disable-pip-version-check -r "$PROJECT_ROOT/requirements.txt"

printf 'Installing frontend packages from the checked-in lock file…\n'
(cd "$PROJECT_ROOT/frontend" && npm ci)

printf '\nSetup is complete. Start the app with ./dev.sh\n'
