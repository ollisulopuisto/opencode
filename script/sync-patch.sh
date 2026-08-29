#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PATCH_FILE="$ROOT_DIR/patches/custom/memory-optimizations.patch"
UPSTREAM_REPO="https://github.com/anomalyco/opencode.git"

TARGET_TAG="${1:-latest}"

cd "$ROOT_DIR"

if [ "$TARGET_TAG" = "latest" ]; then
  echo "Fetching latest upstream release tag..."
  if command -v gh >/dev/null 2>&1; then
    TARGET_TAG=$(gh release view --repo anomalyco/opencode --json tagName --jq .tagName)
  else
    TARGET_TAG=$(git ls-remote --tags --refs "$UPSTREAM_REPO" | awk -F'/' '{print $3}' | grep '^v' | sort -V | tail -n 1)
  fi
fi

echo "Target release: $TARGET_TAG"
echo "Fetching $TARGET_TAG from $UPSTREAM_REPO..."
git fetch "$UPSTREAM_REPO" "refs/tags/$TARGET_TAG:refs/tags/$TARGET_TAG" --depth=10 || git fetch "$UPSTREAM_REPO" "$TARGET_TAG" --depth=10

echo "Checking out $TARGET_TAG into branch patched-$TARGET_TAG..."
git checkout -B "patched-$TARGET_TAG" "$TARGET_TAG"

echo "Applying patch: $PATCH_FILE..."
if git apply --check "$PATCH_FILE"; then
  git apply "$PATCH_FILE"
else
  echo "Standard apply failed, trying 3-way merge apply..."
  git apply --3way "$PATCH_FILE"
fi

echo "Patch applied successfully to $TARGET_TAG!"
echo "Running bun install & typecheck..."
bun install
bun --cwd packages/core typecheck
bun --cwd packages/opencode typecheck
bun --cwd packages/tui typecheck

echo "Done! You are on branch patched-$TARGET_TAG."
