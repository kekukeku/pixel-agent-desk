#!/usr/bin/env bash
# verify-package.sh
# Verifies that agent-cowork/ contains no Pixel Agent Desk UI/App assets.

echo "=== Verifying agent-cowork package ==="
INVALID_FILES=$(find agent-cowork -path '*/public/*' -o -path '*/src/*' -o -name 'dashboard.html' -o -name 'index.html' 2>/dev/null)

if [ -n "$INVALID_FILES" ]; then
  echo "❌ Error: Excluded paths/files found inside agent-cowork:"
  echo "$INVALID_FILES"
  exit 1
else
  echo "✅ Success: No Pixel Agent Desk UI/App assets found inside agent-cowork."
  exit 0
fi
