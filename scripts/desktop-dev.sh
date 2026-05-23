#!/usr/bin/env bash
# desktop-dev.sh — 하위 호환 래퍼
# 실제 구현: scripts/desktop/dev.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/desktop/dev.sh" "$@"
