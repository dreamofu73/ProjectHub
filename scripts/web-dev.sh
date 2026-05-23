#!/usr/bin/env bash
# web-dev.sh — 하위 호환 래퍼
# 실제 구현: scripts/web/dev.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/web/dev.sh" "$@"
