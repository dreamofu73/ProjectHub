#!/usr/bin/env bash
# web-release.sh — 하위 호환 래퍼
# 실제 구현: scripts/web/release.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/web/release.sh" "$@"
