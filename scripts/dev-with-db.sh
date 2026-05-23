#!/usr/bin/env bash
# scripts/dev-with-db.sh — DB 컨테이너와 함께 백엔드 개발 서버를 구동하는 스크립트
#
# 빌드 결과물: <root>/target/      (scripts/web/build.sh 와 동일한 관례)
# 실행 로그:   <root>/logs/server.log
# 데이터·업로드 위치는 각 config 파일의 database_url / upload_dir 이 결정합니다.
# (백엔드 애플리케이션 로그는 별도로 <root>/logs/pms.log 에 회전 기록됩니다)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# cargo 산출물을 <root>/target/ 에 모읍니다.
export CARGO_TARGET_DIR="$ROOT_DIR/target"

# 스크립트 출력(빌드 로그 + 서버 stdout/stderr)을 <root>/logs/server.log 에 남깁니다.
# tee 를 쓰므로 터미널 출력은 그대로 유지됩니다. 실행마다 새로 씁니다.
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
exec > >(tee "$LOG_DIR/server.log") 2>&1

DB_TYPE="${1:-sqlite}"

echo "╔══════════════════════════════════════╗"
echo "║       PMS Web  —  Dev with DB        ║"
echo "╚══════════════════════════════════════╝"
echo "  Target DB: $DB_TYPE"
echo ""

cd "$ROOT_DIR"

# 1. DB 컨테이너 구동 (sqlite가 아닌 경우)
if [ "$DB_TYPE" = "postgres" ]; then
    echo "🚀 PostgreSQL 컨테이너를 시작합니다..."
    docker compose --profile postgres up -d postgres
    CONFIG_FILE="config.postgres.toml"
elif [ "$DB_TYPE" = "mysql" ]; then
    echo "🚀 MySQL 컨테이너를 시작합니다..."
    docker compose --profile mysql up -d mysql
    CONFIG_FILE="config.mysql.toml"
elif [ "$DB_TYPE" = "mariadb" ]; then
    echo "🚀 MariaDB 컨테이너를 시작합니다..."
    docker compose --profile mariadb up -d mariadb
    CONFIG_FILE="config.mariadb.toml"
elif [ "$DB_TYPE" = "sqlite" ]; then
    echo "🚀 SQLite를 사용합니다 (별도 컨테이너 없음)."
    CONFIG_FILE="config.sqlite.toml"
else
    echo "❌ 지원하지 않는 DB 타입입니다: $DB_TYPE"
    echo "   사용 가능: sqlite, postgres, mysql, mariadb"
    exit 1
fi

# 2. 설정 파일 확인
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 설정 파일을 찾을 수 없습니다: $CONFIG_FILE"
    exit 1
fi

echo "✅ 설정 파일: $CONFIG_FILE"

# 3. 백엔드 서버 구동
echo "🚀 백엔드 서버를 시작합니다..."
cargo run --manifest-path backend/Cargo.toml -- "$CONFIG_FILE"
