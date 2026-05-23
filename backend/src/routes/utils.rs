use axum::{
    http::StatusCode,
    response::Json,
};
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Expr, ExprTrait, JoinType, Query as SeaQuery, SelectStatement};
use crate::auth::AuthUser;

/// 사용자 표시 이름을 조합합니다.
///
/// SQL 의 `||` 연결 연산자는 **MySQL·MariaDB 에서 논리 OR 로 해석**되어
/// 이름 대신 0/1 이 반환됩니다. SQLite 는 `CONCAT` 이 없고(3.44 미만),
/// 방언마다 안전한 연결 구문이 달라 애플리케이션에서 조합합니다.
///
/// 이름이 비어 있으면 로그인 ID 로 대체합니다.
pub fn display_name(firstname: Option<&str>, lastname: Option<&str>, login: &str) -> String {
    let first = firstname.unwrap_or("").trim();
    let last = lastname.unwrap_or("").trim();
    match (first.is_empty(), last.is_empty()) {
        (true, true) => login.to_string(),
        (false, true) => first.to_string(),
        (true, false) => last.to_string(),
        (false, false) => format!("{first} {last}"),
    }
}

/// `id` 또는 `identifier` 로 프로젝트를 찾는 조건을 붙입니다.
///
/// 숫자로 파싱되지 않는 값은 `identifier` 로만 비교합니다.
/// (PostgreSQL 은 BIGINT 컬럼에 문자열을 비교하면 타입 오류를 냅니다.)
fn where_project_ref(stmt: &mut SelectStatement, project_id_or_identifier: &str) {
    let by_identifier = Expr::col("identifier").eq(project_id_or_identifier.to_string());
    match project_id_or_identifier.parse::<i64>() {
        Ok(numeric_id) => stmt.and_where(Expr::col("id").eq(numeric_id).or(by_identifier)),
        Err(_) => stmt.and_where(by_identifier),
    };
}

/// Check if the user has group-based access to a project.
/// Returns the highest mapped project role if found.
/// Mapping: owner→manager, admin→lead, member→developer, viewer→viewer
pub async fn check_group_project_access(
    pool: &AnyPool,
    user: &AuthUser,
    project_id: i64,
) -> Option<String> {
    let stmt = SeaQuery::select()
        .distinct()
        .column(("gm", "role"))
        .from_as("user_group_members", "gm")
        .join_as(
            JoinType::InnerJoin,
            "group_resource_shares",
            "grs",
            Expr::col(("grs", "group_id")).equals(("gm", "group_id")),
        )
        .and_where(Expr::col(("gm", "user_id")).eq(user.id))
        .and_where(Expr::col(("grs", "resource_type")).eq("project"))
        .and_where(Expr::col(("grs", "resource_id")).eq(project_id))
        .to_owned();

    let rows = crate::db::fetch_all(pool, &stmt).await.ok()?;

    if rows.is_empty() {
        return None;
    }

    let role_priority = |role: &str| -> i32 {
        match role {
            "owner" => 5,
            "admin" => 4,
            "member" => 3,
            "viewer" => 2,
            _ => 1,
        }
    };

    let map_role = |group_role: &str| -> &str {
        match group_role {
            "owner" => "manager",
            "admin" => "lead",
            "member" => "developer",
            "viewer" => "viewer",
            _ => "viewer",
        }
    };

    let mut highest_role: Option<String> = None;
    let mut highest_priority = 0;

    for row in rows {
        let group_role: String = row.get("role");
        let priority = role_priority(&group_role);
        if priority > highest_priority {
            highest_priority = priority;
            highest_role = Some(map_role(&group_role).to_string());
        }
    }

    highest_role
}

pub async fn require_project_admin(
    pool: &AnyPool,
    user: &AuthUser,
    project_id_or_identifier: &str,
) -> Result<i64, (StatusCode, Json<Value>)> {
    let mut project_stmt = SeaQuery::select();
    project_stmt.column("id").from("projects");
    where_project_ref(&mut project_stmt, project_id_or_identifier);

    let project = crate::db::fetch_optional(pool, &project_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Project not found"}))))?;
    let project_id: i64 = project.get("id");

    if user.role == "admin" {
        return Ok(project_id);
    }

    let role_stmt = SeaQuery::select()
        .column("role")
        .from("project_members")
        .and_where(Expr::col("project_id").eq(project_id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();

    let role: Option<String> = crate::db::fetch_scalar_optional(pool, &role_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if role.as_deref() == Some("manager") {
        return Ok(project_id);
    }

    // Fallback: check group-based project access for manager role
    let group_role = check_group_project_access(pool, user, project_id).await;
    if let Some(role) = group_role {
        if role == "manager" {
            return Ok(project_id);
        }
    }

    Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "프로젝트 관리 권한이 없습니다."}))))
}

pub async fn check_project_access(
    pool: &AnyPool,
    user: &AuthUser,
    project_id_or_identifier: &str,
) -> Result<i64, (StatusCode, Json<Value>)> {
    let mut project_stmt = SeaQuery::select();
    project_stmt.columns(["id", "is_public"]).from("projects");
    where_project_ref(&mut project_stmt, project_id_or_identifier);

    let project = crate::db::fetch_optional(pool, &project_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Project not found"}))))?;

    let project_id: i64 = project.get("id");
    let is_public: i64 = project.get("is_public");

    if is_public == 1 || user.role == "admin" {
        return Ok(project_id);
    }

    let membership = crate::db::fetch_optional(pool, &membership_stmt(project_id, user.id))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if membership.is_some() {
        return Ok(project_id);
    }

    // Fallback: check group-based project access
    let group_role = check_group_project_access(pool, user, project_id).await;
    if group_role.is_some() {
        return Ok(project_id);
    }

    Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "이 프로젝트에 접근할 권한이 없습니다."}))))
}

pub async fn require_project_member(
    pool: &AnyPool,
    user: &AuthUser,
    project_id: i64,
) -> Result<(), (StatusCode, Json<Value>)> {
    if user.role == "admin" {
        return Ok(());
    }

    let membership = crate::db::fetch_optional(pool, &membership_stmt(project_id, user.id))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if membership.is_some() {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "프로젝트 멤버만 가능합니다."}))))
    }
}

pub async fn is_project_archived(pool: &AnyPool, project_id: i64) -> Result<bool, sqlx::Error> {
    let stmt = SeaQuery::select()
        .column("status")
        .from("projects")
        .and_where(Expr::col("id").eq(project_id))
        .to_owned();

    let status: Option<String> = crate::db::fetch_scalar_optional(pool, &stmt).await?;
    Ok(status.as_deref() == Some("archived"))
}

/// 프로젝트 멤버십 존재 확인용 질의.
fn membership_stmt(project_id: i64, user_id: i64) -> SelectStatement {
    SeaQuery::select()
        .expr(Expr::val(1))
        .from("project_members")
        .and_where(Expr::col("project_id").eq(project_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned()
}
