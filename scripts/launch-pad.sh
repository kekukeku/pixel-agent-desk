#!/usr/bin/env bash
# Launch Pixel Agent Desk from the repository root.
# Usage: launch-pad.sh [--gui]

set -euo pipefail

ROOT_DIR="${PAD_ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
GUI=false

if [ "${1:-}" = "--gui" ]; then
  GUI=true
fi

# shellcheck source=scripts/ensure-node.sh
source "${ROOT_DIR}/scripts/ensure-node.sh"

pad_alert() {
  local title="$1"
  local message="$2"
  if $GUI; then
    osascript -e "display alert \"${title}\" message \"${message}\" as critical" >/dev/null 2>&1 || true
  else
    echo ""
    echo "${title}"
    echo "${message}"
    echo ""
    echo "Press any key to close..."
    read -r -n 1 _
  fi
}

if $GUI; then
  if ! ensure_node >"${PAD_LAUNCH_LOG:-/dev/null}" 2>&1; then
    pad_alert "Pixel Agent Desk" "Could not prepare Node.js. Double-click Install.command first, or install Node.js 20+ from nodejs.org."
    exit 1
  fi
elif ! ensure_node; then
  pad_alert "Pixel Agent Desk" "Could not prepare Node.js. Double-click Install.command first, or install Node.js 20+ from nodejs.org."
  exit 1
fi

if [ ! -d "${ROOT_DIR}/node_modules" ]; then
  pad_alert "Pixel Agent Desk" "Dependencies are not installed yet. Double-click Install.command first (one-time setup)."
  exit 1
fi

cd "${ROOT_DIR}"
exec npm start