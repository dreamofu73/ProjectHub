# SeaQuery 전환 진행 상황

원시 SQL 문자열 + 문자열 치환 번역기(`db::legacy::translate_sql`)를 SeaQuery 기반
쿼리 조립으로 옮기는 작업의 계획과 체크리스트입니다.

## 왜 하는가

`translate_sql` 은 PostgreSQL 방언 원문을 정규식/문자열 치환으로 다른 엔진에 맞춰
바꾸는 방식이라, 표현식이 조금만 복잡해져도 조용히 깨집니다. SeaQuery 는 AST 를
방언별로 직렬화하므로 플레이스홀더·식별자 인용·자료형이 자동으로 맞습니다.

실제로 이 방식 때문에 발생한 장애: `sqlx::QueryBuilder` 로 조립하던 `GET /api/projects`
가 PostgreSQL 에서 `?` 플레이스홀더를 생성해 5일간 500 을 반환했습니다(수정 완료).

## 1단계 — 기반 (완료)

- [x] `sea-query 1.0` 도입 (`thread-safe` 기능 활성화 — axum 핸들러의 `Send` 요구)
- [x] `backend/src/db.rs`(887줄) → `backend/src/db/` 모듈로 분해
  - `kind.rs` DBMS 판별 / `dialect.rs` 방언 직렬화·DDL 헬퍼 / `bind.rs` sqlx `Any` 바인딩 브리지
  - `schema.rs` 마이그레이션 / `seed.rs` 시딩 / `pool.rs` 커넥션 / `legacy.rs` 과도기 번역기
- [x] 스키마 전체(28개 테이블 + 인덱스)를 SeaQuery DDL 로 재작성
- [x] 누락 테이블 3종(`milestones`, `messages`, `activity_logs`) 및 `issues.milestone_id` 추가
- [x] `sqlx::QueryBuilder` 사용처 2곳 전환 (`projects::get_projects`, `attachments::batch_download`)
- [x] 회귀 테스트: `schema_test.rs`, `projects_list_test.rs`

### 채택하지 않은 것

`sea-query-binder` 는 sqlx 0.8 + 드라이버별 전용 풀만 지원합니다. 이 프로젝트는
sqlx 0.9 + `AnyPool` 이므로 `db/bind.rs` 에 바인딩 브리지를 직접 구현했습니다.

## 2단계 — 번역 계층 우회 제거 (최우선)

아래 12곳은 `crate::query!` 를 거치지 않고 `sqlx::query_scalar` 를 직접 호출해
**번역이 전혀 적용되지 않습니다**. `$1` 과 `::bigint` 를 쓰므로 MySQL·MariaDB 에서
확실히 깨집니다. 가장 먼저 처리합니다.

- [x] `routes/users.rs` — 4곳 (`get_user_activity`)
- [x] `routes/memos.rs` — 8곳 (건수 질의 7 + 트랜잭션 내 수신자 검증 1)

트랜잭션 등 풀이 아닌 executor 에서 실행해야 하는 경우를 위해
`db::to_query` / `db::to_query_scalar` 를 추가했습니다.

**결과: 번역 계층 우회 12곳 → 0곳.**

## 3단계 — 라우트별 전환

작은 파일부터 진행해 패턴을 굳힌 뒤 큰 파일로 넘어갑니다.
각 파일 완료 시 `cargo test --tests` 로 검증합니다.

| 파일 | 잔여 | 상태 |
|------|-----:|------|
| `routes/search.rs` | 0 | [x] `CAST(id AS TEXT)`(MySQL 무효) 제거 포함 |
| `routes/notifications.rs` | 0 | [x] |
| `routes/auth.rs` | 0 | [x] |
| `scheduler.rs` | 0 | [x] |
| `routes/admin_groups.rs` | 0 | [x] |
| `routes/utils.rs` | 0 | [x] 문자열→BIGINT 비교(PG 타입오류) 수정 포함 |
| `routes/users.rs` | 0 | [x] |
| `routes/attachments.rs` | 0 | [x] |
| `routes/post_comments.rs` | 0 | [x] `\|\|` 연결 제거 |
| `routes/issue_comments.rs` | 0 | [x] |
| `routes/milestones.rs` | 0 | [x] |
| `routes/user_groups.rs` | 0 | [x] |
| `routes/admin_organization.rs` | 0 | [x] |
| `routes/tasks.rs` | 0 | [x] |
| `routes/address_book.rs` | 0 | [x] |
| `routes/chat.rs` | 0 | [x] |
| `routes/posts.rs` | 0 | [x] |
| `routes/projects.rs` | 0 | [x] |
| `routes/dashboard.rs` | 0 | [x] |
| `routes/issues.rs` | 0 | [x] |
| `routes/wiki.rs` | 0 | [x] |
| `routes/groups.rs` | 0 | [x] |
| `routes/memos.rs` | 0 | [x] |

## 전환 중 발견한 방언 버그

전환은 기계적 작업이지만, 그 과정에서 아래 실제 결함들이 드러났습니다.

