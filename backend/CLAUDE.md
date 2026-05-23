# Backend 개발 표준 가드레일 (backend/CLAUDE.md)

이 문서는 **Rust Axum 백엔드** 소스 코드의 일관성과 데이터베이스 안정성, 단일 바이너리 배포 요구사항을 유지하기 위한 가이드라인입니다.

---

## 1. 데이터베이스 및 쿼리 작성 규칙

- **데이터베이스 엔진**: SQLite, MySQL, MariaDB, PostgreSQL 등 다중 데이터베이스를 지원하기 위해 `sqlx::AnyPool`을 사용합니다.
- **DBMS 판별**: `db::get_kind()`가 `database_url` 스킴으로 엔진을 구분합니다 (`postgres://`·`postgresql://`, `mysql://`, `mariadb://`, `sqlite://`). MariaDB는 `DbKind::MariaDb`로 판별되며 SQL 방언은 MySQL과 동일하게 번역됩니다. MariaDB 서버를 `mysql://` 로 연결해도 동작 차이는 없습니다.
- **쿼리 작성**: 모든 쿼리는 반드시 `sea_query::Query` 빌더를 사용하여 작성해야 합니다.
- **쿼리 실행**: 쿼리 실행은 `crate::db::fetch_all`, `crate::db::fetch_optional`, `crate::db::execute` 등을 사용하십시오.
- **날짜/시간**: SQL에서 `NOW()`를 사용하지 마십시오. 대신 Rust에서 `crate::db::now_string()`을 사용하십시오.
- **문자열 연결**: SQL에서 `||` 문자열 연결을 사용하지 마십시오. 대신 개별 컬럼을 조회하고 Rust에서 `crate::routes::utils::display_name()`을 사용하십시오.

---

## 2. 라우팅 및 자산 서빙 규칙

- **라우트 모듈 구조**: 라우트는 `backend/src/routes/` 디렉터리 내 도메인별 모듈로 분리되어 있습니다 (예: `auth.rs`, `posts.rs`, `chat.rs`, `issues.rs`). 새 라우트를 추가할 때는:
  1. `backend/src/routes/<name>.rs`에 핸들러와 `pub fn router() -> Router`를 정의하고,
  2. `backend/src/routes/mod.rs`의 `pub mod <name>;` 선언과 `api_router()`의 `.merge(<name>::router())`에 등록합니다.
  3. `main.rs`에서는 `Router::new().nest("/api", routes::api_router())` 형태로 마운트합니다.
- **API 경로 404 규칙**: 프런트엔드 SPA fallback이 정의되지 않은 경로 요청에 `index.html`을 서빙하지만, `/api` 또는 `/api/*` 경로로 들어온 요청 중 매칭되지 않는 것은 HTML을 반환하지 않고 반드시 **404 NotFound** 상태코드를 반환해야 합니다 (`main.rs`의 SPA fallback 핸들러 참조).

---

## 3. 실행 환경 및 경로 규칙

- **개발**: 루트의 `./scripts/web-dev.sh`로 실행합니다. 백엔드는 루트 디렉터리에서 `cargo run --manifest-path backend/Cargo.toml`로 기동되므로 `config.toml`과 `data/`가 루트에 있어야 합니다.
- **배포**: 루트의 `./scripts/web-build.sh`로 단일 바이너리를 생성하고 직접 `./scripts/web-run.sh`로 실행합니다.
- **데이터베이스 URL**: `config.toml`의 `database_url`이 우선 적용됩니다. 없을 경우 `main.rs`의 부트스트랩 로직이 `./data/` 존재 여부를 체크해 동적으로 결정합니다.
- **첨부파일 경로**: `config.toml`의 `upload_dir`(기본값 `./data/attachments`)을 단일 출처로 사용하십시오. 경로를 하드코딩하지 마십시오.

---

## 4. API 응답 포맷 일관성

- 모든 API 응답은 일관되게 JSON 형태로 반환되어야 합니다. 일반적으로 `Result<Json<Value>, String>` 구조 또는 HTTP 상태 코드(예: `Status::Created`)를 명시할 수 있는 형태로 구성됩니다.
- 프런트엔드에서 수신 및 파싱에 오류가 발생하지 않도록 성공 시 `{ "success": true, "data": ... }`, 실패 시 `{ "success": false, "error": "message" }` 패턴을 따르는 것이 좋습니다.

---

## 5. 인증 (JWT)

- 인증 토큰은 `auth.rs`의 `create_jwt()` / `verify_jwt()`를 통해 발급/검증되며, 클라이언트는 `Authorization: Bearer <token>` 헤더로 전달합니다.
- 보호된 라우트는 `AuthUser` extractor를 핸들러 인자로 받아 사용합니다. `AuthUser`는 `Claims`(sub=user_id, role, exp)를 풀어 사용자 컨텍스트를 제공합니다.
- 서명 키는 `config.toml`의 `jwt_secret`이며, **운영 환경에서는 반드시 강한 시크릿으로 교체**해야 합니다.

