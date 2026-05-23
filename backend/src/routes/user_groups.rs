use axum::{
    extract::{Extension, Path},
    response::Json,
    http::StatusCode,
    routing::{get, put, delete},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery, OnConflict};
use crate::auth::AuthUser;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/chat/user-groups", get(list_user_groups).post(create_user_group))
            .route("/chat/user-groups/:id", put(update_user_group).delete(delete_user_group))
            .route("/chat/user-groups/:id/members", get(get_group_members).post(add_group_members))
            .route("/chat/user-groups/:id/members/:user_id", delete(remove_group_member)),
    )
}

async fn list_user_groups(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .columns(["id", "name", "user_id", "created_at"])
        .from("user_groups")
        .and_where(Expr::col("user_id").eq(user.id))
        .order_by("created_at", Order::Desc)
        .to_owned();
    let groups = crate::db::fetch_all(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = groups.into_iter().map(|g| {
        json!({
            "id": g.get::<i64, _>("id").to_string(),
            "name": g.get::<String, _>("name"),
            "user_id": g.get::<i64, _>("user_id").to_string(),
            "created_at": g.get::<String, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn create_user_group(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let name = body.get("name").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "name is required"}))))?;

    let group_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("user_groups")
        .columns(["id", "name", "user_id", "created_at"])
        .values_panic([group_id.into(), name.into(), user.id.into(), crate::db::now_string().into()])
        .to_owned();
    crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Optionally add initial members
    if let Some(member_ids) = body.get("member_ids").and_then(|v| v.as_array()) {
        for member_val in member_ids {
            if let Some(member_id) = member_val.as_i64() {
                let stmt = SeaQuery::insert()
                    .into_table("user_group_members")
                    .columns(["id", "group_id", "user_id"])
                    .values_panic([crate::db::new_id().into(), group_id.into(), member_id.into()])
                    .on_conflict(OnConflict::new().do_nothing().to_owned())
                    .to_owned();
                let _ = crate::db::execute(&pool, &stmt).await;
            }
        }
    }

    Ok(Json(json!({ "success": true, "id": group_id.to_string() })))
}

async fn update_user_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let name = body.get("name").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "name is required"}))))?;

    let stmt = SeaQuery::update()
        .table("user_groups")
        .value("name", name)
        .and_where(Expr::col("id").eq(id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();
    let result = crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found or not authorized"}))));
    }

    Ok(Json(json!({ "success": true })))
}

async fn delete_user_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::delete()
        .from_table("user_groups")
        .and_where(Expr::col("id").eq(id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();
    let result = crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found or not authorized"}))));
    }

    Ok(Json(json!({ "success": true })))
}

async fn get_group_members(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // Verify group belongs to current user
    let stmt = SeaQuery::select()
        .column("id")
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();
    let group = crate::db::fetch_optional(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if group.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found or not authorized"}))));
    }

    let stmt = SeaQuery::select()
        .expr(Expr::col(("ugm", Asterisk)))
        .expr_as(Expr::col(("u", "login")), "login")
        .expr_as(Expr::col(("u", "email")), "email")
        .expr_as(Expr::col(("u", "firstname")), "firstname")
        .expr_as(Expr::col(("u", "lastname")), "lastname")
        .from_as("user_group_members", "ugm")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("ugm", "user_id")))
        .and_where(Expr::col(("ugm", "group_id")).eq(id))
        .to_owned();
    let members = crate::db::fetch_all(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = members.into_iter().map(|m| {
        json!({
            "id": m.get::<i64, _>("id").to_string(),
            "user_id": m.get::<i64, _>("user_id").to_string(),
            "login": m.get::<String, _>("login"),
            "email": m.get::<String, _>("email"),
            "firstname": m.get::<String, _>("firstname"),
            "lastname": m.get::<String, _>("lastname"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn add_group_members(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // Verify group belongs to current user
    let stmt = SeaQuery::select()
        .column("id")
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();
    let group = crate::db::fetch_optional(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if group.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found or not authorized"}))));
    }

    let user_ids = body.get("user_ids").and_then(|v| v.as_array()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_ids is required"}))))?;

    for member_val in user_ids {
        if let Some(member_id) = member_val.as_i64() {
            let stmt = SeaQuery::insert()
                .into_table("user_group_members")
                .columns(["id", "group_id", "user_id"])
                .values_panic([crate::db::new_id().into(), id.into(), member_id.into()])
                .on_conflict(OnConflict::new().do_nothing().to_owned())
                .to_owned();
            let _ = crate::db::execute_ignore(&pool, &stmt).await;
        }
    }

    Ok(Json(json!({ "success": true })))
}

async fn remove_group_member(
    Path((group_id_str, user_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let group_id = crate::serde_utils::parse_path_id(&group_id_str)?;
    let user_id = crate::serde_utils::parse_path_id(&user_id_str)?;
    // Verify group belongs to current user
    let stmt = SeaQuery::select()
        .column("id")
        .from("user_groups")
        .and_where(Expr::col("id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();
    let group = crate::db::fetch_optional(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;



    if group.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found or not authorized"}))));
    }

    let stmt = SeaQuery::delete()
        .from_table("user_group_members")
        .and_where(Expr::col("group_id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
