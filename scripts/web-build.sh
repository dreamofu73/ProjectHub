#!/usr/bin/env bash
# web-build.sh — 하위 호환 래퍼
# 실제 구현: scripts/web/build.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/web/build.sh" "$@"
