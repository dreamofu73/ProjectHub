#!/usr/bin/env bash
# scripts/web/release.sh — 웹 앱 배포 패키지 생성
#
# 수행 작업:
#   1. 소스 빌드 (scripts/web/build.sh 호출)
#   2. 플랫폼별 배포 아카이브 생성
#      - Linux/macOS : release/pms-web-<ver>-<os>-<arch>.tgz
#      - Windows     : release/pms-web-<ver>-windows-<arch>.zip
#
# 결과물: <root>/release/ 디렉터리
#
# 사용법: ./scripts/web/release.sh [VERSION]
#   예시: VERSION=1.2.0 ./scripts/web/release.sh
# 또는  : ./scripts/web-release.sh [VERSION]  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION="${VERSION:-${1:-$(date +%Y%m%d)}}"

OS_RAW="$(uname -s)"
ARCH="$(uname -m)"

case "$OS_RAW" in
  Darwin)  OS_NAME="macos"   ;;
  Linux)   OS_NAME="linux"   ;;
  MINGW*|CYGWIN*|MSYS*) OS_NAME="windows" ;;
  *)       OS_NAME="${OS_RAW,,}" ;;
esac

RELEASE_DIR="$ROOT_DIR/release"
ARCHIVE_BASE="pms-web-${VERSION}-${OS_NAME}-${ARCH}"

echo "╔══════════════════════════════════════╗"
echo "║       PMS Web  —  Release            ║"
echo "╚══════════════════════════════════════╝"
echo "  Root   : $ROOT_DIR"
echo "  Version: $VERSION"
echo "  OS/Arch: $OS_NAME / $ARCH"
echo ""

# ── Step 1: 소스 빌드 ───────────────────────────────────────
echo "[1/2] Running build..."
VERSION="$VERSION" bash "$SCRIPT_DIR/build.sh"

# ── Step 2: 배포 아카이브 생성 ──────────────────────────────
echo ""
echo "[2/2] Creating release archive..."
mkdir -p "$RELEASE_DIR"

# 패키징 대상: 바이너리 + 프런트엔드 정적 파일 + config 샘플
STAGE_DIR="$(mktemp -d)"
cp "$ROOT_DIR/dist/web/pms" "$STAGE_DIR/"
cp -r "$ROOT_DIR/dist/web/dist" "$STAGE_DIR/dist"
[ -f "$ROOT_DIR/config.toml" ] && cp "$ROOT_DIR/config.toml" "$STAGE_DIR/config.toml.example"

if [ "$OS_NAME" = "windows" ]; then
  ARCHIVE="$RELEASE_DIR/${ARCHIVE_BASE}.zip"
  (cd "$STAGE_DIR" && zip -r "$ARCHIVE" .)
else
  ARCHIVE="$RELEASE_DIR/${ARCHIVE_BASE}.tgz"
  tar -czf "$ARCHIVE" -C "$STAGE_DIR" .
fi

rm -rf "$STAGE_DIR"

SIZE=$(du -sh "$ARCHIVE" 2>/dev/null | cut -f1)
echo ""
echo "✅ 배포 패키지 생성 완료!"
echo "   경로  : $ARCHIVE"
echo "   크기  : $SIZE"
