#!/usr/bin/env bash
# scripts/release.sh — Versioned release flow for the ahp-inspector npm package.
#
# Usage:
#   scripts/release.sh [--dry-run] [<version>]
#
# Behavior:
#   - Pre-flight: clean tree, frozen install, typecheck, tests, UI build, CLI build.
#   - Pack and smoke-install the tarball into a tmpdir; assert version output.
#   - Publish (or skip if --dry-run).
#   - Tag v<version> on success (real publish only). Push the tag manually.
#
# Notes:
#   - Uses `pnpm pack` (not `npm pack`) so workspace:* protocol is rewritten to
#     literal versions in the published manifest.
#   - The CLI's prepublishOnly hook re-runs typecheck + UI build + CLI build
#     before npm publish — this script's pre-flight is the user-visible rehearsal
#     of that exact pipeline.

set -euo pipefail

DRY_RUN=0
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0 ;;
    *)
      if [ -z "$VERSION" ]; then VERSION="$arg"
      else echo "ERROR: unexpected argument: $arg" >&2; exit 1
      fi ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

CLI_DIR="$REPO_ROOT/packages/cli"

if [ -n "$VERSION" ]; then
  if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$ ]]; then
    echo "ERROR: version '$VERSION' is not valid semver." >&2
    exit 1
  fi
  echo "→ Bumping ahp-inspector to ${VERSION}"
  pnpm --filter ahp-inspector version "$VERSION" --no-git-tag-version
else
  VERSION=$(node -e "console.log(require('./packages/cli/package.json').version)")
  printf "Release ahp-inspector@%s? [y/N] " "$VERSION"
  read -r REPLY
  case "$REPLY" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty — commit or stash before releasing." >&2
  exit 1
fi

echo "→ Pre-flight: install + typecheck + test + build"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm -F @ahp-inspector/ui build
pnpm -F ahp-inspector build

TARBALL_NAME="ahp-inspector-${VERSION}.tgz"
TMP_INSTALL=""
cleanup() {
  rm -f "${CLI_DIR}/${TARBALL_NAME}" 2>/dev/null || true
  if [ -n "$TMP_INSTALL" ] && [ -d "$TMP_INSTALL" ]; then
    rm -rf "$TMP_INSTALL" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "→ Packing tarball"
( cd "$CLI_DIR" && pnpm pack )
test -f "${CLI_DIR}/${TARBALL_NAME}" || {
  echo "ERROR: expected ${TARBALL_NAME} not produced" >&2
  exit 1
}

echo "→ Smoke install + version check"
TMP_INSTALL=$(mktemp -d)
(
  cd "$TMP_INSTALL"
  npm init -y > /dev/null
  npm i "${CLI_DIR}/${TARBALL_NAME}" > /dev/null
  ACTUAL=$(npx ahp-inspector --version)
  if [ "$ACTUAL" != "$VERSION" ]; then
    echo "ERROR: smoke test got version '$ACTUAL', expected '$VERSION'" >&2
    exit 1
  fi
)
echo "Tarball smoke test passed."

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run — would now run: npm publish --access public"
  exit 0
fi

echo "→ Publishing to npm"
( cd "$CLI_DIR" && npm publish --access public )

git tag "v${VERSION}"
echo "Published ahp-inspector@${VERSION}. Push the tag with: git push origin v${VERSION}"
