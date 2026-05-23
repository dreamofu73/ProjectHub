use axum::{
    extract::{Extension, Path},
    response::Json,
    http::StatusCode,
    routing::{get, delete},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery};
use crate::auth::AuthUser;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/admin/groups", get(admin_list_groups))
            .route("/admin/groups/:id", get(admin_get_group))
            .route("/admin/groups/:id", delete(admin_delete_group)),
    )
}

async fn admin_list_groups(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let stmt = SeaQuery::select()
        .expr(Expr::col(("ug", Asterisk)))
        .expr_as(
            Expr::cust("(SELECT COUNT(*) FROM user_group_members WHERE group_id = ug.id)"),
            "member_count",
        )
        .expr_as(Expr::col(("u", "login")), "owner_login")
        .from_as("user_groups", "ug")
        .join_as(
            JoinType::LeftJoin,
            "users",
            "u",
            Expr::col(("u", "id")).equals(("ug", "owner_id")),
        )
        .order_by(("ug", "created_at"), Order::Desc)
        .to_owned();

    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "name": r.get::<String, _>("name"),
            "description": r.get::<String, _>("description"),
            "user_id": r.get::<i64, _>("user_id").to_string(),
            "owner_id": r.get::<Option<i64>, _>("owner_id").map(|v| v.to_string()),
            "owner_login": r.get::<Option<String>, _>("owner_login"),
            "is_shared": r.get::<i64, _>("is_shared"),
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": r.get::<String, _>("updated_at"),
            "member_count": r.get::<i64, _>("member_count"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn admin_get_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let group_stmt = SeaQuery::select()
        .expr(Expr::col(("ug", Asterisk)))
        .expr_as(Expr::col(("u", "login")), "owner_login")
        .from_as("user_groups", "ug")
        .join_as(
            JoinType::LeftJoin,
            "users",
            "u",
            Expr::col(("u", "id")).equals(("ug", "owner_id")),
        )
        .and_where(Expr::col(("ug", "id")).eq(id))
        .to_owned();

    let group = crate::db::fetch_optional(&pool, &group_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    // Get members
    let members_stmt = SeaQuery::select()
        .columns([
            ("ugm", "id"),
            ("ugm", "user_id"),
            ("ugm", "role"),
            ("ugm", "joined_at"),
            ("ugm", "invited_by"),
        ])
        .columns([("u", "login"), ("u", "email"), ("u", "firstname"), ("u", "lastname")])
        .from_as("user_group_members", "ugm")
        .join_as(
            JoinType::InnerJoin,
            "users",
            "u",
            Expr::col(("u", "id")).equals(("ugm", "user_id")),
        )
        .and_where(Expr::col(("ugm", "group_id")).eq(id))
        .order_by(("ugm", "role"), Order::Asc)
        .order_by(("u", "login"), Order::Asc)
        .to_owned();

    let members = crate::db::fetch_all(&pool, &members_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let member_list: Vec<Value> = members.into_iter().map(|m| {
        json!({
            "id": m.get::<i64, _>("id").to_string(),
            "user_id": m.get::<i64, _>("user_id").to_string(),
            "role": m.get::<String, _>("role"),
            "joined_at": m.get::<Option<String>, _>("joined_at"),
            "invited_by": m.get::<Option<i64>, _>("invited_by").map(|v| v.to_string()),
            "login": m.get::<String, _>("login"),
            "email": m.get::<String, _>("email"),
        })
    }).collect();

    // Get resource shares
    let shares_stmt = SeaQuery::select()
        .expr(Expr::col(Asterisk))
        .from("group_resource_shares")
        .and_where(Expr::col("group_id").eq(id))
        .order_by("created_at", Order::Desc)
        .to_owned();

    let shares = crate::db::fetch_all(&pool, &shares_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let share_list: Vec<Value> = shares.into_iter().map(|s| {
        json!({
            "id": s.get::<i64, _>("id").to_string(),
            "resource_type": s.get::<String, _>("resource_type"),
            "resource_id": s.get::<i64, _>("resource_id").to_string(),
            "permission_level": s.get::<String, _>("permission_level"),
            "shared_by": s.get::<i64, _>("shared_by").to_string(),
            "created_at": s.get::<String, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": group.get::<i64, _>("id").to_string(),
            "name": group.get::<String, _>("name"),
            "description": group.get::<String, _>("description"),
            "user_id": group.get::<i64, _>("user_id").to_string(),
            "owner_id": group.get::<Option<i64>, _>("owner_id").map(|v| v.to_string()),
            "owner_login": group.get::<Option<String>, _>("owner_login"),
            "is_shared": group.get::<i64, _>("is_shared"),
            "created_at": group.get::<String, _>("created_at"),
            "updated_at": group.get::<String, _>("updated_at"),
            "members": member_list,
            "shares": share_list,
        }
    })))
}

async fn admin_delete_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    // Verify group exists
    let exists_stmt = SeaQuery::select()
        .column("id")
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();

    crate::db::fetch_optional(&pool, &exists_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    // Delete resource shares
    let shares_stmt = SeaQuery::delete()
        .from_table("group_resource_shares")
        .and_where(Expr::col("group_id").eq(id))
        .to_owned();
    crate::db::execute_ignore(&pool, &shares_stmt).await;

    // Delete group (cascade deletes members via FK)
    let group_stmt = SeaQuery::delete()
        .from_table("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &group_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
