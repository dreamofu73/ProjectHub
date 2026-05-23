#!/usr/bin/env bash
# desktop-run.sh — 하위 호환 래퍼
# 실제 구현: scripts/desktop/run.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/desktop/run.sh" "$@"
