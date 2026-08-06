use crate::models::{CreateProjectRequest, UpdateProjectRequest};
use axum::{
    extract::{Extension, Path, Query},
    response::Json,
    http::StatusCode,
    routing::{get, post, put, delete},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sea_query::{Asterisk, Expr, ExprTrait, Func, JoinType, Order, Query as SeaQuery, SelectStatement};
use sqlx::{AnyPool, Row};
use crate::db::{execute, fetch_all, fetch_optional, fetch_scalar, now_string};
use crate::auth::AuthUser;
use std::collections::HashMap;
use crate::routes::utils::{require_project_admin, check_project_access, is_project_archived};

/// Allowed project member roles for validation.
const VALID_PROJECT_ROLES: &[&str] = &["manager", "lead", "developer", "reporter", "viewer", "overseer"];

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/projects", get(get_projects))
            .route("/projects", post(create_project))
            .route("/projects/all/members", get(get_all_project_members))
            .route("/projects/:id", get(get_project_by_id))
            .route("/projects/:id", put(update_project))
            .route("/projects/:id", delete(delete_project))
            .route("/projects/:id/members", get(get_project_members))
            .route("/projects/:id/members", post(add_project_member))
            .route("/projects/:id/members/batch", post(add_project_members_batch))
            .route("/projects/:id/members/batch", put(update_project_members_batch))
            .route("/projects/:id/members/batch", delete(delete_project_members_batch))
            .route("/projects/:id/members/:user_id", put(update_project_member))
            .route("/projects/:id/members/:user_id", delete(delete_project_member))
            .route("/projects/:id/member-names", get(get_project_member_names)),
    )
}

