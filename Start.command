#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
export PAD_ROOT_DIR="$(pwd)"

# Run in background detaching from terminal
nohup bash "${PAD_ROOT_DIR}/scripts/launch-pad.sh" --gui >/dev/null 2>&1 &

# Close the Terminal window that just opened
osascript -e 'tell application "Terminal" to close first window' &