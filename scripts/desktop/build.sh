#!/usr/bin/env bash
# scripts/desktop/build.sh — 데스크톱 앱 소스코드 빌드
#
# 수행 작업:
#   1. npm 워크스페이스 의존성 설치
#   2. apps/desktop 프런트엔드 빌드 (Vite → apps/desktop/dist/)
#   3. Tauri 릴리즈 번들 빌드
#      - macOS : .app, .dmg
#      - Linux : .deb, .AppImage
#      - Windows: .msi, .exe
#
# 결과물: <root>/dist/desktop/bundle/
# 다음 단계:
#   실행  : ./scripts/desktop/run.sh
#   배포  : ./scripts/desktop/release.sh
#
# 사전 조건:
#   - Rust 툴체인 (rustup 권장)
#   - macOS: Xcode Command Line Tools
#   - Linux: libwebkit2gtk-4.0-dev, libssl-dev 등
#
# 사용법: ./scripts/desktop/build.sh
# 또는  : ./scripts/desktop-build.sh  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
BUILD_BUNDLE_DIR="$ROOT_DIR/target/release/bundle"   # Tauri 원래 출력 경로
DIST_DIR="$ROOT_DIR/dist/desktop/bundle"              # 최종 결과물 경로
VERSION="${VERSION:-$(date +%Y%m%d)}"

echo "╔══════════════════════════════════════╗"
echo "║    PMS Desktop (Tauri)  —  Build     ║"
echo "╚══════════════════════════════════════╝"
echo "  Root   : $ROOT_DIR"
echo "  Desktop: $DESKTOP_DIR"
echo "  Version: $VERSION"
echo ""

# Rust 설치 확인
if ! command -v cargo &>/dev/null; then
  echo "❌ 오류: Rust/Cargo가 설치되어 있지 않습니다."
  echo "   https://rustup.rs 에서 설치하세요."
  exit 1
fi

# ── Step 1: npm 의존성 설치 ─────────────────────────────────
echo "[1/3] Installing npm dependencies..."
cd "$ROOT_DIR"
npm install --legacy-peer-deps

# ── Step 2: 프런트엔드 빌드 ─────────────────────────────────
echo "[2/4] Building desktop frontend (apps/desktop)..."
npm run build --workspace=apps/desktop
echo "      → apps/desktop/dist/ 생성 완료"

# ── Step 3: Tauri 릴리즈 번들 빌드 ──────────────────────────
echo "[3/4] Building Tauri bundle (release)..."
cd "$DESKTOP_DIR"
CARGO_TARGET_DIR="$ROOT_DIR/target" npm run tauri -- build

# ── Step 4: dist/desktop/bundle/ 로 복사 ─────────────────────
echo "[4/4] Copying bundles to dist/desktop/bundle/..."
mkdir -p "$DIST_DIR"
rm -rf "$DIST_DIR"
cp -r "$BUILD_BUNDLE_DIR/" "$DIST_DIR"
echo "      → $DIST_DIR 복사 완료"

echo ""
echo "✅ 데스크톱 앱 빌드 완료!"
echo "   결과물: $DIST_DIR"
echo "   실행 : ./scripts/desktop/run.sh"
echo "   배포 : ./scripts/desktop/release.sh"

# 생성된 번들 목록 출력
if [ -d "$DIST_DIR" ]; then
  echo ""
  echo "  생성된 번들:"
  find "$DIST_DIR" -maxdepth 2 -type f \( \
    -name "*.dmg" -o -name "*.app" -o \
    -name "*.deb" -o -name "*.AppImage" -o \
    -name "*.msi" -o -name "*.exe" \
  \) | while read -r f; do
    SIZE=$(du -sh "$f" 2>/dev/null | cut -f1)
    echo "    [$SIZE] $(basename "$f")"
  done
fi
