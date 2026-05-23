#!/usr/bin/env bash
# scripts/web/dev.sh — 웹 앱 개발 서버 기동
#
# 백엔드(cargo run)와 웹 프런트엔드(vite dev)를 동시에 기동합니다.
# Ctrl+C 하나로 두 프로세스가 모두 종료됩니다.
#
# 사용법: ./scripts/web/dev.sh
# 또는  : ./scripts/web-dev.sh  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/apps/web"
RUST_BACKTRACE=1

cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM

echo "╔══════════════════════════════════════╗"
echo "║       PMS Web  —  Dev Mode           ║"
echo "╚══════════════════════════════════════╝"
echo "  Backend : http://localhost:8000  (cargo run)"
echo "  Frontend: http://localhost:5173  (vite dev)"
echo "  Proxy   : /api → localhost:8000"
echo "  Ctrl+C  : 두 프로세스 동시 종료"
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

# 프런트엔드 기동
cd "$ROOT_DIR"
npm run dev --workspace=apps/web &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
