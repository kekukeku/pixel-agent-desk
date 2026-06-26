#!/bin/bash
# Build Start.app resources (icon + executable bit). macOS only.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT_DIR}/Start.app"
LAUNCHER="${APP_DIR}/Contents/MacOS/launcher"
ICON_SRC="${ROOT_DIR}/public/Start.icon.png"
RESOURCES_DIR="${APP_DIR}/Contents/Resources"
ICNS_OUT="${RESOURCES_DIR}/AppIcon.icns"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "build-start-app.sh: skipped (macOS only)"
  exit 0
fi

if [ ! -d "${APP_DIR}/Contents" ]; then
  echo "ERROR: Start.app bundle is missing at ${APP_DIR}" >&2
  exit 1
fi

echo "Generating launcher with hardcoded repository root..."
cat << EOF > "${LAUNCHER}"
#!/bin/bash
set -euo pipefail

# Absolute repository path hardcoded at build time
BUILD_ROOT_DIR="${ROOT_DIR}"

if [ -d "\${BUILD_ROOT_DIR}" ]; then
  ROOT_DIR="\${BUILD_ROOT_DIR}"
else
  ROOT_DIR="\$(cd "\$(dirname "\$0")/../../.." && pwd)"
fi

export PAD_ROOT_DIR="\${ROOT_DIR}"
export PAD_LAUNCH_LOG="\${TMPDIR:-/tmp}/pixel-agent-desk-launch.log"

exec bash "\${ROOT_DIR}/scripts/launch-pad.sh" --gui
EOF

chmod +x "${LAUNCHER}"

if [ ! -f "${ICON_SRC}" ]; then
  echo "Skipping icon: ${ICON_SRC} not found"
  exit 0
fi

if ! command -v sips >/dev/null 2>&1 || ! command -v iconutil >/dev/null 2>&1; then
  echo "Skipping icon: sips/iconutil not available"
  exit 0
fi

mkdir -p "${RESOURCES_DIR}"
ICONSET="$(mktemp -d "${TMPDIR:-/tmp}/pad-start-icon.XXXXXX.iconset")"
trap 'rm -rf "${ICONSET}"' EXIT

for size in 16 32 128 256 512; do
  sips -z "${size}" "${size}" "${ICON_SRC}" --out "${ICONSET}/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "${double}" "${double}" "${ICON_SRC}" --out "${ICONSET}/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "${ICONSET}" -o "${ICNS_OUT}"
echo "Built ${ICNS_OUT}"

if [ -f "${ROOT_DIR}/scripts/apply_start_icon.swift" ]; then
  (cd "${ROOT_DIR}" && swift scripts/apply_start_icon.swift) || true
fi

# Clear extended attributes to prevent translocation/sandbox issues
if command -v xattr >/dev/null 2>&1; then
  echo "Clearing extended attributes from Start.app..."
  xattr -cr "${APP_DIR}" || true
fi