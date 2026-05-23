#!/usr/bin/env bash
# scripts/desktop/run.sh — 데스크톱 앱 빌드 결과물 실행
#
# 플랫폼별로 빌드된 번들을 자동으로 찾아 실행합니다.
# 개발 모드(HMR 포함)는 scripts/desktop/dev.sh 를 사용하세요.
#
# 사전 조건: scripts/desktop/build.sh 실행 후 번들 생성 완료
#
# 사용법: ./scripts/desktop/run.sh
# 또는  : ./scripts/desktop-run.sh  (하위 호환 래퍼)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
BUNDLE_DIR="$ROOT_DIR/dist/desktop/bundle"
OS="$(uname -s)"

echo "╔══════════════════════════════════════╗"
echo "║    PMS Desktop (Tauri)  —  Run       ║"
echo "╚══════════════════════════════════════╝"

if [ ! -d "$BUNDLE_DIR" ]; then
  echo "❌ 오류: 빌드된 번들이 없습니다."
  echo "   먼저 ./scripts/desktop/build.sh 를 실행하여 빌드하세요."
  echo "   (결과물 경로: $BUNDLE_DIR)"
  exit 1
fi

case "$OS" in
  Darwin)
    APP_PATH=$(find "$BUNDLE_DIR/macos" -name "*.app" -maxdepth 1 2>/dev/null | head -n 1)
    if [ -z "$APP_PATH" ]; then
      echo "❌ .app 번들을 찾을 수 없습니다: $BUNDLE_DIR/macos/"
      exit 1
    fi
    echo "  App : $APP_PATH"
    echo "  (앱 창이 열립니다)"
    echo ""
    open "$APP_PATH"
    ;;

  Linux)
    APPIMAGE=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage" -maxdepth 1 2>/dev/null | head -n 1)
    if [ -n "$APPIMAGE" ]; then
      echo "  AppImage: $APPIMAGE"
      echo ""
      chmod +x "$APPIMAGE"
      exec "$APPIMAGE"
    else
      BIN="$ROOT_DIR/target/release/project-hub-desktop"
      if [ ! -f "$BIN" ]; then
        echo "❌ 실행 가능한 바이너리를 찾을 수 없습니다."
        exit 1
      fi
      echo "  Binary: $BIN"
      echo ""
      exec "$BIN"
    fi
    ;;

  MINGW*|CYGWIN*|MSYS*)
    EXE=$(find "$BUNDLE_DIR" -name "*.exe" -not -name "*setup*" -maxdepth 3 2>/dev/null | head -n 1)
    if [ -z "$EXE" ]; then
      echo "❌ .exe 파일을 찾을 수 없습니다."
      exit 1
    fi
    echo "  Exe: $EXE"
    echo ""
    start "" "$EXE"
    ;;

  *)
    echo "❌ 지원하지 않는 운영체제: $OS"
    exit 1
    ;;
esac
