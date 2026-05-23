use axum::{
    extract::{Extension, Path, Query},
    response::Json,
    http::StatusCode,
    routing::{get, put},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use std::collections::HashMap;
use crate::auth::AuthUser;
use crate::routes::utils::{check_project_access, require_project_member};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery, Func};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/milestones", get(get_milestones).post(create_milestone))
            .route("/milestones/:id", put(update_milestone).delete(delete_milestone)),
    )
}

async fn get_milestones(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = params.get("project_id").and_then(|v| v.parse::<i64>().ok());
    let status = params.get("status").cloned();

    if let Some(pid) = project_id {
        check_project_access(&pool, &user, &pid.to_string()).await?;
    } else if user.role != "admin" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "project_id is required for non-admins"}))));
    }

    let mut stmt = SeaQuery::select()
        .expr(Expr::col(("m", Asterisk)))
        .expr_as(Func::count(Expr::col(("i", "id"))), "issue_count")
        .expr_as(Func::count(Expr::case(Expr::col(("i", "status")).is_in(["closed", "rejected"]), 1)), "closed_issue_count")
        .from_as("milestones", "m")
        .join_as(JoinType::LeftJoin, "issues", "i", Expr::col(("i", "milestone_id")).equals(("m", "id")))
        .group_by_col(("m", "id"))
        .order_by(("m", "due_date"), Order::Asc)
        .order_by(("m", "name"), Order::Asc)
        .to_owned();

    if let Some(pid) = project_id {
        stmt.and_where(Expr::col(("m", "project_id")).eq(pid));
    }
    if let Some(s) = status {
        stmt.and_where(Expr::col(("m", "status")).eq(s));
    }

    let rows = crate::db::fetch_all(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let milestones: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "project_id": r.get::<i64, _>("project_id").to_string(),
            "name": r.get::<String, _>("name"),
            "subject": r.get::<String, _>("name"),
            "description": r.get::<Option<String>, _>("description"),
            "status": r.get::<String, _>("status"),
            "due_date": r.get::<Option<String>, _>("due_date"),
            "issue_count": r.get::<i64, _>("issue_count"),
            "closed_issue_count": r.get::<i64, _>("closed_issue_count")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": milestones })))
}

async fn create_milestone(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(milestone_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = milestone_data.get("project_id")
        .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok())))
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "project_id is required"}))))?;

    require_project_member(&pool, &user, project_id).await?;

    // Authoritative field is `name`; accept `subject` as a legacy alias.
    let name = milestone_data.get("name").and_then(|v| v.as_str())
        .or_else(|| milestone_data.get("subject").and_then(|v| v.as_str()))
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "name is required"}))))?;
    let description = milestone_data.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let due_date = milestone_data.get("due_date").and_then(|v| v.as_str());
    let status = milestone_data.get("status").and_then(|v| v.as_str()).unwrap_or("open");

    let now = crate::db::now_string();
    let milestone_id = crate::db::new_id();

    let stmt = SeaQuery::insert()
        .into_table("milestones")
        .columns(["id", "project_id", "name", "description", "due_date", "status", "created_at", "updated_at"])
        .values_panic([milestone_id.into(), project_id.into(), name.into(), description.into(), due_date.into(), status.into(), now.clone().into(), now.clone().into()])
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::insert()
        .into_table("activity_logs")
        .columns(["id", "project_id", "user_id", "action_type", "subject_type", "subject_id", "subject_title", "created_at"])
        .values_panic([crate::db::new_id().into(), project_id.into(), user.id.into(), "created".into(), "milestone".into(), milestone_id.into(), name.into(), now.into()])
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "id": milestone_id.to_string() })))
}

async fn update_milestone(
    Path(id): Path<i64>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(milestone_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("milestones")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let milestone_info = crate::db::fetch_optional(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Milestone not found"}))))?;

    let project_id: i64 = milestone_info.get("project_id");
    require_project_member(&pool, &user, project_id).await?;

    let name = milestone_data.get("name").and_then(|v| v.as_str())
        .or_else(|| milestone_data.get("subject").and_then(|v| v.as_str()));
    let description = milestone_data.get("description").and_then(|v| v.as_str());
    let status = milestone_data.get("status").and_then(|v| v.as_str());
    let due_date = milestone_data.get("due_date").and_then(|v| v.as_str());

    let mut update = SeaQuery::update();
    update.table("milestones");
    update.value("updated_at", crate::db::now_string());
    update.and_where(Expr::col("id").eq(id));

    if let Some(n) = name { update.value("name", n); }
    if let Some(d) = description { update.value("description", d); }
    if let Some(s) = status { update.value("status", s); }
    if let Some(d) = due_date { update.value("due_date", d); }

    crate::db::execute(&pool, &update).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn delete_milestone(
    Path(id): Path<i64>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("milestones")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let milestone_info = crate::db::fetch_optional(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Milestone not found"}))))?;

    let project_id: i64 = milestone_info.get("project_id");
    require_project_member(&pool, &user, project_id).await?;

    let stmt = SeaQuery::delete()
        .from_table("milestones")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
