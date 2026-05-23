#![allow(dead_code)]

use std::sync::Arc;
use axum::{extract::Extension, Router};
use sqlx::{AnyPool, any::AnyPoolOptions};

use sea_query::Query;
use tokio::sync::broadcast;
use serde_json::{json, Value};

/// 테스트용 JWT 시크릿.
pub const TEST_JWT_SECRET: &str = "test-secret-key-for-integration-tests-32bytes!";

/// 테스트용 앱 설정 생성.
pub fn test_config() -> backend::models::AppConfig {
    backend::models::AppConfig {
        port: 0,
        allowed_extensions: vec![
            "png".into(), "jpg".into(), "jpeg".into(), "gif".into(),
            "pdf".into(), "zip".into(), "txt".into(), "docx".into(),
            "xlsx".into(), "bin".into(),
        ],
        jwt_secret: TEST_JWT_SECRET.to_string(),
        database_url: "sqlite::memory:".to_string(),
        upload_dir: std::env::temp_dir()
            .join("pms_test_uploads")
            .to_string_lossy()
            .to_string(),
        admin_username: Some("admin".to_string()),
        admin_password: Some("admin1234".to_string()),
        log_max_size_mb: 10,
        log_max_files: 5,
        log_retention_days: 30,
    }
}

/// 테스트 대상 DB URL. `TEST_DATABASE_URL` 이 없으면 SQLite 인메모리를 사용합니다.
///
/// 예) `TEST_DATABASE_URL="postgres://pms_user:pms_password@localhost:5432/pms_db"`
///     `TEST_DATABASE_URL="mariadb://root:root_password@localhost:3307/pms_db"`
fn test_database_url() -> String {
    std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "sqlite::memory:".to_string())
}


/// 현재 시각을 RFC3339 문자열로 반환합니다. 모든 엔진에서 TEXT 컬럼에 그대로 바인딩됩니다.
fn now_text() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// 서버형 DB(Postgres/MySQL/MariaDB)에서 테스트마다 독립된 스크래치 데이터베이스를 생성하고
/// 해당 DB를 가리키는 URL을 반환합니다. 테스트가 병렬로 실행되어도 서로 간섭하지 않습니다.
///
/// 데이터베이스 생성 권한이 필요하므로 MySQL/MariaDB는 `root` 계정 URL을 사용하십시오.
/// 생성된 `pms_test_*` DB는 자동 삭제되지 않으며 `scripts/test-all-db.sh` 가 정리합니다.
/// 이전 실행에서 남은 `pms_test_*` 스크래치 데이터베이스를 정리합니다.
///
/// 다른 테스트 프로세스가 사용 중인 DB 는 DROP 이 실패하므로 그대로 남습니다(오류 무시).
async fn prune_scratch_databases(admin: &AnyPool) {
    // PostgreSQL 의 `datname` 은 `name` 타입이라 sqlx Any 가 String 으로 디코딩하지
    // 못합니다. 반드시 `::text` 로 캐스팅해야 합니다.
    let names: Vec<String> = sqlx::query_scalar(
        "SELECT datname::text FROM pg_database WHERE datname LIKE 'pms_test_%'",
    )
    .fetch_all(admin)
    .await
    .unwrap_or_default();

    // MySQL·MariaDB 는 데이터베이스 목록을 information_schema 에서 조회합니다.
    let names = if names.is_empty() {
        sqlx::query_scalar(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'pms\\_test\\_%'",
        )
        .fetch_all(admin)
        .await
        .unwrap_or_default()
    } else {
        names
    };

    for name in names {
        let _ = sqlx::query(sqlx::AssertSqlSafe(format!("DROP DATABASE IF EXISTS {name}")))
            .execute(admin)
            .await;
    }
}

