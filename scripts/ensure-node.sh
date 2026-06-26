#!/usr/bin/env bash
# Portable Node.js bootstrap for macOS (.command launchers).
# Installs official Node binaries to ~/.local/node when missing or older than v20.

PAD_NODE_VERSION="${PAD_NODE_VERSION:-22.14.0}"
PAD_NODE_MAJOR_MIN="${PAD_NODE_MAJOR_MIN:-20}"
PAD_NODE_DIR="${PAD_NODE_DIR:-$HOME/.local/node}"

_pad_node_major() {
  local node_bin="$1"
  if [ ! -x "$node_bin" ]; then
    echo 0
    return
  fi
  "$node_bin" -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0
}

_pad_detect_platform() {
  local kernel arch
  kernel="$(uname -s)"
  arch="$(uname -m)"
  if [ "$kernel" != "Darwin" ]; then
    echo "unsupported-os"
    return
  fi
  case "$arch" in
    arm64|aarch64) echo "darwin-arm64" ;;
    x86_64) echo "darwin-x64" ;;
    *) echo "unsupported-arch" ;;
  esac
}

_pad_print_node_path() {
  export PATH="$PAD_NODE_DIR/bin:$PATH"
}

_pad_download_node() {
  local platform="$1"
  local version="$2"
  local dest_dir="$3"
  local tarball="node-v${version}-${platform}.tar.gz"
  local url="https://nodejs.org/dist/v${version}/${tarball}"
  local tmp_dir extracted

  if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: curl is required to download Node.js." >&2
    return 1
  fi
  if ! command -v tar >/dev/null 2>&1; then
    echo "ERROR: tar is required to extract Node.js." >&2
    return 1
  fi

  tmp_dir="$(mktemp -d -t pad-node.XXXXXX)"
  echo "Downloading Node.js v${version} (${platform})..."
  echo "  ${url}"

  if ! curl -fsSL --retry 3 --retry-delay 2 "$url" -o "${tmp_dir}/${tarball}"; then
    echo "ERROR: Failed to download Node.js from nodejs.org." >&2
    echo "       Check your network connection and try again." >&2
    rm -rf "$tmp_dir"
    return 1
  fi

  tar -xzf "${tmp_dir}/${tarball}" -C "$tmp_dir"
  extracted="${tmp_dir}/node-v${version}-${platform}"
  if [ ! -x "${extracted}/bin/node" ]; then
    echo "ERROR: Downloaded Node.js archive is missing bin/node." >&2
    rm -rf "$tmp_dir"
    return 1
  fi

  mkdir -p "$(dirname "$dest_dir")"
  rm -rf "$dest_dir"
  mv "$extracted" "$dest_dir"
  rm -rf "$tmp_dir"

  echo "Node.js installed to ${dest_dir}"
  export PATH="${dest_dir}/bin:$PATH"
  node -v
  npm -v
}

# Ensure Node.js >= PAD_NODE_MAJOR_MIN is available on PATH.
# Returns 0 on success, 1 on failure.
ensure_node() {
  local platform bundled_major system_node system_major

  if [ "$(uname -s)" != "Darwin" ]; then
    echo "ERROR: ensure-node.sh is for macOS (.command) launchers only." >&2
    echo "       On other platforms, install Node.js ${PAD_NODE_MAJOR_MIN}+ manually." >&2
    return 1
  fi

  platform="$(_pad_detect_platform)"
  if [ "$platform" = "unsupported-arch" ] || [ "$platform" = "unsupported-os" ]; then
    echo "ERROR: Unsupported Mac architecture: $(uname -m)" >&2
    return 1
  fi

  bundled_major="$(_pad_node_major "${PAD_NODE_DIR}/bin/node")"
  if [ "$bundled_major" -ge "$PAD_NODE_MAJOR_MIN" ]; then
    _pad_print_node_path
    return 0
  fi

  system_node="$(command -v node 2>/dev/null || true)"
  if [ -n "$system_node" ]; then
    system_major="$(_pad_node_major "$system_node")"
    if [ "$system_major" -ge "$PAD_NODE_MAJOR_MIN" ]; then
      echo "Using system Node.js ($("$system_node" -v))"
      return 0
    fi
    echo "System Node.js is too old ($("$system_node" -v)); installing portable Node ${PAD_NODE_VERSION}..."
  else
    echo "Node.js not found; installing portable Node ${PAD_NODE_VERSION}..."
  fi

  if ! _pad_download_node "$platform" "$PAD_NODE_VERSION" "$PAD_NODE_DIR"; then
    return 1
  fi

  _pad_print_node_path

  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm is missing after Node.js install." >&2
    return 1
  fi

  return 0
}