| 위치 | 문제 | 영향 엔진 | 상태 |
|------|------|-----------|------|
| `projects::get_projects`, `attachments::batch_download` | `sqlx::QueryBuilder` 가 항상 `?` 생성 | PostgreSQL | 수정 |
| `users`·`memos` 12곳 | 번역 계층 우회 (`$1`, `::bigint` 원문 전달) | MySQL·MariaDB | 수정 |
| `search::search` | `CAST(id AS TEXT)` | MySQL·MariaDB | 수정 |
| `utils` 프로젝트 조회 | 문자열을 BIGINT 컬럼과 비교 | PostgreSQL | 수정 |
| **21곳** (`chat`, `dashboard`, `issues`, `posts`, `tasks`, `wiki` 등) | **`\|\|` 문자열 연결** | **MySQL·MariaDB** | 수정 |
| `chat::add_chat_room_member`, `address_book` 멤버 추가 | 원시 SQL `$1` + `NOW()` + `ON CONFLICT` | SQLite·MySQL·MariaDB | 수정 |

## 전환 과정에서 새로 유입된 결함 (점검으로 발견·수정)

전환 자체가 만들어 낸 버그도 있었습니다. 전량 점검에서 잡아 고쳤습니다.

| 위치 | 문제 | 증상 |
|------|------|------|
| `posts.rs` 2곳 | `columns(["p.id", ...])` — 점 포함 문자열은 `"p.id"` 라는 **단일 식별자**로 인용됨 | 결과 컬럼명이 `id` 가 아닌 `p.id` → `ColumnNotFound("id")` 패닉 |
| `dashboard.rs` 4곳 | `columns([("a", "*")])` — `"*"` 문자열은 `"a"."*"` 로 인용됨 | 무효한 SQL. `unwrap_or_default()` 가 오류를 삼켜 **최근 활동·내 이슈가 조용히 빈 목록** |
| `projects::get_project_by_id` | `Func::count(x).count_distinct()` = `COUNT(DISTINCT COUNT(x))` **중첩 집계** | 전 엔진 500 |
| `projects::get_project_by_id`, `dashboard::projects_summary` | `GROUP BY p.id` + 조인 테이블의 `pm.role` 선택 | PostgreSQL 만 거부(함수 종속성은 같은 테이블 PK 에만 적용) |
| `tests/common/mod.rs` | `Extension(chat_tx)` — 핸들러는 `Arc<Sender>` 를 요구 | Extension 추출 실패로 채팅 전송 500 |

### 교훈

- 컬럼은 **반드시 `("테이블", "컬럼")` 튜플**로. 점이 포함된 문자열은 통째로 인용됩니다.
- 전체 컬럼은 **`Expr::col(("p", Asterisk))`**. `("p", "*")` 는 무효입니다.
- 집계는 `Expr::count_distinct()`. `Func::count(x).count_distinct()` 는 중첩 집계입니다.
- 집계 컬럼이 여러 테이블에 걸치면 `GROUP BY` 보다 **상관 서브쿼리**가 안전합니다.
- `unwrap_or_default()` 로 오류를 삼키는 핸들러는 상태코드 테스트로 검증되지 않습니다.
  → `dashboard_content_test.rs` 로 **응답 내용**을 검증합니다.

### `||` 문자열 연결 (가장 광범위했던 건, 해결 완료)

`(u.firstname \|\| ' ' \|\| u.lastname) as author_name` 형태가 **21곳**에 있었습니다.
MySQL·MariaDB 는 기본 설정(`PIPES_AS_CONCAT` 미설정)에서 `\|\|` 를 **논리 OR** 로
해석하므로, 이름 대신 `0`/`1` 이 반환됩니다. 즉 **MySQL 계열에서 작성자/담당자
표시 이름이 전부 깨져 있었습니다.**

`CONCAT` 은 SQLite 3.44 미만에서 없고 방언별 차이가 있어, `routes::utils::display_name()`
으로 **Rust 에서 조합**하도록 통일했습니다. 각 라우트는 `firstname`/`lastname`/`login`
컬럼을 그대로 조회한 뒤 이 헬퍼를 호출합니다. 전 파일 적용 완료(잔여 0곳).

## ⚠️ 테스트가 개발 DB 를 파괴하던 문제 (해결)

전환 검증 중 **개발용 PostgreSQL 데이터가 반복적으로 사라지는** 사고가 있었습니다.

`tests/postgres_sql_test.rs` 와 `tests/mysql_sql_test.rs` 는 스크래치 DB 가 아니라
**개발 DB(`pms_db`)에 직접 접속**한 뒤, "초기화"라는 이름으로 애플리케이션 테이블
25개를 `DROP TABLE ... CASCADE` 로 지우고 있었습니다. 두 테스트가 실제로 쓰는 것은
`test_users` 임시 테이블 하나뿐이라 이 삭제는 처음부터 불필요했습니다.

증상 판별에 쓴 근거:

```sql
-- 살아남은 3개(OID 3.4만)와 매번 재생성된 25개(OID 25만)가 명확히 갈립니다.
SELECT oid, relname FROM pg_class
WHERE relkind='r' AND relnamespace='public'::regnamespace ORDER BY oid;
```

삭제 목록이 `milestones`/`messages`/`activity_logs` 추가 **이전**에 작성된 것이라
그 3개만 살아남았고, 서버 기동 로그에도 그 3개에 대해서만
`relation "..." already exists, skipping` 이 남았습니다.

**조치**: 두 테스트에서 애플리케이션 테이블 삭제 루프를 제거하고 `test_users` 만
정리하도록 변경했습니다.

### 스크래치 DB 누수 (해결)

`common::setup_db()` 는 서버형 DB 에서 테스트마다 `pms_test_<uuid>` 를 만들지만
삭제하지 않아 **508개**까지 누적됐습니다. 테스트는 연결된 채로 끝나 자기 DB 를
스스로 지울 수 없으므로, **다음 실행이 이전 흔적을 정리**하도록 했습니다
(`prune_scratch_databases`). 사용 중인 DB 는 DROP 이 실패해 그대로 남고,
`pms_test_%` 패턴만 대상이라 애플리케이션 DB 는 건드리지 않습니다.

> PostgreSQL 의 `datname` 은 `name` 타입이라 sqlx `Any` 가 `String` 으로 디코딩하지
> 못합니다. 목록 조회 시 반드시 `datname::text` 로 캐스팅해야 합니다.

## 검증 결과

`crate::query!` 계열 잔여 호출 **0곳**, 번역 계층 우회 원시 SQL **0곳**,
SQL `||` 연결 **0곳**, 라우트 내 `NOW()`·`::bigint`·`CAST(.. AS TEXT)` **0곳**.

| 항목 | SQLite | PostgreSQL |
|------|--------|------------|
| `cargo check --all-targets` | 통과 (경고 0) | — |
| 유닛 테스트 | 12/12 | 12/12 |
| 통합 테스트 실패 | 3건 | 4건 |

남은 실패는 **DB 계층과 무관한 기존 문제**입니다.

| 테스트 | 증상 | 성격 |
|--------|------|------|
| `test_batch_add_members` | 400 | 요청 본문 형식 불일치 |
| `test_memo_scenarios` | 400 | 요청 본문 형식 불일치 |
| `test_non_member_access` | 200 (403 기대) | 테스트 주석부터 "Assuming ..." — 구현과 기대가 어긋남 |
| `test_admin_logs_level` | PG 실행에서만 400 | 전역 tracing subscriber 공유로 인한 실행 순서 의존(플래키) |

## 4단계 — 마무리

- [x] `db/legacy.rs` 및 `query!`/`query_as!`/`query_with!`/`query_scalar_with!` 매크로 삭제
      (테스트 코드에서도 `translate_sql` 의존성 제거 및 `*_sql_test.rs` 삭제 완료)
- [x] `backend/CLAUDE.md` 의 쿼리 작성 규칙을 SeaQuery 기준으로 갱신
- [x] 위 표의 기존 실패 4건 정리

## 전환 패턴

### 조회

```rust
use sea_query::{Expr, ExprTrait, Query as SeaQuery};

// 주의: axum 의 Query extractor 와 이름이 겹치므로 SeaQuery 로 별칭 처리합니다.
let stmt = SeaQuery::select()
    .columns(["id", "login"])
    .from("users")
    .and_where(Expr::col("is_active").eq(1))
    .to_owned();

let rows = crate::db::fetch_all(&pool, &stmt).await?;          // Vec<AnyRow>
let users = crate::db::fetch_all_as::<User, _>(&pool, &stmt).await?;
let count: i64 = crate::db::fetch_scalar(&pool, &stmt).await?;
```

### 삽입 / 갱신

```rust
let stmt = SeaQuery::insert()
    .into_table("memos")
    .columns(["id", "title", "created_at"])
    .values_panic([id.into(), title.into(), crate::db::now_string().into()])
    .to_owned();
crate::db::execute(&pool, &stmt).await?;
```

### 주의사항

- **`NOW()` 금지**: 엔진마다 다르고 스키마상 시각 컬럼이 TEXT 이므로
  `crate::db::now_string()` 으로 애플리케이션에서 생성합니다.
- **`COUNT(*)::bigint` 금지**: `Func::count(Expr::col("id"))` 를 씁니다.
- **`Expr::cust_with_values` 의 마커는 `$1`** 입니다(`?` 아님). SeaQuery 가 엔진별
  플레이스홀더로 치환합니다.
- **`ExprTrait` 임포트 시 `.max()` 충돌**: 블랭킷 impl 이 `Ord::max` 와 겹치므로
  `clamp` 등으로 대체합니다.
- **`||` 문자열 연결 금지**: MySQL 은 기본 설정에서 `||` 를 논리 OR 로 해석합니다.
  `Func::cust("CONCAT")` 대신 조회 후 Rust 쪽에서 조합하는 편이 안전합니다.