async fn create_scratch_database(base_url: &str) -> String {
    let admin = AnyPoolOptions::new()
        .max_connections(1)
        .connect(base_url)
        .await
        .unwrap_or_else(|e| panic!("테스트 DB 서버에 연결할 수 없습니다 ({base_url}): {e}"));

    // 이전 실행에서 남은 스크래치 DB 정리.
    //
    // 테스트는 연결된 채로 끝나므로 자기 DB 를 스스로 지울 수 없습니다. 대신 다음 실행이
    // 앞선 흔적을 치웁니다. 사용 중인 DB 는 DROP 이 실패하므로 그대로 남고(오류 무시),
    // `pms_test_%` 패턴만 대상으로 하므로 애플리케이션 DB 는 건드리지 않습니다.
    prune_scratch_databases(&admin).await;

    let name = format!("pms_test_{}", uuid::Uuid::new_v4().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
        .execute(&admin)
        .await
        .unwrap_or_else(|e| panic!("스크래치 데이터베이스 생성 실패 ({name}): {e}"));
    admin.close().await;

    // URL의 마지막 경로 세그먼트(데이터베이스 이름)를 교체
    let (prefix, _) = base_url
        .rsplit_once('/')
        .unwrap_or_else(|| panic!("TEST_DATABASE_URL 에 데이터베이스 경로가 없습니다: {base_url}"));
    format!("{prefix}/{name}")
}

/// 테스트용 DB 풀 생성 + 마이그레이션 실행.
///
/// `last_inserted_id()` 가 세션 스코프 함수(`lastval()`, `LAST_INSERT_ID()`)를 사용하므로
/// 커넥션은 반드시 1개로 고정합니다.
pub async fn setup_db() -> AnyPool {
    sqlx::any::install_default_drivers();

    let base = test_database_url();
    let url = match backend::db::kind_from_url(&base) {
        backend::db::DbKind::Sqlite => base,
        _ => create_scratch_database(&base).await,
    };

    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .unwrap_or_else(|e| panic!("테스트 DB 풀 생성 실패 ({url}): {e}"));

    backend::db::run_migrations(&pool).await;
    pool
}

/// 테스트용 관리자 사용자 생성 후 (id, token) 반환.
pub async fn create_admin(pool: &AnyPool) -> (i64, String) {
    let hash = backend::auth::hash_password("admin1234").expect("hash failed");
    let uuid = uuid::Uuid::new_v4().to_string();
    let now = now_text();
    let stmt = Query::insert()
        .into_table(sea_query::Alias::new("users"))
        .columns([
            sea_query::Alias::new("uuid"),
            sea_query::Alias::new("login"),
            sea_query::Alias::new("email"),
            sea_query::Alias::new("password_hash"),
            sea_query::Alias::new("firstname"),
            sea_query::Alias::new("lastname"),
            sea_query::Alias::new("role"),
            sea_query::Alias::new("organization_id"),
            sea_query::Alias::new("is_active"),
            sea_query::Alias::new("created_at"),
            sea_query::Alias::new("updated_at"),
        ])
        .values_panic([
            uuid.into(),
            "admin".into(),
            "admin@test.com".into(),
            hash.into(),
            "Admin".into(),
            "User".into(),
            "admin".into(),
            1.into(),
            1.into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    backend::db::execute(pool, &stmt).await.expect("insert admin");

    let id = backend::db::last_inserted_id(pool).await;
    let token = backend::auth::create_jwt(id, "admin", TEST_JWT_SECRET)
        .expect("jwt failed");
    (id, token)
}

/// 테스트용 일반 사용자 생성 후 (id, token) 반환.
pub async fn create_user(pool: &AnyPool, login: &str, role: &str) -> (i64, String) {
    let hash = backend::auth::hash_password("password123").expect("hash failed");
    let uuid = uuid::Uuid::new_v4().to_string();
    let now = now_text();
    let stmt = Query::insert()
        .into_table(sea_query::Alias::new("users"))
        .columns([
            sea_query::Alias::new("uuid"),
            sea_query::Alias::new("login"),
            sea_query::Alias::new("email"),
            sea_query::Alias::new("password_hash"),
            sea_query::Alias::new("firstname"),
            sea_query::Alias::new("lastname"),
            sea_query::Alias::new("role"),
            sea_query::Alias::new("organization_id"),
            sea_query::Alias::new("is_active"),
            sea_query::Alias::new("created_at"),
            sea_query::Alias::new("updated_at"),
        ])
        .values_panic([
            uuid.into(),
            login.into(),
            format!("{}@test.com", login).into(),
            hash.into(),
            login.into(),
            "User".into(),
            role.into(),
            1.into(),
            1.into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    backend::db::execute(pool, &stmt).await.expect("insert user");

    let id = backend::db::last_inserted_id(pool).await;
    let token = backend::auth::create_jwt(id, role, TEST_JWT_SECRET)
        .expect("jwt failed");
    (id, token)
}

/// 테스트용 프로젝트 생성 후 id 반환.
pub async fn create_project(pool: &AnyPool, name: &str, identifier: &str) -> i64 {
    let now = now_text();
    let stmt = Query::insert()
        .into_table(sea_query::Alias::new("projects"))
        .columns([
            sea_query::Alias::new("name"),
            sea_query::Alias::new("identifier"),
            sea_query::Alias::new("description"),
            sea_query::Alias::new("homepage"),
            sea_query::Alias::new("status"),
            sea_query::Alias::new("is_public"),
            sea_query::Alias::new("created_at"),
            sea_query::Alias::new("updated_at"),
            sea_query::Alias::new("task_types"),
            sea_query::Alias::new("issue_types"),
            sea_query::Alias::new("statuses"),
            sea_query::Alias::new("task_categories"),
            sea_query::Alias::new("task_statuses"),
        ])
        .values_panic([
            name.into(),
            identifier.into(),
            "".into(),
            "".into(),
            "active".into(),
            1.into(),
            now.clone().into(),
            now.into(),
            "[]".into(),
            "[]".into(),
            "[]".into(),
            "[]".into(),
            "[]".into(),
        ])
        .to_owned();

    backend::db::execute(pool, &stmt).await.expect("insert project");

    backend::db::last_inserted_id(pool).await
}

/// 테스트용 프로젝트 멤버 추가.
pub async fn add_project_member(pool: &AnyPool, project_id: i64, user_id: i64, role: &str) {
    let stmt = Query::insert()
        .into_table(sea_query::Alias::new("project_members"))
        .columns([
            sea_query::Alias::new("project_id"),
            sea_query::Alias::new("user_id"),
            sea_query::Alias::new("role"),
            sea_query::Alias::new("created_at"),
        ])
        .values_panic([
            project_id.into(),
            user_id.into(),
            role.into(),
            now_text().into(),
        ])
        .to_owned();

    backend::db::execute(pool, &stmt).await.expect("insert project member");
}

/// 테스트용 이슈 생성 후 id 반환.
pub async fn create_issue(pool: &AnyPool, project_id: i64, subject: &str) -> i64 {
    let now = now_text();
    let stmt = Query::insert()
        .into_table(sea_query::Alias::new("issues"))
        .columns([
            sea_query::Alias::new("project_id"),
            sea_query::Alias::new("subject"),
            sea_query::Alias::new("tracker"),
            sea_query::Alias::new("status"),
            sea_query::Alias::new("priority"),
            sea_query::Alias::new("description"),
            sea_query::Alias::new("author_id"),
            sea_query::Alias::new("created_at"),
            sea_query::Alias::new("updated_at"),
        ])
        .values_panic([
            project_id.into(),
            subject.into(),
            "bug".into(),
            "new".into(),
            "normal".into(),
            "".into(),
            1.into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    backend::db::execute(pool, &stmt).await.expect("insert issue");

    backend::db::last_inserted_id(pool).await
}

/// 테스트용 태스크 생성 후 id 반환.
pub async fn create_task(pool: &AnyPool, project_id: i64, title: &str) -> i64 {
    let now = now_text();
    let stmt = Query::insert()
        .into_table(sea_query::Alias::new("tasks"))
        .columns([
            sea_query::Alias::new("project_id"),
            sea_query::Alias::new("title"),
            sea_query::Alias::new("description"),
            sea_query::Alias::new("task_type"),
            sea_query::Alias::new("task_category"),
            sea_query::Alias::new("status"),
            sea_query::Alias::new("progress"),
            sea_query::Alias::new("author_id"),
            sea_query::Alias::new("created_at"),
            sea_query::Alias::new("updated_at"),
        ])
        .values_panic([
            project_id.into(),
            title.into(),
            "".into(),
            "general".into(),
            "general".into(),
            "new".into(),
            0.into(),
            1.into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    backend::db::execute(pool, &stmt).await.expect("insert task");

    backend::db::last_inserted_id(pool).await
}

/// 테스트용 게시글 생성 후 id 반환.
pub async fn create_post(pool: &AnyPool, project_id: Option<i64>, title: &str, author_id: i64) -> i64 {
    let now = now_text();
    let stmt = Query::insert()
        .into_table(sea_query::Alias::new("posts"))
        .columns([
            sea_query::Alias::new("project_id"),
            sea_query::Alias::new("title"),
            sea_query::Alias::new("content"),
            sea_query::Alias::new("category"),
            sea_query::Alias::new("author_id"),
            sea_query::Alias::new("created_at"),
            sea_query::Alias::new("updated_at"),
        ])
        .values_panic([
            project_id.into(),
            title.into(),
            "test content".into(),
            "general".into(),
            author_id.into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    backend::db::execute(pool, &stmt).await.expect("insert post");

    backend::db::last_inserted_id(pool).await
}

/// 테스트 앱 라우터 빌드 (모든 Extension 포함).
pub fn build_test_router(pool: AnyPool) -> Router {
    let config = test_config();
    let jwt_secret = Arc::new(config.jwt_secret.clone());
    let app_config = Arc::new(config);
    let (chat_tx, _) = broadcast::channel::<String>(256);

    let scheduler_handle = backend::scheduler::start(pool.clone());

    let log_level_control = {
        use tracing_subscriber::{Registry, EnvFilter, prelude::*};
        use tracing_subscriber::reload;
        let env_filter = EnvFilter::from_default_env()
            .add_directive(tracing::Level::INFO.into());
        let (filter_layer, _handle) = reload::Layer::new(env_filter);
        let subscriber = Registry::default().with(filter_layer);
        let _ = tracing::subscriber::set_global_default(subscriber);
        backend::log_level::LogLevelControl::new(_handle)
    };

    Router::new()
        .nest("/api", backend::routes::api_router())
        .layer(Extension(Arc::new(pool)))
        .layer(Extension(jwt_secret))
        .layer(Extension(app_config))
        .layer(Extension(Arc::new(scheduler_handle)))
        // 핸들러는 `Extension<Arc<broadcast::Sender<String>>>` 를 요구합니다.
        // Arc 로 감싸지 않으면 추출에 실패해 500 이 반환됩니다 (main.rs 와 동일하게 맞춥니다).
        .layer(Extension(Arc::new(chat_tx)))
        .layer(Extension(Arc::new(log_level_control)))
}

/// 테스트용 auth 헤더 생성.
pub fn auth_header(token: &str) -> (axum::http::header::HeaderName, axum::http::header::HeaderValue) {
    (
        axum::http::header::AUTHORIZATION,
        axum::http::header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
    )
}

/// HTTP 요청 헬퍼: 지정된 경로로 GET 요청 전송.
pub async fn get(router: Router, path: &str, token: Option<&str>) -> axum::response::Response {
    use tower::ServiceExt;

    let mut req = axum::http::Request::builder()
        .uri(path)
        .body(axum::body::Body::empty())
        .unwrap();

    if let Some(t) = token {
        let (name, val) = auth_header(t);
        req.headers_mut().append(name, val);
    }

    router.oneshot(req).await.unwrap()
}

/// HTTP 요청 헬퍼: POST JSON.
pub async fn post_json(router: Router, path: &str, body: Value, token: Option<&str>) -> axum::response::Response {
    use tower::ServiceExt;

    let mut req = axum::http::Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    if let Some(t) = token {
        let (name, val) = auth_header(t);
        req.headers_mut().append(name, val);
    }

    router.oneshot(req).await.unwrap()
}

/// HTTP 요청 헬퍼: PUT JSON.
pub async fn put_json(router: Router, path: &str, body: Value, token: Option<&str>) -> axum::response::Response {
    use tower::ServiceExt;

    let mut req = axum::http::Request::builder()
        .method("PUT")
        .uri(path)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    if let Some(t) = token {
        let (name, val) = auth_header(t);
        req.headers_mut().append(name, val);
    }

    router.oneshot(req).await.unwrap()
}

/// HTTP 요청 헬퍼: DELETE.
pub async fn delete(router: Router, path: &str, token: Option<&str>) -> axum::response::Response {
    use tower::ServiceExt;

    let mut req = axum::http::Request::builder()
        .method("DELETE")
        .uri(path)
        .body(axum::body::Body::empty())
        .unwrap();

    if let Some(t) = token {
        let (name, val) = auth_header(t);
        req.headers_mut().append(name, val);
    }

    router.oneshot(req).await.unwrap()
}

/// HTTP 요청 헬퍼: PATCH JSON.
pub async fn patch_json(router: Router, path: &str, body: Value, token: Option<&str>) -> axum::response::Response {
    use tower::ServiceExt;

    let mut req = axum::http::Request::builder()
        .method("PATCH")
        .uri(path)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    if let Some(t) = token {
        let (name, val) = auth_header(t);
        req.headers_mut().append(name, val);
    }

    router.oneshot(req).await.unwrap()
}

/// 응답 body를 serde_json::Value로 파싱.
pub async fn body_json(resp: axum::response::Response) -> Value {
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&bytes).unwrap_or_else(|_| json!({"_raw": String::from_utf8_lossy(&bytes)}))
}

/// 응답 상태 코드 반환.
pub fn status(resp: &axum::response::Response) -> u16 {
    resp.status().as_u16()
}
