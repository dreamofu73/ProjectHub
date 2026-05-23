//! 대시보드 응답의 **내용**을 검증하는 회귀 테스트.
//!
//! 대시보드 핸들러는 각 집계 결과에 `.unwrap_or_default()` 를 걸어 두어
//! SQL 오류가 나도 200 을 반환하고 목록만 조용히 비어 버립니다.
//! 상태코드만 보는 테스트로는 아래와 같은 결함을 잡을 수 없습니다.
//!
//! - `("p", "*")` 처럼 `*` 를 문자열로 넘기면 `"p"."*"` 로 인용되어 무효한 SQL 이 됩니다.
//! - `GROUP BY p.id` 로 묶고 조인 테이블의 `pm.role` 을 선택하면 PostgreSQL 이 거부합니다.
//!
//! `TEST_DATABASE_URL` 로 PostgreSQL/MySQL/MariaDB 에서도 동일하게 검증됩니다.

mod common;

use sea_query::ExprTrait;
use serde_json::Value;

/// 관리자·일반 사용자 각각에 대해 대시보드 집계가 실제로 채워지는지 확인합니다.
async fn assert_dashboard_populated(is_admin: bool) {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());

    let login = if is_admin { "dash_admin" } else { "dash_member" };
    let role = if is_admin { "admin" } else { "user" };
    let (user_id, token) = common::create_user(&pool, login, role).await;

    let project_id = common::create_project(&pool, "Dashboard Project", "dash-proj").await;
    common::add_project_member(&pool, project_id, user_id, "developer").await;
    common::create_issue(&pool, project_id, "열린 이슈").await;

    let resp = common::get(router, "/api/dashboard", Some(&token)).await;
    assert_eq!(common::status(&resp), 200);

    let body = common::body_json(resp).await;
    let data = &body["data"];

    assert_eq!(
        data["total_projects"].as_i64(),
        Some(1),
        "프로젝트 수가 집계되지 않았습니다 (is_admin={is_admin}): {body}"
    );
    assert_eq!(
        data["total_issues"].as_i64(),
        Some(1),
        "이슈 수가 집계되지 않았습니다 (is_admin={is_admin}): {body}"
    );

    let summary = data["projects_summary"]
        .as_array()
        .unwrap_or_else(|| panic!("projects_summary 가 배열이 아닙니다: {body}"));
    assert!(
        !summary.is_empty(),
        "projects_summary 가 비었습니다. SQL 오류가 삼켜졌을 수 있습니다 (is_admin={is_admin}): {body}"
    );
    assert_eq!(summary[0]["identifier"], "dash-proj", "{body}");

    // 상태별 집계도 최소 한 건은 나와야 합니다.
    let by_status = data["issues_by_status"]
        .as_array()
        .unwrap_or_else(|| panic!("issues_by_status 가 배열이 아닙니다: {body}"));
    assert!(
        !by_status.is_empty(),
        "issues_by_status 가 비었습니다 (is_admin={is_admin}): {body}"
    );
}

#[tokio::test]
async fn dashboard_is_populated_for_admin() {
    assert_dashboard_populated(true).await;
}

/// 비관리자는 `project_members` 조인 경로를 타므로 별도로 검증합니다.
#[tokio::test]
async fn dashboard_is_populated_for_member() {
    assert_dashboard_populated(false).await;
}

/// 담당자로 지정된 이슈가 `my_issues` 에 나타나는지 확인합니다.
#[tokio::test]
async fn dashboard_lists_assigned_issues() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (user_id, token) = common::create_user(&pool, "dash_assignee", "admin").await;

    let project_id = common::create_project(&pool, "Assign Project", "assign-proj").await;
    let issue_id = common::create_issue(&pool, project_id, "내 담당 이슈").await;

    let assign = backend::db::to_query(
        &sea_query::Query::update()
            .table("issues")
            .value("assigned_to_id", user_id)
            .and_where(sea_query::Expr::col("id").eq(issue_id))
            .to_owned(),
        backend::db::get_kind(&pool),
    )
    .expect("담당자 지정 질의 생성 실패");
    assign.execute(&pool).await.expect("담당자 지정 실패");

    let resp = common::get(router, "/api/dashboard", Some(&token)).await;
    assert_eq!(common::status(&resp), 200);

    let body = common::body_json(resp).await;
    assert_eq!(
        body["data"]["my_open_issues"].as_i64(),
        Some(1),
        "담당 미해결 이슈 수가 맞지 않습니다: {body}"
    );

    let my_issues: &Vec<Value> = body["data"]["my_issues"]
        .as_array()
        .unwrap_or_else(|| panic!("my_issues 가 배열이 아닙니다: {body}"));
    assert_eq!(my_issues.len(), 1, "my_issues 가 비었습니다: {body}");
    assert_eq!(my_issues[0]["subject"], "내 담당 이슈", "{body}");
}
