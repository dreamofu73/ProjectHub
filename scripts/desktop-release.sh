#!/usr/bin/env bash
# desktop-release.sh — 하위 호환 래퍼
# 실제 구현: scripts/desktop/release.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/desktop/release.sh" "$@"
