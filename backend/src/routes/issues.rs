use crate::models::{CreateIssueRequest, UpdateIssueRequest, CreateCommentRequest};
use axum::{
    extract::{Extension, Path, Query},
    response::Json,
    http::StatusCode,
    routing::{get, post, put, delete},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use crate::auth::AuthUser;
use std::collections::HashMap;
use crate::routes::utils::{check_project_access, require_project_member, is_project_archived, display_name};
use sea_query::{Asterisk, Expr, ExprTrait, Func, JoinType, Order, Query as SeaQuery, SelectStatement};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/issues", get(get_issues))
            .route("/issues/bulk", put(bulk_update_issues))
            .route("/issues/:id", get(get_issue_by_id))
            .route("/issues", post(create_issue))
            .route("/issues/:id", put(update_issue))
            .route("/issues/:id", delete(delete_issue))
            .route("/comments", post(create_comment)),
    )
}

#[utoipa::path(
    get,
    path = "/issues",
    responses(
        (status = 200, description = "List issues", body = Vec<Issue>)
    ),
    security(("bearerAuth" = []))
)]
async fn get_issues(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_admin = user.role == "admin";

    // 페이지네이션: page 는 1 이상, limit 은 1..=200 으로 클램프
    let page = params.get("page").and_then(|v| v.parse::<u64>().ok()).filter(|v| *v >= 1).unwrap_or(1);
    let limit = params.get("limit").and_then(|v| v.parse::<u64>().ok()).unwrap_or(10).clamp(1, 200);
    let offset = (page - 1) * limit;

    // 모든 필터는 SQL WHERE 로 변환되며, 목록/건수 질의에 동일하게 적용됩니다.
    let apply_filters = |stmt: &mut SelectStatement| {
        // project_id (또는 레거시 project): identifier 또는 숫자 id(문자열 변환) 매칭
        if let Some(p) = params.get("project_id").or_else(|| params.get("project")) {
            if !p.is_empty() && p != "all" {
                stmt.and_where(
                    Expr::col(("p", "identifier")).eq(p.clone())
                        .or(Expr::col(("i", "project_id")).eq(p.clone())),
                );
            }
        }
        // tracker
        if let Some(track) = params.get("tracker") {
            if !track.is_empty() && track != "all" {
                stmt.and_where(Expr::col(("i", "tracker")).eq(track.clone()));
            }
        }
        // status: 쉼표 구분 목록을 IN 으로 변환
        if let Some(stat) = params.get("status") {
            if !stat.is_empty() && stat != "all" {
                let statuses: Vec<String> = stat.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                if !statuses.is_empty() {
                    stmt.and_where(Expr::col(("i", "status")).is_in(statuses));
                }
            }
        }
        // priority: 프론트가 전송하던 파라미터를 이제 서버에서 필터링
        if let Some(pr) = params.get("priority") {
            if !pr.is_empty() && pr != "all" {
                stmt.and_where(Expr::col(("i", "priority")).eq(pr.clone()));
            }
        }
        // assigned_to: "me" 는 현재 사용자, 그 외는 로그인 ID 매칭
        if let Some(assigned) = params.get("assigned_to") {
            if !assigned.is_empty() && assigned != "all" {
                if assigned == "me" {
                    stmt.and_where(Expr::col(("i", "assigned_to_id")).eq(user.id));
                } else {
                    stmt.and_where(Expr::col(("u", "login")).eq(assigned.clone()));
                }
            }
        }
        // search: 제목/설명 부분 일치 (LIKE 이스케이프 없음 — 기존 동작 유지)
        if let Some(q) = params.get("search") {
            if !q.is_empty() {
                let pattern = format!("%{}%", q.to_lowercase());
                stmt.and_where(
                    Expr::expr(Func::lower(Expr::col(("i", "subject")))).like(pattern.clone())
                        .or(Expr::expr(Func::lower(Expr::col(("i", "description")))).like(pattern)),
                );
            }
        }
    };

    // ---- 건수 질의 (동일 WHERE/조인) ----
    let mut count_stmt = SeaQuery::select();
    count_stmt
        .expr(Func::count(Expr::col(("i", "id"))))
        .from_as("issues", "i")
        .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("i", "project_id")).equals(("p", "id")))
        .join_as(JoinType::LeftJoin, "users", "u", Expr::col(("i", "assigned_to_id")).equals(("u", "id")))
        .join_as(JoinType::LeftJoin, "users", "au", Expr::col(("i", "author_id")).equals(("au", "id")));
    if !is_admin {
        count_stmt.join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("i", "project_id")).and(Expr::col(("pm", "user_id")).eq(user.id)));
    }
    apply_filters(&mut count_stmt);

    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // ---- 목록 질의 ----
    let mut stmt = SeaQuery::select();
    stmt.columns([
        ("i", "id"),
        ("i", "project_id"),
        ("i", "tracker"),
        ("i", "subject"),
        ("i", "status"),
        ("i", "priority"),
        ("i", "assigned_to_id"),
        ("i", "task_type"),
        ("i", "author_id"),
        ("i", "due_date"),
        ("i", "planned_start_date"),
        ("i", "actual_start_date"),
        ("i", "actual_end_date"),
        ("i", "created_at"),
        ("i", "updated_at"),
    ])
    .expr_as(Expr::col(("p", "name")), "project_name")
    .expr_as(Expr::col(("p", "identifier")), "project_identifier")
    .expr_as(Expr::col(("u", "login")), "assigned_login")
    .expr_as(Expr::col(("u", "firstname")), "assigned_firstname")
    .expr_as(Expr::col(("u", "lastname")), "assigned_lastname")
    .expr_as(Expr::col(("au", "login")), "author_login")
    .expr_as(Expr::col(("au", "firstname")), "author_firstname")
    .expr_as(Expr::col(("au", "lastname")), "author_lastname")
    .from_as("issues", "i")
    .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("i", "project_id")).equals(("p", "id")))
    .join_as(JoinType::LeftJoin, "users", "u", Expr::col(("i", "assigned_to_id")).equals(("u", "id")))
    .join_as(JoinType::LeftJoin, "users", "au", Expr::col(("i", "author_id")).equals(("au", "id")));

    if !is_admin {
        stmt.join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("i", "project_id")).and(Expr::col(("pm", "user_id")).eq(user.id)));
    }

    apply_filters(&mut stmt);

    // ---- 정렬 (화이트리스트, 모르는 키는 기본 updated_at desc 로 폴백) ----
    let sort_by = params.get("sort_by").map(|s| s.as_str()).unwrap_or("updated_at");
    let sort_order = params.get("sort_order").map(|s| s.to_lowercase());
    let sort_dir = match sort_order.as_deref() {
        Some("asc") => Order::Asc,
        _ => Order::Desc,
    };
    match sort_by {
        "id" => { stmt.order_by(("i", "id"), sort_dir); }
        "tracker" => { stmt.order_by(("i", "tracker"), sort_dir); }
        "task_type" => { stmt.order_by(("i", "task_type"), sort_dir); }
        "priority" => { stmt.order_by(("i", "priority"), sort_dir); }
        "status" => { stmt.order_by(("i", "status"), sort_dir); }
        "subject" => { stmt.order_by(("i", "subject"), sort_dir); }
        "project_name" => { stmt.order_by(("p", "name"), sort_dir); }
        "created_at" => { stmt.order_by(("i", "created_at"), sort_dir); }
        "updated_at" => { stmt.order_by(("i", "updated_at"), sort_dir); }
        "assigned_name" => {
            // nulls-last 보장 (방향 무관), 이후 coalesce 값으로 정렬
            stmt.order_by_expr(Expr::col(("i", "assigned_to_id")).is_null(), Order::Asc);
            stmt.order_by_expr(Expr::expr(Func::coalesce([Expr::col(("u", "firstname")), Expr::col(("u", "login"))])), sort_dir);
        }
        "author_name" => {
            stmt.order_by_expr(Expr::col(("au", "id")).is_null(), Order::Asc);
            stmt.order_by_expr(Expr::expr(Func::coalesce([Expr::col(("au", "firstname")), Expr::col(("au", "login"))])), sort_dir);
        }
        "planned_start_date" => {
            stmt.order_by_expr(Expr::col(("i", "planned_start_date")).is_null(), Order::Asc);
            stmt.order_by(("i", "planned_start_date"), sort_dir);
        }
        "actual_start_date" => {
            stmt.order_by_expr(Expr::col(("i", "actual_start_date")).is_null(), Order::Asc);
            stmt.order_by(("i", "actual_start_date"), sort_dir);
        }
        "actual_end_date" => {
            stmt.order_by_expr(Expr::col(("i", "actual_end_date")).is_null(), Order::Asc);
            stmt.order_by(("i", "actual_end_date"), sort_dir);
        }
        _ => { stmt.order_by(("i", "updated_at"), Order::Desc); }
    }

    stmt.limit(limit).offset(offset);

    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = rows.into_iter().map(|i| {
        let assigned_firstname: Option<String> = i.get("assigned_firstname");
        let assigned_lastname: Option<String> = i.get("assigned_lastname");
        let assigned_login: Option<String> = i.get("assigned_login");
        let assigned_name = assigned_login.as_ref().map(|l| display_name(assigned_firstname.as_deref(), assigned_lastname.as_deref(), l));

        let author_login: Option<String> = i.get("author_login");
        let author_firstname: Option<String> = i.get("author_firstname");
        let author_lastname: Option<String> = i.get("author_lastname");
        let author_name = author_login.as_ref().map(|l| display_name(author_firstname.as_deref(), author_lastname.as_deref(), l)).unwrap_or_default();

        json!({
            "id": i.get::<i64, _>("id").to_string(),
            "project_id": i.get::<i64, _>("project_id").to_string(),
            "tracker": i.get::<String, _>("tracker"),
            "subject": i.get::<String, _>("subject"),
            "status": i.get::<String, _>("status"),
            "priority": i.get::<String, _>("priority"),
            "task_type": i.get::<Option<String>, _>("task_type"),
            "assigned_to_id": i.get::<Option<i64>, _>("assigned_to_id").map(|v| v.to_string()),
            "assigned_login": assigned_login,
            "assigned_name": assigned_name,
            "author_id": i.get::<i64, _>("author_id").to_string(),
            "author_login": author_login,
            "author_name": author_name,
            "project_name": i.get::<String, _>("project_name"),
            "project_identifier": i.get::<String, _>("project_identifier"),
            "due_date": i.get::<Option<String>, _>("due_date"),
            "planned_start_date": i.get::<Option<String>, _>("planned_start_date"),
            "actual_start_date": i.get::<Option<String>, _>("actual_start_date"),
            "actual_end_date": i.get::<Option<String>, _>("actual_end_date"),
            "created_at": i.get::<String, _>("created_at"),
            "updated_at": i.get::<String, _>("updated_at"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data, "total": total, "page": page, "limit": limit })))
}

