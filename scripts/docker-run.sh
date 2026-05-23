#!/usr/bin/env bash
# scripts/docker-run.sh — Docker 컨테이너 실행 스크립트

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PORT="${1:-8000}"

echo "╔══════════════════════════════════════╗"
echo "║       PMS Web  —  Docker Run         ║"
echo "╚══════════════════════════════════════╝"

cd "$ROOT_DIR"

# 기존 컨테이너가 있다면 중지 및 삭제
if docker ps -a --format '{{.Names}}' | grep -Eq "^pms-web$"; then
    echo "기존 pms-web 컨테이너를 중지하고 삭제합니다..."
    docker stop pms-web >/dev/null
    docker rm pms-web >/dev/null
fi

echo "포트 ${PORT}에서 pms-web 컨테이너를 실행합니다..."
docker run -d \
  -p "${PORT}:80" \
  -v "$ROOT_DIR/data:/app/data" \
  -v "$ROOT_DIR/logs:/app/logs" \
  --name pms-web \
  pms-web:latest

echo "✅ Docker 컨테이너 실행 완료!"
echo "접속 주소: http://localhost:${PORT}"
