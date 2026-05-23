#!/usr/bin/env bash
# scripts/docker-build.sh — Docker 이미지 빌드 스크립트

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║       PMS Web  —  Docker Build       ║"
echo "╚══════════════════════════════════════╝"

cd "$ROOT_DIR"
docker build -t pms-web .

echo "✅ Docker 이미지 빌드 완료: pms-web:latest"
