#!/usr/bin/env bash
# desktop-build.sh — 하위 호환 래퍼
# 실제 구현: scripts/desktop/build.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/desktop/build.sh" "$@"
