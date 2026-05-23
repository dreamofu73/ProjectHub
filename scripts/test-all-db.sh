#!/usr/bin/env bash
# scripts/test-all-db.sh — 백엔드 전체 테스트를 지원 DBMS별로 반복 실행하는 스크립트
#
# 사용법:
#   ./scripts/test-all-db.sh                 # sqlite postgres mariadb 순으로 전부 실행
#   ./scripts/test-all-db.sh postgres        # 특정 엔진만 실행
#
# 서버형 DB는 테스트마다 pms_test_<uuid> 스크래치 데이터베이스를 만들어 격리합니다.
# 스크래치 DB 생성 권한이 필요하므로 MySQL/MariaDB는 root 계정을 사용합니다.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
    TARGETS=(sqlite postgres mariadb)
fi

PG_URL="${PG_TEST_URL:-postgres://pms_user:pms_password@localhost:5432/pms_db}"
MARIA_URL="${MARIA_TEST_URL:-mariadb://root:root_password@localhost:3307/pms_db}"
MYSQL_URL="${MYSQL_TEST_URL:-mysql://root:root_password@localhost:3306/pms_db}"

# 이전 실행에서 남은 스크래치 DB 정리
cleanup_scratch() {
    case "$1" in
        postgres)
            docker exec pms-postgres psql -U pms_user -d pms_db -tAc \
                "SELECT datname FROM pg_database WHERE datname LIKE 'pms_test_%'" 2>/dev/null \
            | while read -r db; do
                [ -n "$db" ] && docker exec pms-postgres psql -U pms_user -d pms_db \
                    -c "DROP DATABASE IF EXISTS \"$db\"" >/dev/null 2>&1
            done
            ;;
        mariadb)
            docker exec pms-mariadb mariadb -uroot -proot_password -N -B -e \
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'pms_test_%'" 2>/dev/null \
            | while read -r db; do
                [ -n "$db" ] && docker exec pms-mariadb mariadb -uroot -proot_password \
                    -e "DROP DATABASE IF EXISTS \`$db\`" >/dev/null 2>&1
            done
            ;;
        mysql)
            docker exec pms-mysql mysql -uroot -proot_password -N -B -e \
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'pms_test_%'" 2>/dev/null \
            | while read -r db; do
                [ -n "$db" ] && docker exec pms-mysql mysql -uroot -proot_password \
                    -e "DROP DATABASE IF EXISTS \`$db\`" >/dev/null 2>&1
            done
            ;;
    esac
}

FAILED=()

for target in "${TARGETS[@]}"; do
    case "$target" in
        sqlite)   URL="sqlite::memory:" ;;
        postgres) URL="$PG_URL" ;;
        mariadb)  URL="$MARIA_URL" ;;
        mysql)    URL="$MYSQL_URL" ;;
        *)
            echo "❌ 지원하지 않는 대상입니다: $target (사용 가능: sqlite, postgres, mysql, mariadb)"
            exit 1
            ;;
    esac

    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    printf "║  백엔드 전체 테스트 — %-30s ║\n" "$target"
    echo "╚══════════════════════════════════════════════════════╝"
    echo "  TEST_DATABASE_URL=$URL"

    cleanup_scratch "$target"

    if TEST_DATABASE_URL="$URL" cargo test --manifest-path backend/Cargo.toml --tests --no-fail-fast -- --test-threads=1; then
        echo "✅ $target 통과"
    else
        echo "❌ $target 실패"
        FAILED+=("$target")
    fi

    cleanup_scratch "$target"
done

echo ""
if [ ${#FAILED[@]} -eq 0 ]; then
    echo "🎉 모든 대상 통과: ${TARGETS[*]}"
    exit 0
fi

echo "💥 실패한 대상: ${FAILED[*]}"
exit 1
