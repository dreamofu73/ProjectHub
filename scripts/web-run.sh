#!/usr/bin/env bash
# web-run.sh — 하위 호환 래퍼
# 실제 구현: scripts/web/run.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/web/run.sh" "$@"