#[utoipa::path(
    put,
    path = "/issues/bulk",
    request_body = Value,
    responses(
        (status = 200, description = "Bulk update issues successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn bulk_update_issues(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(bulk_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let ids = bulk_data.get("ids").and_then(|v| v.as_array()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "ids is required"}))))?;
    let status = bulk_data.get("status").and_then(|v| v.as_str());
    let priority = bulk_data.get("priority").and_then(|v| v.as_str());
    let task_type = bulk_data.get("task_type").and_then(|v| v.as_str());
    let tracker = bulk_data.get("tracker").and_then(|v| v.as_str());
    let assigned_to_id = bulk_data.get("assigned_to_id");
    let planned_start_date: Option<Option<String>> = match bulk_data.get("planned_start_date") {
        Some(v) if v.is_null() => Some(None),
        Some(v) => Some(v.as_str().map(|s| s.to_string())),
        None => None,
    };
    let actual_start_date: Option<Option<String>> = match bulk_data.get("actual_start_date") {
        Some(v) if v.is_null() => Some(None),
        Some(v) => Some(v.as_str().map(|s| s.to_string())),
        None => None,
    };
    let actual_end_date: Option<Option<String>> = match bulk_data.get("actual_end_date") {
        Some(v) if v.is_null() => Some(None),
        Some(v) => Some(v.as_str().map(|s| s.to_string())),
        None => None,
    };
    let due_date: Option<Option<String>> = match bulk_data.get("due_date") {
        Some(v) if v.is_null() => Some(None),
        Some(v) => Some(v.as_str().map(|s| s.to_string())),
        None => None,
    };

    if ids.is_empty() {
        return Ok(Json(json!({ "success": true })));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    for id_val in ids {
        let id = id_val.as_i64().or_else(|| id_val.as_str().and_then(|s| s.parse::<i64>().ok())).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "invalid id"}))))?;
        
        let stmt = SeaQuery::select()
            .column("project_id")
            .from("issues")
            .and_where(Expr::col("id").eq(id))
            .to_owned();
        
        let kind = crate::db::get_kind(&pool);
        let query = crate::db::to_query_scalar::<i64, _>(&stmt, kind).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        let issue_project: Option<i64> = query.fetch_optional(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        
        if let Some(pid) = issue_project {
            require_project_member(&pool, &user, pid).await?;
            if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
                return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
            }
        } else {
            continue;
        }

        let assigned_id_val = if let Some(v) = assigned_to_id {
            if v.is_null() { Some(None) } else { v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok())).map(Some) }
        } else {
            None
        };

        let mut update_stmt = SeaQuery::update();
        update_stmt.table("issues");
        
        if let Some(s) = status {
            update_stmt.value("status", s);
        }
        
        if let Some(assigned_id) = assigned_id_val {
            update_stmt.value("assigned_to_id", Expr::val(assigned_id));
        }
        
        if let Some(p) = priority {
            update_stmt.value("priority", p);
        }
        if let Some(tt) = task_type {
            update_stmt.value("task_type", tt);
        }
        if let Some(tr) = tracker {
            update_stmt.value("tracker", tr);
        }
        match &planned_start_date {
            Some(None) => { update_stmt.value("planned_start_date", None::<String>); }
            Some(Some(v)) => { update_stmt.value("planned_start_date", v.as_str()); }
            None => {}
        }
        match &actual_start_date {
            Some(None) => { update_stmt.value("actual_start_date", None::<String>); }
            Some(Some(v)) => { update_stmt.value("actual_start_date", v.as_str()); }
            None => {}
        }
        match &actual_end_date {
            Some(None) => { update_stmt.value("actual_end_date", None::<String>); }
            Some(Some(v)) => { update_stmt.value("actual_end_date", v.as_str()); }
            None => {}
        }
        match &due_date {
            Some(None) => { update_stmt.value("due_date", None::<String>); }
            Some(Some(v)) => { update_stmt.value("due_date", v.as_str()); }
            None => {}
        }
        
        update_stmt.value("updated_at", crate::db::now_string());
        update_stmt.and_where(Expr::col("id").eq(id));
        
        let query = crate::db::to_query(&update_stmt, kind).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        query.execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    get,
    path = "/issues/{id}",
    params(
        ("id" = i64, Path, description = "Issue ID")
    ),
    responses(
        (status = 200, description = "Get issue by ID", body = Issue),
        (status = 404, description = "Issue not found")
    ),
    security(("bearerAuth" = []))
)]
async fn get_issue_by_id(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    let project_id: i64 = crate::db::fetch_scalar_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;
    
    check_project_access(&pool, &user, &project_id.to_string()).await?;

    let stmt = SeaQuery::select()
        .columns([("i", Asterisk)])
        .expr_as(Expr::col(("p", "name")), "project_name")
        .expr_as(Expr::col(("p", "identifier")), "project_identifier")
        .expr_as(Expr::col(("u", "login")), "assigned_login")
        .expr_as(Expr::col(("u", "firstname")), "assigned_firstname")
        .expr_as(Expr::col(("u", "lastname")), "assigned_lastname")
        .from_as("issues", "i")
        .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("i", "project_id")).equals(("p", "id")))
        .join_as(JoinType::LeftJoin, "users", "u", Expr::col(("i", "assigned_to_id")).equals(("u", "id")))
        .and_where(Expr::col(("i", "id")).eq(id))
        .to_owned();

    let issue = crate::db::fetch_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(i) = issue {
        let firstname: Option<String> = i.get("assigned_firstname");
        let lastname: Option<String> = i.get("assigned_lastname");
        let login: Option<String> = i.get("assigned_login");
        let assigned_name = if let Some(l) = login {
            Some(display_name(firstname.as_deref(), lastname.as_deref(), &l))
        } else {
            None
        };
        let stmt = SeaQuery::select()
            .columns(["id", "filename", "content_type", "filesize", "created_at"])
            .from("attachments")
            .and_where(Expr::col("issue_id").eq(id))
            .and_where(Expr::col("comment_id").is_null())
            .to_owned();

        let issue_attachments = crate::db::fetch_all(&*pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let issue_attachments_json: Vec<Value> = issue_attachments.into_iter().map(|a| {
            json!({
                "id": a.get::<i64, _>("id").to_string(),
                "filename": a.get::<String, _>("filename"),
                "content_type": a.get::<Option<String>, _>("content_type"),
                "filesize": a.get::<i64, _>("filesize"),
                "created_at": a.get::<String, _>("created_at")
            })
        }).collect();

        let stmt = SeaQuery::select()
            .columns([("c", "id"), ("c", "issue_id"), ("c", "author_id"), ("c", "content"), ("c", "created_at")])
            .expr_as(Expr::col(("u", "login")), "author_login")
            .expr_as(Expr::col(("u", "firstname")), "author_firstname")
            .expr_as(Expr::col(("u", "lastname")), "author_lastname")
            .from_as("comments", "c")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("c", "author_id")).equals(("u", "id")))
            .and_where(Expr::col(("c", "issue_id")).eq(id))
            .order_by(("c", "created_at"), Order::Asc)
            .to_owned();

        let comments = crate::db::fetch_all(&*pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let mut comments_json = Vec::new();
        for c in comments {
            let cid = c.get::<i64, _>("id");
            let firstname: Option<String> = c.get("author_firstname");
            let lastname: Option<String> = c.get("author_lastname");
            let login: String = c.get("author_login");
            let author_name = display_name(firstname.as_deref(), lastname.as_deref(), &login);

            let stmt = SeaQuery::select()
                .columns(["id", "filename", "content_type", "filesize", "created_at"])
                .from("attachments")
                .and_where(Expr::col("comment_id").eq(cid))
                .to_owned();

            let comment_attachments = crate::db::fetch_all(&*pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

            let attachments_json: Vec<Value> = comment_attachments.into_iter().map(|a| {
                json!({
                    "id": a.get::<i64, _>("id").to_string(),
                    "filename": a.get::<String, _>("filename"),
                    "content_type": a.get::<Option<String>, _>("content_type"),
                    "filesize": a.get::<i64, _>("filesize"),
                    "created_at": a.get::<String, _>("created_at")
                })
            }).collect();

            comments_json.push(json!({
                "id": cid.to_string(),
                "issue_id": c.get::<i64, _>("issue_id").to_string(),
                "author_id": c.get::<i64, _>("author_id").to_string(),
                "content": c.get::<String, _>("content"),
                "author_login": login,
                "author_name": author_name,
                "created_at": c.get::<String, _>("created_at"),
                "attachments": attachments_json
            }));
        }

        Ok(Json(json!({
            "success": true,
            "data": {
                "issue": {
                    "id": i.get::<i64, _>("id").to_string(),
                    "project_id": i.get::<i64, _>("project_id").to_string(),
                    "tracker": i.get::<String, _>("tracker"),
                    "subject": i.get::<String, _>("subject"),
                    "description": i.get::<Option<String>, _>("description"),
                    "status": i.get::<String, _>("status"),
                    "priority": i.get::<String, _>("priority"),
                    "assigned_to_id": i.get::<Option<i64>, _>("assigned_to_id").map(|v| v.to_string()),
                    "assigned_name": assigned_name,
                    "project_name": i.get::<String, _>("project_name"),
                    "project_identifier": i.get::<String, _>("project_identifier"),
                    "done_ratio": i.get::<i64, _>("done_ratio"),
                    "created_at": i.get::<String, _>("created_at"),
                    "updated_at": i.get::<String, _>("updated_at"),
                    "attachments": issue_attachments_json
                },
                "comments": comments_json
            }
        })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))
    }
}

