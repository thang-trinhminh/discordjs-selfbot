#!/usr/bin/env bash
# Bung packages/discord.js/{src,typings} từ repo discord.js vào root repo này.
# Dùng cho cả lần đầu lẫn các lần nâng cấp upstream sau này.
#
# Usage: ./scripts/sync-upstream.sh <git-ref>   (mặc định: 8047fe7c5)
set -euo pipefail

REF="${1:-8047fe7c5}"
UPSTREAM_REPO="${UPSTREAM_REPO:-../discord.js}"
DEST="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$UPSTREAM_REPO/.git" ]; then
  echo "Khong tim thay repo discord.js tai $UPSTREAM_REPO" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git -C "$UPSTREAM_REPO" archive "$REF" packages/discord.js/src packages/discord.js/typings \
  | tar -x -C "$TMP"

rm -rf "$DEST/src" "$DEST/typings"
mv "$TMP/packages/discord.js/src" "$DEST/src"
mv "$TMP/packages/discord.js/typings" "$DEST/typings"

echo "Da sync tu $REF"
git -C "$UPSTREAM_REPO" rev-parse "$REF"
