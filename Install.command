#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

# shellcheck source=scripts/ensure-node.sh
source "${ROOT_DIR}/scripts/ensure-node.sh"

echo "Pixel Agent Desk — First-time setup"
echo "===================================="

if ! ensure_node; then
  echo ""
  echo "Setup failed: could not prepare Node.js."
  echo "You can install Node.js 20+ from https://nodejs.org and run: npm install"
  echo ""
  echo "Press any key to close..."
  read -r -n 1 _
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is not available on PATH." >&2
  echo "Press any key to close..."
  read -r -n 1 _
  exit 1
fi

echo ""
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo ""
echo "Installing Pixel Agent Desk dependencies (npm install)..."
echo ""

if ! npm install; then
  echo ""
  echo "npm install failed. See errors above."
  echo "Press any key to close..."
  read -r -n 1 _
  exit 1
fi

echo ""
echo "Applying custom icons to scripts..."
if [ -f "${ROOT_DIR}/scripts/apply_start_icon.swift" ]; then
  (cd "${ROOT_DIR}" && swift scripts/apply_start_icon.swift) || true
fi

echo ""
echo "--------------------------------------------------"
echo "Installation complete!"
echo ""
echo "Next step:"
echo "  - Double-click Start.command in this folder to launch Pixel Agent Desk."
echo "    (It will start in the background and automatically close the Terminal window!)"
echo ""
echo "Press any key to close..."
read -r -n 1 _