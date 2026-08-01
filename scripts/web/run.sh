#!/usr/bin/env bash
# scripts/web/run.sh — 웹 앱 프로덕션 실행
#
# <root>/pms 바이너리를 포그라운드로 실행합니다.
#
# 사전 조건: scripts/web/build.sh 실행 후 <root>/pms 존재해야 함
#
# 사용법: ./scripts/web/run.sh
# 또는  : ./scripts/web-run.sh  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BINARY="$ROOT_DIR/dist/web/pms"

if [ ! -f "$BINARY" ]; then
  echo "❌ 오류: '$BINARY' 파일이 없습니다."
  echo "   먼저 ./scripts/web/build.sh 를 실행하여 빌드하세요."
  exit 1
fi

PORT=$(grep -E "^port\s*=" "$ROOT_DIR/config.toml" 2>/dev/null \
       | awk -F'=' '{print $2}' | tr -d '[:space:]' || echo "8000")

echo "╔══════════════════════════════════════╗"
echo "║       PMS Web  —  Run                ║"
echo "╚══════════════════════════════════════╝"
echo "  Binary : $BINARY"
echo "  URL    : http://localhost:${PORT}"
echo "  Ctrl+C : 서버 종료"
echo ""

cd "$ROOT_DIR"
RUST_LOG="${RUST_LOG:-info}" exec "$BINARY"
