//! 프로젝트 목록 조회 회귀 테스트.
//!
//! 이 엔드포인트는 조건이 동적이라 과거 `sqlx::QueryBuilder` 로 조립했는데,
//! QueryBuilder 는 방언과 무관하게 항상 `?` 플레이스홀더를 생성합니다.
//! SQLite/MySQL 은 이를 허용하지만 **PostgreSQL 은 `$N` 만 허용**하므로 500 이 났습니다.
//! 현재는 SeaQuery 로 조립해 엔진별 플레이스홀더가 자동 생성됩니다.
//!
//! `TEST_DATABASE_URL` 을 지정하면 PostgreSQL/MySQL/MariaDB 에서도 동일하게 검증됩니다.
//! 예) `TEST_DATABASE_URL="postgres://pms_user:...@localhost:5432/pms_db"`

mod common;

const PATH: &str = "/api/projects?status=active&search=&page=1&limit=10";

#[tokio::test]
async fn lists_projects_for_admin() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, token) = common::create_user(&pool, "list_admin", "admin").await;
    common::create_project(&pool, "Alpha", "alpha").await;

    let resp = common::get(router, PATH, Some(&token)).await;
    assert_eq!(common::status(&resp), 200);

    let body = common::body_json(resp).await;
    assert_eq!(body["success"], true);
    assert_eq!(body["total"], 1);
}

/// 비관리자는 `project_members` 조인 경로를 타므로 바인딩 순서가 달라집니다.
#[tokio::test]
async fn lists_only_joined_projects_for_member() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (user_id, token) = common::create_user(&pool, "list_member", "user").await;
    let joined = common::create_project(&pool, "Joined", "joined").await;
    common::create_project(&pool, "Other", "other").await;
    common::add_project_member(&pool, joined, user_id, "developer").await;

    let resp = common::get(router, PATH, Some(&token)).await;
    assert_eq!(common::status(&resp), 200);

    let body = common::body_json(resp).await;
    assert_eq!(body["total"], 1, "가입한 프로젝트만 보여야 합니다: {body}");
    assert_eq!(body["data"][0]["identifier"], "joined");
    assert_eq!(body["data"][0]["my_role"], "developer");
}

/// 검색어가 있으면 LIKE 바인딩이 3개 추가되어 플레이스홀더 번호가 밀립니다.
#[tokio::test]
async fn filters_projects_by_search_term() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, token) = common::create_user(&pool, "list_search", "admin").await;
    common::create_project(&pool, "Searchable Alpha", "searchable-alpha").await;
    common::create_project(&pool, "Unrelated", "unrelated").await;

    let resp = common::get(
        router,
        "/api/projects?status=active&search=Searchable&page=1&limit=10",
        Some(&token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);

    let body = common::body_json(resp).await;
    assert_eq!(body["total"], 1, "검색 결과가 맞지 않습니다: {body}");
    assert_eq!(body["data"][0]["identifier"], "searchable-alpha");
}
