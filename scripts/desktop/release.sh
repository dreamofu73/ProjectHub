#!/usr/bin/env bash
# scripts/desktop/release.sh — 데스크톱 앱 배포 패키지 생성
#
# 수행 작업:
#   1. 소스 빌드 (scripts/desktop/build.sh 호출)
#   2. 플랫폼별 인스톨러를 release/ 디렉터리로 복사
#      - macOS : release/pms-desktop-<ver>-macos-<arch>.dmg  (+ .tgz)
#      - Linux : release/pms-desktop-<ver>-linux-<arch>.tgz  (+ .deb / .AppImage)
#      - Windows: release/pms-desktop-<ver>-windows-<arch>.zip (+ .msi)
#
# 결과물: <root>/release/ 디렉터리
#
# 사용법: ./scripts/desktop/release.sh [VERSION]
#   예시: VERSION=1.2.0 ./scripts/desktop/release.sh
# 또는  : ./scripts/desktop-release.sh [VERSION]  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION="${VERSION:-${1:-$(date +%Y%m%d)}}"

OS_RAW="$(uname -s)"
ARCH="$(uname -m)"

case "$OS_RAW" in
  Darwin)               OS_NAME="macos"   ;;
  Linux)                OS_NAME="linux"   ;;
  MINGW*|CYGWIN*|MSYS*) OS_NAME="windows" ;;
  *)                    OS_NAME="${OS_RAW,,}" ;;
esac

BUNDLE_DIR="$ROOT_DIR/dist/desktop/bundle"
RELEASE_DIR="$ROOT_DIR/release"
PKG_PREFIX="pms-desktop-${VERSION}-${OS_NAME}-${ARCH}"

echo "╔══════════════════════════════════════╗"
echo "║    PMS Desktop (Tauri)  —  Release   ║"
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
echo "[2/2] Packaging release artifacts..."
mkdir -p "$RELEASE_DIR"

copy_artifact() {
  local src="$1"
  local dest="$RELEASE_DIR/$(basename "$src")"
  cp "$src" "$dest"
  SIZE=$(du -sh "$dest" 2>/dev/null | cut -f1)
  echo "    [$SIZE] $(basename "$dest")"
}

case "$OS_NAME" in
  macos)
    # .dmg 복사 + .app 아카이브
    while IFS= read -r f; do copy_artifact "$f"; done < \
      <(find "$BUNDLE_DIR" -name "*.dmg" -maxdepth 3 2>/dev/null)
    while IFS= read -r f; do
      ARCHIVE="$RELEASE_DIR/${PKG_PREFIX}.tgz"
      tar -czf "$ARCHIVE" -C "$(dirname "$f")" "$(basename "$f")"
      SIZE=$(du -sh "$ARCHIVE" 2>/dev/null | cut -f1)
      echo "    [$SIZE] $(basename "$ARCHIVE")"
    done < <(find "$BUNDLE_DIR" -name "*.app" -maxdepth 3 2>/dev/null)
    ;;

  linux)
    # .deb, .AppImage 복사 + tgz 아카이브
    while IFS= read -r f; do copy_artifact "$f"; done < \
      <(find "$BUNDLE_DIR" \( -name "*.deb" -o -name "*.AppImage" \) -maxdepth 3 2>/dev/null)
    ARCHIVE="$RELEASE_DIR/${PKG_PREFIX}.tgz"
    tar -czf "$ARCHIVE" -C "$BUNDLE_DIR" .
    SIZE=$(du -sh "$ARCHIVE" 2>/dev/null | cut -f1)
    echo "    [$SIZE] $(basename "$ARCHIVE")"
    ;;

  windows)
    # .msi, .exe(setup) 복사 + zip 아카이브
    while IFS= read -r f; do copy_artifact "$f"; done < \
      <(find "$BUNDLE_DIR" \( -name "*.msi" -o -name "*setup*.exe" \) -maxdepth 3 2>/dev/null)
    ARCHIVE="$RELEASE_DIR/${PKG_PREFIX}.zip"
    (cd "$BUNDLE_DIR" && zip -r "$ARCHIVE" .)
    SIZE=$(du -sh "$ARCHIVE" 2>/dev/null | cut -f1)
    echo "    [$SIZE] $(basename "$ARCHIVE")"
    ;;
esac

echo ""
echo "✅ 배포 패키지 생성 완료!"
echo "   경로: $RELEASE_DIR"
ls -lh "$RELEASE_DIR/${PKG_PREFIX}"* 2>/dev/null || true