#[utoipa::path(
    post,
    path = "/issues",
    request_body = CreateIssueRequest,
    responses(
        (status = 200, description = "Issue created successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn create_issue(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<CreateIssueRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_project_member(&pool, &user, req.project_id).await?;

    if is_project_archived(&pool, req.project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let issue_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("issues")
        .columns([
            "id", "project_id", "tracker", "subject", "description", "status", "priority",
            "author_id", "created_at", "updated_at", "task_type", "planned_start_date",
            "actual_start_date", "actual_end_date"
        ])
        .values_panic([
            issue_id.into(),
            req.project_id.into(),
            req.tracker.unwrap_or_else(|| "bug".to_string()).into(),
            req.subject.into(),
            req.description.unwrap_or_default().into(),
            req.status.unwrap_or_else(|| "new".to_string()).into(),
            req.priority.unwrap_or_else(|| "normal".to_string()).into(),
            user.id.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
            req.task_type.into(),
            req.planned_start_date.into(),
            req.actual_start_date.into(),
            req.actual_end_date.into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(attachment_ids) = req.attachment_ids {
        for aid in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("issue_id", issue_id)
                .and_where(Expr::col("id").eq(aid))
                .to_owned();
            
            crate::db::execute(&*pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }
    }

    Ok(Json(json!({ "success": true, "id": issue_id.to_string() })))
}

#[utoipa::path(
    put,
    path = "/issues/{id}",
    params(
        ("id" = i64, Path, description = "Issue ID")
    ),
    request_body = UpdateIssueRequest,
    responses(
        (status = 200, description = "Issue updated successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn update_issue(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<UpdateIssueRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["project_id", "author_id"])
        .from("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    let issue_info = crate::db::fetch_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;

    let project_id: i64 = issue_info.get("project_id");
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let assigned_id = match req.assigned_to_id {
        Some(None) => Some(None),
        Some(Some(id)) => Some(Some(id)),
        None => None
    };

    let mut update_stmt = SeaQuery::update();
    update_stmt.table("issues");
    
    if let Some(subject) = req.subject { update_stmt.value("subject", subject); }
    if let Some(description) = req.description { update_stmt.value("description", description); }
    if let Some(tracker) = req.tracker { update_stmt.value("tracker", tracker); }
    if let Some(status) = req.status { update_stmt.value("status", status); }
    if let Some(priority) = req.priority { update_stmt.value("priority", priority); }
    
    if let Some(assigned_id) = assigned_id {
        update_stmt.value("assigned_to_id", Expr::val(assigned_id));
    }
    
    if let Some(done_ratio) = req.done_ratio { update_stmt.value("done_ratio", done_ratio); }
    if let Some(due_date) = req.due_date { update_stmt.value("due_date", due_date); }
    if let Some(task_type) = req.task_type { update_stmt.value("task_type", task_type); }
    if let Some(planned_start_date) = req.planned_start_date { update_stmt.value("planned_start_date", planned_start_date); }
    if let Some(actual_start_date) = req.actual_start_date { update_stmt.value("actual_start_date", actual_start_date); }
    if let Some(actual_end_date) = req.actual_end_date { update_stmt.value("actual_end_date", actual_end_date); }
    
    update_stmt.value("updated_at", crate::db::now_string());
    update_stmt.and_where(Expr::col("id").eq(id));
    
    crate::db::execute(&*pool, &update_stmt.to_owned())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    delete,
    path = "/issues/{id}",
    params(
        ("id" = i64, Path, description = "Issue ID")
    ),
    responses(
        (status = 200, description = "Issue deleted successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn delete_issue(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["project_id", "author_id"])
        .from("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    let issue_info = crate::db::fetch_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;

    let project_id: i64 = issue_info.get("project_id");
    let author_id: i64 = issue_info.get("author_id");

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    if user.id != author_id && user.role != "admin" {
        // If not author or admin, check if project manager
        let stmt = SeaQuery::select()
            .column("role")
            .from("project_members")
            .and_where(Expr::col("project_id").eq(project_id))
            .and_where(Expr::col("user_id").eq(user.id))
            .to_owned();
        
        let role: Option<String> = crate::db::fetch_scalar_optional(&*pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        match role {
            Some(r) if r == "manager" => (),
            _ => return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."})))),
        }
    }

    let stmt = SeaQuery::delete()
        .from_table("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    crate::db::execute(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    post,
    path = "/comments",
    request_body = CreateCommentRequest,
    responses(
        (status = 200, description = "Comment created successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn create_comment(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(comment_data): axum::Json<CreateCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let issue_id = comment_data.issue_id;
    let content = comment_data.content;
    let author_id = user.id;

    let stmt = SeaQuery::select()
        .column("project_id")
        .from("issues")
        .and_where(Expr::col("id").eq(issue_id))
        .to_owned();
    
    let issue_info: Option<i64> = crate::db::fetch_scalar_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        
    if let Some(pid) = issue_info {
        if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }
    }

    let comment_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("comments")
        .columns(["id", "issue_id", "author_id", "content", "created_at", "updated_at"])
        .values_panic([
            comment_id.into(),
            issue_id.into(),
            author_id.into(),
            content.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(attachment_ids) = comment_data.attachment_ids {
        for aid in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("comment_id", comment_id)
                .value("issue_id", issue_id)
                .and_where(Expr::col("id").eq(aid))
                .to_owned();
            
            crate::db::execute(&*pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }
    }

    Ok(Json(json!({ "success": true, "id": comment_id.to_string() })))
}
