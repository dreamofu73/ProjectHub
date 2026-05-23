# MariaDB 지원 추가 (walkthrough)

## 배경

백엔드는 `sqlx::AnyPool` 기반으로 SQLite / MySQL / PostgreSQL을 지원하고 있었습니다.
sqlx의 MySQL 드라이버는 `URL_SCHEMES = ["mysql", "mariadb"]` 로 이미 `mariadb://` 접속을 허용하지만,
`db::get_kind()` 는 `postgres` → `mysql` → (그 외 전부) `Sqlite` 순으로 판별했기 때문에
`mariadb://` URL이 **SQLite로 오분류**되어 다음과 같이 전면적으로 깨지는 상태였습니다.

- DDL이 SQLite 방언(`INTEGER PRIMARY KEY AUTOINCREMENT`)으로 생성됨
- `NOW()` → `datetime('now')` 로 치환되어 MariaDB에서 문법 오류
- `last_inserted_id()` 가 `SELECT last_insert_rowid()` 를 호출해 실패

## 변경 사항

### 1. `backend/src/db.rs`

- `DbKind` 에 `MariaDb` 변형 추가, `#[derive(Debug, Clone, Copy, PartialEq, Eq)]` 부여
- URL 판별 로직을 `kind_from_url(url: &str) -> DbKind` 로 분리(풀 없이 테스트 가능) 후 `get_kind()` 가 위임
  - 판별 순서: `postgres`/`postgresql` → `mariadb` → `mysql` → `sqlite`(fallback)
  - `mariadb` 를 `mysql` 보다 먼저 검사해야 정상 동작합니다
- SQL 번역·`last_inserted_id()`·`transform_on_conflict_update()` 의 match 를 `DbKind::MySql | DbKind::MariaDb` 로 통합
  → MariaDB는 MySQL과 동일한 방언(`BIGINT AUTO_INCREMENT`, `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, `LAST_INSERT_ID()`)을 사용
- `#[cfg(test)] mod tests` 추가: 스킴 판별 4종, MariaDB↔MySQL 번역 동등성, MySQL 방언 적용 검증

### 2. 설정 · 인프라

| 파일 | 변경 |
|------|------|
| `config.mariadb.toml` | 신규. `database_url = "mariadb://pms_user:pms_password@localhost:3307/pms_db"` |
| `docker-compose.yml` | `mariadb:11` 서비스 + `mariadb` 프로필 + `mariadb_data` 볼륨. MySQL(3306)과 충돌하지 않도록 호스트 포트 **3307** 사용 |
| `scripts/dev-with-db.sh` | `mariadb` 분기 추가, 사용 가능 목록 메시지 갱신 |

### 3. 문서 · 테스트

- `README.md`: Tech Stack의 Database 항목 갱신 + "🗄️ 데이터베이스 (DBMS)" 섹션 신설(엔진별 URL·설정 파일·compose 프로필 표)
- `backend/CLAUDE.md`: 지원 엔진 목록에 MariaDB 추가, `get_kind()` 스킴 판별 규칙 명시
- `backend/tests/mariadb_sql_test.rs`: 신규. 스킴 판별 / 번역 / (서버가 있을 때) 실제 DDL·INSERT·`last_inserted_id`·SELECT 실행 검증

## 검증 결과

```
cargo check --manifest-path backend/Cargo.toml --all-targets            # 통과
cargo test  --manifest-path backend/Cargo.toml --lib                    # 4 passed
cargo test  --manifest-path backend/Cargo.toml --test mariadb_sql_test  # 3 passed
bash -n scripts/dev-with-db.sh                                          # 문법 OK
docker compose --profile mariadb config --services                      # mariadb
```

> `test_mariadb_query_execution` 은 로컬에 MariaDB 서버가 없으면 연결 실패 시점에 조기 반환(스킵)합니다.
> 실제 쿼리까지 검증하려면 컨테이너를 먼저 기동하십시오.

```bash
docker compose --profile mariadb up -d mariadb
MARIADB_DATABASE_URL="mariadb://pms_user:pms_password@localhost:3307/pms_db" \
  cargo test --manifest-path backend/Cargo.toml --test mariadb_sql_test -- --nocapture
```

## 사용법

```bash
./scripts/dev-with-db.sh mariadb
```

또는 `config.toml` 의 `database_url` 을 `mariadb://...` 로 바꾸거나, `DATABASE_URL` 환경변수로 덮어씁니다.

## 남은 고려사항

- MariaDB 서버를 `mysql://` 스킴으로 연결해도 방언이 같으므로 동작에는 차이가 없습니다. 스킴 구분은 진단·가독성 목적입니다.
- 버전 기반 세부 분기(예: 구버전 MariaDB의 `ON DUPLICATE KEY UPDATE` 제약)는 현재 필요하지 않아 도입하지 않았습니다.
  필요해지면 `DbKind::MariaDb` arm이 이미 분리되어 있어 해당 부분만 갈라내면 됩니다.
