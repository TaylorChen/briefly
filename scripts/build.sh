#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

mkdir -p "$DIST_DIR"
cd "$ROOT_DIR"

NAME="briefly"
VERSION=$(jq -r .version manifest.json 2>/dev/null || echo "0.1.0")

# 通用打包（Chrome/Firefox 均可）
ZIP_FILE="$DIST_DIR/${NAME}-${VERSION}.zip"

# 清理
rm -f "$ZIP_FILE"

# 打包（排除不必要文件）
zip -r "$ZIP_FILE" . \
  -x "dist/*" \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "scripts/*"

echo "已生成：$ZIP_FILE"
