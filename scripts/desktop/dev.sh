#!/usr/bin/env bash
# scripts/desktop/dev.sh — 데스크톱 앱 개발 서버 기동
#
# 백엔드(cargo run) + Tauri(tauri dev)를 동시에 기동합니다.
# Ctrl+C 하나로 두 프로세스가 모두 종료됩니다.
#
# 사전 요구 사항:
#   - Rust, cargo-tauri CLI 설치 필요
#   - macOS: Xcode Command Line Tools
#   - Linux: libwebkit2gtk-4.0-dev, libssl-dev 등
#
# 사용법: ./scripts/desktop/dev.sh
# 또는  : ./scripts/desktop-dev.sh  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
FRONTEND_DIR="$ROOT_DIR/apps/web"
RUST_BACKTRACE=1

cleanup() {
  echo ""
  echo "Shutting down desktop dev servers..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$TAURI_PID"   2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$TAURI_PID"   2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM

echo "╔══════════════════════════════════════╗"
echo "║    PMS Desktop (Tauri)  —  Dev       ║"
echo "╚══════════════════════════════════════╝"
echo "  Backend: http://localhost:8000  (cargo run)"
echo "  Desktop: Tauri native window    (tauri dev)"
echo "  Ctrl+C : 모든 프로세스 동시 종료"
echo ""

# RustEmbed 컴파일 에러 방지용 dummy dist/index.html 생성
if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
  echo "[준비] dummy apps/web/dist/index.html 생성..."
  mkdir -p "$FRONTEND_DIR/dist"
  echo "Dummy" > "$FRONTEND_DIR/dist/index.html"
fi

# 백엔드 기동
cd "$ROOT_DIR"
RUST_LOG=info CARGO_TARGET_DIR="$ROOT_DIR/target" \
  cargo run --manifest-path "$BACKEND_DIR/Cargo.toml" &
BACKEND_PID=$!

# 백엔드 준비 대기
echo "Waiting for backend to start..."
sleep 3

# Tauri 데스크톱 앱 기동
cd "$DESKTOP_DIR"
CARGO_TARGET_DIR="$ROOT_DIR/target" npm run tauri -- dev &
TAURI_PID=$!

wait "$BACKEND_PID" "$TAURI_PID"
