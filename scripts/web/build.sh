#!/usr/bin/env bash
# scripts/web/build.sh — 웹 앱 소스코드 빌드
#
# 수행 작업:
#   1. npm 워크스페이스 의존성 설치
#   2. apps/web TypeScript 컴파일 + Vite 빌드 → apps/web/dist/
#   3. Rust 백엔드 릴리즈 빌드
#   4. 실행 바이너리 및 프런트엔드 정적 파일 → <root>/dist/web/
#
# 결과물: <root>/dist/web/pms (백엔드 바이너리), <root>/dist/web/dist (프런트엔드 정적 파일)
# 다음 단계:
#   실행  : ./scripts/web/run.sh
#   배포  : ./scripts/web/release.sh
#
# 사용법: ./scripts/web/build.sh
# 또는  : ./scripts/web-build.sh  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION="${VERSION:-$(date +%Y%m%d)}"

echo "╔══════════════════════════════════════╗"
echo "║       PMS Web  —  Build              ║"
echo "╚══════════════════════════════════════╝"
echo "  Root   : $ROOT_DIR"
echo "  Version: $VERSION"
echo ""

# ── Step 1: npm 의존성 설치 ─────────────────────────────────
echo "[1/3] Installing npm dependencies..."
cd "$ROOT_DIR"
npm install --legacy-peer-deps

# ── Step 2: 프런트엔드 빌드 ─────────────────────────────────
echo "[2/3] Building frontend (apps/web)..."
npm run build --workspace=apps/web
echo "      → apps/web/dist/ 생성 완료"

# ── Step 3: 백엔드 릴리즈 빌드 ──────────────────────────────
echo "[3/3] Building backend (Rust release)..."
CARGO_TARGET_DIR="$ROOT_DIR/target" \
  cargo build --release --manifest-path "$ROOT_DIR/backend/Cargo.toml"
mkdir -p "$ROOT_DIR/dist/web"
cp "$ROOT_DIR/target/release/backend" "$ROOT_DIR/dist/web/pms"
chmod +x "$ROOT_DIR/dist/web/pms"

# 프런트엔드 정적 파일 복사
rm -rf "$ROOT_DIR/dist/web/dist"
cp -r "$ROOT_DIR/apps/web/dist" "$ROOT_DIR/dist/web/dist"

echo "      → $ROOT_DIR/dist/web/pms 및 dist/web/dist 생성 완료"

echo ""
echo "✅ 웹 앱 빌드 완료!"
echo "   결과물: $ROOT_DIR/dist/web/"
echo "   실행  : ./scripts/web/run.sh"
echo "   배포  : ./scripts/web/release.sh"
