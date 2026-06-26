#!/bin/bash
# ponytail: re-apply custom Finder icon; macOS does not store icons in git.
set -euo pipefail
cd "$(dirname "$0")/.."
swift scripts/apply_start_icon.swift