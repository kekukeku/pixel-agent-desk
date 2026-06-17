#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Resolve environment configuration file
ENV_FILE="${AGENT_COWORK_ENV_FILE:-${PIXEL_AGENT_DESK_ENV_FILE:-$HOME/.agent-cowork/reviewer.env}}"
if [[ ! -f "$ENV_FILE" && -f "$HOME/.pixel-agent-desk/reviewer.env" ]]; then
  ENV_FILE="$HOME/.pixel-agent-desk/reviewer.env"
fi

EXTERNAL_XAI_API_KEY="${XAI_API_KEY:-}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
if [[ -n "$EXTERNAL_XAI_API_KEY" ]]; then
  export XAI_API_KEY="$EXTERNAL_XAI_API_KEY"
fi

# 2. Establish defaults
export REVIEWER_ADAPTER_TOKEN="${REVIEWER_ADAPTER_TOKEN:-local-dev-token}"
export REVIEWER_ENDPOINT="${REVIEWER_ENDPOINT:-http://127.0.0.1:47822/review}"
export REVIEWER_TOKEN="${REVIEWER_TOKEN:-$REVIEWER_ADAPTER_TOKEN}"
export REVIEWER_ENGINE="${REVIEWER_ENGINE:-tui}"
export GROK_BIN="${GROK_BIN:-$HOME/.grok/bin/grok}"

# Support both AGENT_COWORK_ and PIXEL_AGENT_DESK_ watcher mode
WATCHER_EXEC_MODE="${AGENT_COWORK_WATCHER_EXECUTION_MODE:-${PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE:-active}}"
export AGENT_COWORK_WATCHER_EXECUTION_MODE="$WATCHER_EXEC_MODE"
export PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE="$WATCHER_EXEC_MODE"

if [[ "$REVIEWER_ENGINE" == "xai" && -z "${XAI_API_KEY:-}" ]]; then
  cat >&2 <<EOF
Missing XAI_API_KEY for REVIEWER_ENGINE=xai.

Create $HOME/.agent-cowork/reviewer.env (or ~/.pixel-agent-desk/reviewer.env) with:

export XAI_API_KEY="..."

For Grok Build TUI reviews (default), use:
export REVIEWER_ENGINE="tui"

For a non-AI plumbing test only, run:
REVIEWER_ENGINE=deterministic npm run workflow
EOF
  exit 1
fi

if [[ "$REVIEWER_ENGINE" == "tui" && ! -x "$GROK_BIN" ]]; then
  cat >&2 <<EOF
Missing Grok Build TUI binary at: $GROK_BIN

Install Grok Build TUI or set GROK_BIN in $ENV_FILE
EOF
  exit 1
fi

cleanup() {
  if [[ "${STARTED_ADAPTER:-0}" == "1" && -n "${ADAPTER_PID:-}" ]] && kill -0 "$ADAPTER_PID" 2>/dev/null; then
    kill "$ADAPTER_PID" 2>/dev/null || true
    wait "$ADAPTER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

CURRENT_PID="$$"
EXISTING_WATCHER="$(
  ps ax -ww -o pid=,command= |
    awk -v current="$CURRENT_PID" '
      /[p]ython3? .*watcher\.py/ || /Python .*watcher\.py/ {
        if ($1 != current) print $1
      }
    ' |
    head -n 1
)"

if [[ -n "$EXISTING_WATCHER" ]]; then
  echo "Agent Cowork watcher is already running (pid $EXISTING_WATCHER)."
  echo "Stop the existing workflow/watcher before starting another one."
  exit 0
fi

REVIEWER_PORT="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get("REVIEWER_ENDPOINT", "http://127.0.0.1:47822/review")
print(urlparse(url).port or 47822)
PY
)"

if lsof -nP -iTCP:"$REVIEWER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Grok reviewer adapter already appears to be listening on port $REVIEWER_PORT."
  STARTED_ADAPTER=0
else
  echo "Starting Grok reviewer adapter at $REVIEWER_ENDPOINT"
  # Run reviewer adapter server directly via Node.js
  node agent-runner/reviewer-adapter-server.js &
  ADAPTER_PID=$!
  STARTED_ADAPTER=1
fi

sleep 1

echo "Starting Agent Cowork watcher in $WATCHER_EXEC_MODE mode"
python3 watcher.py
