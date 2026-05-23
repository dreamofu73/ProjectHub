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
use sea_query::{Expr, ExprTrait, Order, Query as SeaQuery};
use crate::auth::AuthUser;
use std::collections::HashMap;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/notifications", get(get_notifications))
            .route("/notifications/:id/read", put(read_notification))
            .route("/notifications/read-all", put(read_all_notifications)),
    )
}

// 1. 알림 목록 조회
async fn get_notifications(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let unread_only = params.get("unread_only").map(|v| v == "true").unwrap_or(false);

    let mut stmt = SeaQuery::select();
    stmt.columns(["id", "user_id", "type", "title", "message", "link", "is_read", "created_at"])
        .from("notifications")
        .and_where(Expr::col("user_id").eq(user.id))
        .order_by("created_at", Order::Desc);
    if unread_only {
        stmt.and_where(Expr::col("is_read").eq(0i64));
    }

    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut list = Vec::new();
    for row in rows {
        list.push(json!({
            "id": row.get::<String, _>("id"),
            "user_id": row.get::<i64, _>("user_id").to_string(),
            "type": row.get::<String, _>("type"),
            "title": row.get::<String, _>("title"),
            "message": row.get::<String, _>("message"),
            "link": row.get::<Option<String>, _>("link"),
            "is_read": row.get::<i64, _>("is_read"),
            "created_at": row.get::<String, _>("created_at"),
        }));
    }

    Ok(Json(json!({ "success": true, "data": list })))
}

// 2. 개별 알림 읽음 처리
async fn read_notification(
    user: AuthUser,
    Path(id): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::update()
        .table("notifications")
        .value("is_read", 1i64)
        .and_where(Expr::col("id").eq(id.clone()))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();

    let res = crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Notification not found or access denied"}))));
    }

    Ok(Json(json!({ "success": true })))
}

// 3. 전체 알림 읽음 처리
async fn read_all_notifications(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::update()
        .table("notifications")
        .value("is_read", 1i64)
        .and_where(Expr::col("user_id").eq(user.id))
        .and_where(Expr::col("is_read").eq(0i64))
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