async fn get_all_project_members(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_admin = user.role == "admin";

    let mut stmt = SeaQuery::select();
    stmt.columns([("pm", "project_id"), ("pm", "user_id"), ("u", "firstname"), ("u", "lastname")])
        .from_as("project_members", "pm")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("pm", "user_id")));

    if !is_admin {
        stmt.and_where(Expr::col(("pm", "project_id")).in_subquery(
            SeaQuery::select()
                .column("project_id")
                .from("project_members")
                .and_where(Expr::col("user_id").eq(user.id))
                .to_owned()
        ));
    }

    let members = fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = members.into_iter().map(|m| {
        json!({
            "project_id": m.get::<i64, _>("project_id").to_string(),
            "user_id": m.get::<i64, _>("user_id").to_string(),
            "firstname": m.get::<String, _>("firstname"),
            "lastname": m.get::<String, _>("lastname"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn create_project(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<CreateProjectRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "프로젝트 생성은 시스템 관리자만 가능합니다."}))));
    }

    let is_public = if req.is_public.unwrap_or(true) { 1 } else { 0 };

    let project_id = crate::db::new_id();

    let stmt = SeaQuery::insert()
        .into_table("projects")
        .columns(["id", "identifier", "name", "description", "homepage", "is_public", "status", "created_at", "updated_at", "task_types", "issue_types", "statuses", "task_categories", "task_statuses"])
        .values_panic([
            project_id.into(),
            req.identifier.into(),
            req.name.into(),
            req.description.unwrap_or_default().into(),
            req.homepage.unwrap_or_default().into(),
            is_public.into(),
            "active".into(),
            now_string().into(),
            now_string().into(),
            req.task_types.unwrap_or_else(|| "[\"Design\", \"Development\", \"Testing\"]".to_string()).into(),
            req.issue_types.unwrap_or_else(|| "[\"Bug\", \"Feature\", \"Task\"]".to_string()).into(),
            req.statuses.unwrap_or_else(|| "[\"New\", \"In Progress\", \"Resolved\", \"Closed\"]".to_string()).into(),
            req.task_categories.unwrap_or_else(|| "[\"General\", \"Development\", \"Design\"]".to_string()).into(),
            req.task_statuses.unwrap_or_else(|| "[\"New\", \"In Progress\", \"Done\"]".to_string()).into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    let stmt = SeaQuery::insert()
        .into_table("project_members")
        .columns(["id", "project_id", "user_id", "role", "created_at"])
        .values_panic([
            crate::db::new_id().into(),
            project_id.into(),
            user.id.into(),
            "manager".into(),
            now_string().into(),
        ])
        .to_owned();
    let _ = execute(&pool, &stmt).await;

    Ok(Json(json!({ "success": true, "id": project_id.to_string() })))
}

async fn get_projects(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_admin = user.role == "admin";
    let user_id = user.id;

    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;
    let status_param = params.get("status").map(|s| s.as_str()).unwrap_or("all").to_string();
    let search_param = params.get("search").map(|s| s.as_str()).unwrap_or("").to_string();
    let my_projects_only = params.get("my_projects_only").map(|s| s == "true" || s == "1").unwrap_or(false);
    let show_all = params.get("all").map(|s| s == "true" || s == "1").unwrap_or(false);

    // 목록/건수 질의는 조건이 동적이라 SeaQuery 로 조립합니다.
    // sqlx 의 QueryBuilder 는 방언과 무관하게 항상 `?` 플레이스홀더를 생성하므로
    // PostgreSQL(`$1` 필요)에서 문법 오류가 납니다. SeaQuery 는 연결된 엔진에 맞춰 생성합니다.
    let search_pattern = (!search_param.is_empty()).then(|| format!("%{}%", search_param));

    // 비관리자는 기본적으로 참여 중인 프로젝트만 표시하고,
    // all=true 파라미터가 있을 때만 모든 공개 프로젝트를 포함합니다.
    // admin은 show_all과 무관하게 항상 전체를 봅니다.
    let member_or_shared = Expr::col(("p", "id")).in_subquery(
        SeaQuery::select()
            .column("project_id")
            .from("project_members")
            .and_where(Expr::col("user_id").eq(user_id))
            .to_owned()
    ).or(
        Expr::col(("p", "id")).in_subquery(
            SeaQuery::select()
                .column("resource_id")
                .from("group_resource_shares")
                .and_where(Expr::col("resource_type").eq("project"))
                .and_where(Expr::col("group_id").in_subquery(
                    SeaQuery::select()
                        .column("group_id")
                        .from("user_group_members")
                        .and_where(Expr::col("user_id").eq(user_id))
                        .to_owned()
                ))
                .to_owned()
        )
    );

    // 건수 질의와 목록 질의에 동일한 접근 제어·필터 조건을 적용합니다.
    let apply_filters = |select: &mut SelectStatement| {
        if my_projects_only || (!is_admin && !show_all) {
            // 참여 중인 프로젝트만
            select.and_where(member_or_shared.clone());
        } else if !is_admin {
            // 모든 공개 프로젝트
            select.and_where(Expr::col(("p", "is_public")).eq(1).or(member_or_shared.clone()));
        }
        if status_param != "all" && !status_param.is_empty() {
            select.and_where(Expr::col(("p", "status")).eq(status_param.clone()));
        }
        if let Some(pattern) = &search_pattern {
            select.and_where(
                Expr::col(("p", "name"))
                    .like(pattern.clone())
                    .or(Expr::col(("p", "description")).like(pattern.clone()))
                    .or(Expr::col(("p", "identifier")).like(pattern.clone())),
            );
        }
    };

    let mut count_stmt = SeaQuery::select();
    count_stmt.expr(Func::count(Expr::col(("p", "id")))).from_as("projects", "p");
    apply_filters(&mut count_stmt);

    let total: i64 = fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut data_stmt = SeaQuery::select();
    data_stmt
        .columns([
            ("p", "id"),
            ("p", "identifier"),
            ("p", "name"),
            ("p", "description"),
            ("p", "homepage"),
            ("p", "is_public"),
            ("p", "status"),
            ("p", "created_at"),
            ("p", "updated_at"),
        ])
        // 집계 서브쿼리는 파라미터가 없어 방언 차이가 없으므로 원문을 그대로 씁니다.
        .expr_as(
            Expr::cust("(SELECT COUNT(*) FROM project_members WHERE project_id = p.id)"),
            "member_count",
        )
        .expr_as(
            Expr::cust("(SELECT COUNT(*) FROM issues WHERE project_id = p.id)"),
            "issue_count",
        )
        .expr_as(
            Expr::cust(
                "(SELECT COUNT(*) FROM issues WHERE project_id = p.id AND status NOT IN ('closed', 'rejected'))",
            ),
            "open_issue_count",
        )
        .expr_as(
            Expr::SubQuery(None, Box::new(sea_query::SubQueryStatement::SelectStatement(SeaQuery::select()
                    .column("role")
                    .from("project_members")
                    .and_where(Expr::col("project_id").equals(("p", "id")))
                    .and_where(Expr::col("user_id").eq(user_id))
                    .to_owned()))),
            "my_role",
        )
        .from_as("projects", "p");
    apply_filters(&mut data_stmt);
    data_stmt
        .order_by(("p", "updated_at"), Order::Desc)
        .limit(limit as u64)
        .offset(offset as u64);

    let rows = crate::db::fetch_all(&pool, &data_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let projects: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "identifier": r.get::<String, _>("identifier"),
            "name": r.get::<String, _>("name"),
            "description": r.get::<Option<String>, _>("description"),
            "homepage": r.get::<Option<String>, _>("homepage"),
            "is_public": r.get::<i64, _>("is_public"),
            "status": r.get::<String, _>("status"),
            "member_count": r.get::<i64, _>("member_count"),
            "issue_count": r.get::<i64, _>("issue_count"),
            "open_issue_count": r.get::<i64, _>("open_issue_count"),
            "my_role": r.get::<Option<String>, _>("my_role"),
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": r.get::<String, _>("updated_at")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": projects, "total": total })))
}

