#!/usr/bin/env bash
set -euo pipefail

# OpenCode Local Binary Installer & Symlinker
# Builds the standalone native binary and symlinks it into $PATH ($HOME/.local/bin or /usr/local/bin)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEST_DIR="${HOME}/.local/bin"
LINK_ONLY=false
COPY_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --link-only)
      LINK_ONLY=true
      shift
      ;;
    --copy)
      COPY_MODE=true
      shift
      ;;
    --dest)
      DEST_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./script/install-local.sh [options]"
      echo ""
      echo "Options:"
      echo "  --link-only     Skip build step and symlink existing dist/ binary"
      echo "  --copy          Copy binary instead of creating a symlink"
      echo "  --dest <dir>    Target directory in PATH (default: ~/.local/bin)"
      echo "  -h, --help      Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    ARCH="x64"
    ;;
  arm64|aarch64)
    ARCH="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

DIST_DIR="${ROOT_DIR}/packages/opencode/dist/opencode-${OS}-${ARCH}/bin"
BINARY_PATH="${DIST_DIR}/opencode"

if [ "$LINK_ONLY" = false ] || [ ! -f "$BINARY_PATH" ]; then
  echo "🔨 Building standalone OpenCode binary for ${OS}-${ARCH}..."
  ./packages/opencode/script/build.ts --single
fi

if [ ! -f "$BINARY_PATH" ]; then
  echo "❌ Error: Built binary not found at $BINARY_PATH"
  exit 1
fi

mkdir -p "$DEST_DIR"
TARGET_PATH="${DEST_DIR}/opencode"

# Clean up existing binary or symlink
if [ -L "$TARGET_PATH" ] || [ -f "$TARGET_PATH" ]; then
  rm -f "$TARGET_PATH"
fi

if [ "$COPY_MODE" = true ]; then
  echo "📦 Copying binary to $TARGET_PATH..."
  cp "$BINARY_PATH" "$TARGET_PATH"
  chmod +x "$TARGET_PATH"
else
  echo "🔗 Symlinking $BINARY_PATH -> $TARGET_PATH..."
  ln -sf "$BINARY_PATH" "$TARGET_PATH"
fi

echo ""
echo "✅ OpenCode installed successfully to $TARGET_PATH!"

# PATH verification
if [[ ":$PATH:" != *":$DEST_DIR:"* ]]; then
  echo "⚠️  Note: $DEST_DIR is not in your current PATH."
  echo "   Add it to your ~/.zshrc or ~/.bashrc:"
  echo "   export PATH=\"$DEST_DIR:\$PATH\""
else
  echo "📍 Verified: $DEST_DIR is in your active PATH."
fi

echo ""
echo "🚀 Testing installed binary:"
"$TARGET_PATH" --version
echo ""
echo "You can now run 'opencode' or 'opencode host' from any directory!"