---

## 6. 로깅

- `tracing` + `file-rotate`로 `./logs/pms.log`에 회전 기록합니다. 회전 정책은 `config.toml`의 `log_max_size_mb`, `log_max_files`로 제어합니다.
- 로그 레벨은 `RUST_LOG` 환경변수로 조정합니다 (예: `RUST_LOG=info,backend=debug`).

---

## 7. Sonyflake ID 처리 규칙 ⚠️

> **이 규칙은 모든 API 핸들러에서 반드시 준수해야 합니다.**

프로젝트는 Sonyflake ID(63비트)를 사용하며, JavaScript Number 정밀도(`Number.MAX_SAFE_INTEGER` = 2^53 - 1)를 초과하므로 **프런트엔드와의 ID 교환은 반드시 문자열(string) 형식**으로 이루어져야 합니다.

### 7.1 Request 구조체 (JSON 바디)

모든 i64 ID 필드에는 반드시 `#[serde(deserialize_with = "...")]` 어노테이션을 적용합니다:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateIssueRequest {
    // 필수 ID: 문자열 또는 숫자 허용
    #[serde(deserialize_with = "crate::serde_utils::string_or_number")]
    pub project_id: i64,

    // 선택적 ID
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub assignee_id: Option<i64>,

    // 이중 nullable (미전달=None, null=Some(None), 값=Some(Some(id)))
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string_or_number")]
    pub assigned_to_id: Option<Option<i64>>,

    // 배열 ID
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}
```

**사용 가능한 역직렬화 함수** (`backend/src/serde_utils.rs`):
| 함수 | 대상 타입 | 수용 값 |
|------|----------|--------|
| `string_or_number` | `i64` | `"123"`, `123` |
| `optional_string_or_number` | `Option<i64>` | `null`, `""`, `"123"`, `123` |
| `nullable_string_or_number` | `Option<Option<i64>>` | `null`, `""`, `"123"`, `123` |
| `vec_string_or_number` | `Vec<i64>` | `["1", 2, "3"]` |
| `opt_vec_string_or_number` | `Option<Vec<i64>>` | `null`, `["1", 2]` |

### 7.2 Path 파라미터

모든 `Path<i64>` 추출기는 `Path<String>` + `parse_path_id()`로 변경합니다:

```rust
// ✅ 올바른 패턴
async fn handler(
    Path(id_str): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // id는 i64 타입으로 사용
}

// ✅ 튜플 패턴
async fn handler(
    Path((group_id_str, user_id_str)): Path<(String, String)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let group_id = crate::serde_utils::parse_path_id(&group_id_str)?;
    let user_id = crate::serde_utils::parse_path_id(&user_id_str)?;
}

// ❌ 잘못된 패턴 (문자열 ID 실패)
async fn handler(Path(id): Path<i64>) -> ... { }
```

### 7.3 API 응답 직렬화

모든 ID는 `.to_string()`으로 직렬화하여 응답합니다:

```rust
Ok(Json(json!({
    "success": true,
    "data": {
        "id": id.to_string(),
        "project_id": project_id.to_string(),
    }
})))
```

### 7.4 검증 체크리스트

새 API 엔드포인트 추가 시:
- [ ] Request 구조체 i64 ID 필드에 `#[serde(deserialize_with = "...")]` 적용
- [ ] Path 파라미터가 `Path<String>` + `parse_path_id()` 사용
- [ ] 응답에서 ID가 `.to_string()`으로 직렬화
- [ ] 프런트엔드 빌드 통과 여부 확인

---

## 8. 빌드 및 테스트 실행 제한 ⚠️

> **이 규칙은 최우선으로 준수해야 합니다.**

- **`scripts/web-build.sh` 실행 금지**: 사용자가 명시적으로 "빌드해줘", "배포해줘" 등을 요청하지 않는 한, AI 에이전트는 `./scripts/web-build.sh`를 **절대 자동으로 실행하지 않습니다**.
  - 코드 변경 후 확인은 이미 실행 중인 `./scripts/web-dev.sh` 개발 서버 또는 `cargo check` 수준의 문법 검사로 대체합니다.
- **E2E 테스트 실행 금지**: 사용자가 명시적으로 "E2E 테스트 실행", "테스트해줘" 등을 요청하지 않는 한, AI 에이전트는 E2E 테스트를 **자동으로 수행하지 않습니다**.
- **허용되는 검증 방법**:
  - Rust 문법·타입 체크: `cargo check --manifest-path backend/Cargo.toml`
  - 개발 서버를 통한 동작 확인: `./scripts/web-dev.sh` (이미 실행 중인 경우 재시작 불필요)