async fn get_project_by_id(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = check_project_access(&pool, &user, &id).await?;
    let user_id = user.id;

    // 집계는 GROUP BY 대신 상관 서브쿼리로 구합니다.
    // `GROUP BY p.id` 로 묶으면 PostgreSQL 이 그룹에 포함되지 않은 `pm.role` 을 거부합니다
    // (함수 종속성은 같은 테이블의 기본키에만 적용됩니다).
    // 조인이 여러 개이므로 `*` 대신 프로젝트 테이블의 컬럼만 가져옵니다.
    let stmt = SeaQuery::select()
        .expr(Expr::col(("p", Asterisk)))
        .expr_as(Expr::col(("pm", "role")), "my_role")
        .expr_as(
            Expr::cust("(SELECT COUNT(*) FROM project_members WHERE project_id = p.id)"),
            "member_count",
        )
        .expr_as(
            Expr::cust("(SELECT COUNT(*) FROM issues WHERE project_id = p.id)"),
            "issue_count",
        )
        .expr_as(
            Expr::cust(
                "(SELECT COUNT(*) FROM issues WHERE project_id = p.id AND status NOT IN ('closed', 'rejected'))",
            ),
            "open_issue_count",
        )
        .from_as("projects", "p")
        .join_as(
            JoinType::LeftJoin,
            "project_members",
            "pm",
            Expr::col(("pm", "project_id"))
                .equals(("p", "id"))
                .and(Expr::col(("pm", "user_id")).eq(user_id)),
        )
        .and_where(Expr::col(("p", "id")).eq(project_id))
        .to_owned();

    let project = fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(p) = project {
        Ok(Json(json!({
            "success": true,
            "data": {
                "id": p.get::<i64, _>("id").to_string(),
                "identifier": p.get::<String, _>("identifier"),
                "name": p.get::<String, _>("name"),
                "description": p.get::<Option<String>, _>("description"),
                "status": p.get::<String, _>("status"),
                "homepage": p.get::<Option<String>, _>("homepage"),
                "is_public": p.get::<i64, _>("is_public"),
                "created_at": p.get::<String, _>("created_at"),
                "member_count": p.get::<i64, _>("member_count"),
                "issue_count": p.get::<i64, _>("issue_count"),
                "open_issue_count": p.get::<i64, _>("open_issue_count"),
                "my_role": p.get::<Option<String>, _>("my_role")
            }
        })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Project not found"}))))
    }
}

async fn update_project(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<UpdateProjectRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_project_admin(&pool, &user, &id).await?;

    let is_public = req.is_public.map(|b| if b { 1 } else { 0 });

    let mut stmt = SeaQuery::update();
    stmt.table("projects")
        .value("updated_at", now_string());

    if let Some(name) = req.name { stmt.value("name", name); }
    if let Some(description) = req.description { stmt.value("description", description); }
    if let Some(homepage) = req.homepage { stmt.value("homepage", homepage); }
    if let Some(status) = req.status { stmt.value("status", status); }
    if let Some(is_public) = is_public { stmt.value("is_public", is_public); }
    if let Some(task_types) = req.task_types { stmt.value("task_types", task_types); }
    if let Some(issue_types) = req.issue_types { stmt.value("issue_types", issue_types); }
    if let Some(statuses) = req.statuses { stmt.value("statuses", statuses); }
    if let Some(task_categories) = req.task_categories { stmt.value("task_categories", task_categories); }
    if let Some(task_statuses) = req.task_statuses { stmt.value("task_statuses", task_statuses); }

    stmt.and_where(Expr::col("id").eq(id.parse::<i64>().unwrap_or(0)).or(Expr::col("identifier").eq(id.clone())));

    execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn delete_project(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_project_admin(&pool, &user, &id).await?;

    let stmt = SeaQuery::delete()
        .from_table("projects")
        .and_where(Expr::col("id").eq(id.parse::<i64>().unwrap_or(0)).or(Expr::col("identifier").eq(id.clone())))
        .to_owned();
    execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn get_project_members(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = check_project_access(&pool, &user, &id).await?;

    let stmt = SeaQuery::select()
        .columns([("pm", "id"), ("pm", "user_id"), ("pm", "role"), ("pm", "created_at"), ("u", "login"), ("u", "email"), ("u", "firstname"), ("u", "lastname")])
        .from_as("project_members", "pm")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("pm", "user_id")))
        .and_where(Expr::col(("pm", "project_id")).eq(project_id))
        .to_owned();

    let members = fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = members.into_iter().map(|m| {
        json!({
            "id": m.get::<i64, _>("id").to_string(),
            "user_id": m.get::<i64, _>("user_id").to_string(),
            "login": m.get::<Option<String>, _>("login").unwrap_or_default(),
            "email": m.get::<Option<String>, _>("email").unwrap_or_default(),
            "firstname": m.get::<Option<String>, _>("firstname").unwrap_or_default(),
            "lastname": m.get::<Option<String>, _>("lastname").unwrap_or_default(),
            "role": m.get::<Option<String>, _>("role").unwrap_or_else(|| "developer".to_string()),
            "created_at": m.get::<Option<String>, _>("created_at").unwrap_or_default()
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn get_project_member_names(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = check_project_access(&pool, &user, &id).await?;

    let stmt = SeaQuery::select()
        .columns([("pm", "user_id"), ("u", "login"), ("u", "firstname"), ("u", "lastname")])
        .from_as("project_members", "pm")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("pm", "user_id")))
        .and_where(Expr::col(("pm", "project_id")).eq(project_id))
        .to_owned();

    let members = fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = members.into_iter().map(|m| {
        json!({
            "user_id": m.get::<i64, _>("user_id").to_string(),
            "login": m.get::<String, _>("login"),
            "firstname": m.get::<String, _>("firstname"),
            "lastname": m.get::<String, _>("lastname")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn add_project_member(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(member_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = require_project_admin(&pool, &user, &id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let user_id = member_data.get("user_id").and_then(crate::serde_utils::value_to_opt_i64).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_id is required"}))))?;
    let role = member_data.get("role").and_then(|v| v.as_str()).unwrap_or("developer");

    let stmt = SeaQuery::insert()
        .into_table("project_members")
        .columns(["id", "project_id", "user_id", "role", "created_at"])
        .values_panic([
            crate::db::new_id().into(),
            project_id.into(),
            user_id.into(),
            role.into(),
            now_string().into(),
        ])
        .to_owned();
    execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn update_project_member(
    Path((id, user_id)): Path<(String, i64)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(member_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = require_project_admin(&pool, &user, &id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let role = member_data.get("role").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "role is required"}))))?;

    let stmt = SeaQuery::update()
        .table("project_members")
        .value("role", role)
        .and_where(Expr::col("project_id").eq(project_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn delete_project_member(
    Path((id, user_id)): Path<(String, i64)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = require_project_admin(&pool, &user, &id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let stmt = SeaQuery::delete()
        .from_table("project_members")
        .and_where(Expr::col("project_id").eq(project_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn add_project_members_batch(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(batch_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = require_project_admin(&pool, &user, &id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let user_ids = batch_data.get("user_ids").and_then(|v| v.as_array()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_ids array is required"}))))?;
    let role = batch_data.get("role").and_then(|v| v.as_str()).unwrap_or("developer");
    if !VALID_PROJECT_ROLES.contains(&role) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": format!("Invalid role '{}'. Allowed: {}", role, VALID_PROJECT_ROLES.join(", "))}))));
    }
    let mut added = 0i64;
    let mut errors: Vec<Value> = vec![];

    for user_val in user_ids {
        if let Some(uid) = crate::serde_utils::value_to_opt_i64(user_val) {
            // project_members has no UNIQUE(project_id, user_id) constraint, so we
            // cannot rely on ON CONFLICT. Skip existing members with an explicit check.
            let exists_stmt = SeaQuery::select()
                .expr(Func::count(Expr::col("id")))
                .from("project_members")
                .and_where(Expr::col("project_id").eq(project_id))
                .and_where(Expr::col("user_id").eq(uid))
                .to_owned();
            let already_member: i64 = fetch_scalar(&pool, &exists_stmt).await.unwrap_or(0);
            if already_member > 0 {
                continue;
            }

            match execute(&pool, &SeaQuery::insert()
                .into_table("project_members")
                .columns(["id", "project_id", "user_id", "role", "created_at"])
                .values_panic([
                    crate::db::new_id().into(),
                    project_id.into(),
                    uid.into(),
                    role.into(),
                    now_string().into(),
                ])
                .to_owned()
            )
            .await
            {
                Ok(r) if r.rows_affected() > 0 => added += 1,
                Ok(_) => {},
                Err(e) => errors.push(json!({"user_id": uid.to_string(), "error": e.to_string()})),
            }
        }
    }

    Ok(Json(json!({ "success": true, "added": added, "errors": errors })))
}

async fn update_project_members_batch(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(batch_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = require_project_admin(&pool, &user, &id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let user_ids = batch_data.get("user_ids").and_then(|v| v.as_array()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_ids array is required"}))))?;
    let role = batch_data.get("role").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "role is required"}))))?;
    if !VALID_PROJECT_ROLES.contains(&role) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": format!("Invalid role '{}'. Allowed: {}", role, VALID_PROJECT_ROLES.join(", "))}))));
    }
    let mut updated = 0i64;
    let mut errors: Vec<Value> = vec![];

    for user_val in user_ids {
        if let Some(uid) = crate::serde_utils::value_to_opt_i64(user_val) {
            match execute(&pool, &SeaQuery::update()
                .table("project_members")
                .value("role", role)
                .and_where(Expr::col("project_id").eq(project_id))
                .and_where(Expr::col("user_id").eq(uid))
                .to_owned()
            )
            .await
            {
                Ok(r) if r.rows_affected() > 0 => updated += 1,
                Ok(_) => errors.push(json!({"user_id": uid.to_string(), "error": "member not found"})),
                Err(e) => errors.push(json!({"user_id": uid.to_string(), "error": e.to_string()})),
            }
        }
    }

    Ok(Json(json!({ "success": true, "updated": updated, "errors": errors })))
}

async fn delete_project_members_batch(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(batch_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = require_project_admin(&pool, &user, &id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let user_ids = batch_data.get("user_ids").and_then(|v| v.as_array()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_ids array is required"}))))?;
    let mut deleted = 0i64;
    let mut errors: Vec<Value> = vec![];

    for user_val in user_ids {
        if let Some(uid) = crate::serde_utils::value_to_opt_i64(user_val) {
            match execute(&pool, &SeaQuery::delete()
                .from_table("project_members")
                .and_where(Expr::col("project_id").eq(project_id))
                .and_where(Expr::col("user_id").eq(uid))
                .to_owned()
            )
            .await
            {
                Ok(r) if r.rows_affected() > 0 => deleted += 1,
                Ok(_) => errors.push(json!({"user_id": uid.to_string(), "error": "member not found"})),
                Err(e) => errors.push(json!({"user_id": uid.to_string(), "error": e.to_string()})),
            }
        }
    }

    Ok(Json(json!({ "success": true, "deleted": deleted, "errors": errors })))
}
