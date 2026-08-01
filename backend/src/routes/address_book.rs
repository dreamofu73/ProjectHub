use axum::{
    extract::{Extension, Path},
    response::Json,
    http::StatusCode,
    routing::{get, delete},
    Router,
};
use std::sync::Arc;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use crate::auth::AuthUser;
use sea_query::{Expr, Query as SeaQuery, Order, Func, JoinType, ExprTrait, OnConflict};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/address-book/groups", get(list_groups).post(create_group))
            .route("/address-book/groups/:id", get(get_group).put(update_group).delete(delete_group))
            .route("/address-book/groups/:id/members", get(list_members).post(add_members))
            .route("/address-book/groups/:id/members/:user_id", delete(remove_member)),
    )
}

#[derive(Deserialize)]
struct CreateGroupPayload {
    name: String,
}

#[derive(Deserialize)]
struct UpdateGroupPayload {
    name: String,
}

#[derive(Deserialize)]
struct AddMembersPayload {
    #[serde(deserialize_with = "crate::serde_utils::vec_string_or_number")]
    user_ids: Vec<i64>,
}

// ─── List User's Groups ───────────────────────────────────────────

async fn list_groups(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .columns(["id", "user_id", "name", "created_at", "updated_at"])
        .from("address_book_groups")
        .and_where(Expr::col("user_id").eq(user.id))
        .order_by("created_at", Order::Desc)
        .to_owned();

    let groups = crate::db::fetch_all(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    // Attach member count for each group
    let mut result = Vec::new();
    for row in &groups {
        let id: i64 = row.get("id");
        let user_id: i64 = row.get("user_id");
        let name: String = row.get("name");
        let created_at: String = row.get("created_at");
        let updated_at: String = row.get("updated_at");

        let count_stmt = SeaQuery::select()
            .expr(Func::count(Expr::col("id")))
            .from("address_book_members")
            .and_where(Expr::col("group_id").eq(id).into())
            .to_owned();
        
        let count: i64 = crate::db::fetch_scalar(&pool, &count_stmt).await.unwrap_or(0);

        result.push(json!({
            "id": id.to_string(),
            "user_id": user_id.to_string(),
            "name": name,
            "member_count": count,
            "created_at": created_at,
            "updated_at": updated_at,
        }));
    }

    Ok(Json(json!({"success": true, "data": result})))
}

// ─── Get Single Group ─────────────────────────────────────────────

async fn get_group(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Path(id_str): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;

    let stmt = SeaQuery::select()
        .columns(["id", "user_id", "name", "created_at", "updated_at"])
        .from("address_book_groups")
        .and_where(Expr::col("id").eq(id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();

    let row = crate::db::fetch_optional(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    let row = match row {
        Some(r) => r,
        None => return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "그룹을 찾을 수 없습니다."})))),
    };

    let group_id: i64 = row.get("id");
    let user_id: i64 = row.get("user_id");
    let name: String = row.get("name");
    let created_at: String = row.get("created_at");
    let updated_at: String = row.get("updated_at");

    let count_stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("address_book_members")
        .and_where(Expr::col("group_id").eq(group_id).into())
        .to_owned();

    let count: i64 = crate::db::fetch_scalar(&pool, &count_stmt).await.unwrap_or(0);

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": group_id.to_string(),
            "user_id": user_id.to_string(),
            "name": name,
            "member_count": count,
            "created_at": created_at,
            "updated_at": updated_at,
        }
    })))
}

// ─── Create Group ─────────────────────────────────────────────────

async fn create_group(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Json(payload): Json<CreateGroupPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "그룹 이름을 입력하세요."}))));
    }

    let group_id = crate::db::new_id();

    let stmt = SeaQuery::insert()
        .into_table("address_book_groups")
        .columns(["id", "user_id", "name", "created_at", "updated_at"])
        .values_panic([group_id.into(), user.id.into(), name.clone().into(), crate::db::now_string().into(), crate::db::now_string().into()])
        .to_owned();

    crate::db::execute(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": group_id.to_string(),
            "user_id": user.id.to_string(),
            "name": name,
            "member_count": 0,
        }
    })))
}

// ─── Update Group Name ────────────────────────────────────────────

async fn update_group(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Path(id_str): Path<String>,
    Json(payload): Json<UpdateGroupPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "그룹 이름을 입력하세요."}))));
    }

    let count_stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("address_book_groups")
        .and_where(Expr::col("id").eq(id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();
    
    let owned: i64 = crate::db::fetch_scalar(&pool, &count_stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    if owned == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "그룹을 찾을 수 없습니다."}))));
    }

    let stmt = SeaQuery::update()
        .table("address_book_groups")
        .value("name", name.clone())
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();
    
    crate::db::execute(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    Ok(Json(json!({"success": true, "data": {"id": id.to_string(), "name": name}})))
}

// ─── Delete Group ─────────────────────────────────────────────────

async fn delete_group(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Path(id_str): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // Verify ownership
    let count_stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("address_book_groups")
        .and_where(Expr::col("id").eq(id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();
    
    let owned: i64 = crate::db::fetch_scalar(&pool, &count_stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    if owned == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "그룹을 찾을 수 없습니다."}))));
    }

    // Members are cascade-deleted by FK
    let stmt = SeaQuery::delete()
        .from_table("address_book_groups")
        .and_where(Expr::col("id").eq(id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();
    
    crate::db::execute(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    Ok(Json(json!({"success": true, "data": null})))
}

// ─── List Group Members ──────────────────────────────────────────

async fn list_members(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Path(id_str): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // Verify the group belongs to current user
    let count_stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("address_book_groups")
        .and_where(Expr::col("id").eq(id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();
    
    let owned: i64 = crate::db::fetch_scalar(&pool, &count_stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    if owned == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "그룹을 찾을 수 없습니다."}))));
    }

    let stmt = SeaQuery::select()
        .columns([("m", "id"), ("m", "group_id"), ("m", "user_id"), ("m", "created_at")])
        .expr_as(Expr::col(("u", "login")), "login")
        .expr_as(Expr::col(("u", "email")), "email")
        .expr_as(Expr::col(("u", "firstname")), "firstname")
        .expr_as(Expr::col(("u", "lastname")), "lastname")
        .from_as("address_book_members", "m")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("m", "user_id")))
        .and_where(Expr::col(("m", "group_id")).eq(id).into())
        .order_by(("m", "created_at"), Order::Desc)
        .to_owned();
    
    let rows = crate::db::fetch_all(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;
    
    let members: Vec<Value> = rows.iter().map(|row| {
        json!({
            "id": row.get::<i64, _>("id").to_string(),
            "group_id": row.get::<i64, _>("group_id").to_string(),
            "user_id": row.get::<i64, _>("user_id").to_string(),
            "login": row.get::<String, _>("login"),
            "email": row.get::<String, _>("email"),
            "firstname": row.get::<String, _>("firstname"),
            "lastname": row.get::<String, _>("lastname"),
            "created_at": row.get::<String, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!({"success": true, "data": members})))
}

// ─── Add Members to Group ─────────────────────────────────────────

async fn add_members(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Path(id_str): Path<String>,
    Json(payload): Json<AddMembersPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // Verify ownership
    let count_stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("address_book_groups")
        .and_where(Expr::col("id").eq(id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();
    
    let owned: i64 = crate::db::fetch_scalar(&pool, &count_stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    if owned == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "그룹을 찾을 수 없습니다."}))));
    }

    if payload.user_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "추가할 사용자를 선택하세요."}))));
    }

    let mut added = 0;
    let mut skipped = 0;

    for uid in &payload.user_ids {
        let member_id = crate::db::new_id();
        let stmt = SeaQuery::insert()
            .into_table("address_book_members")
            .columns(["id", "group_id", "user_id", "created_at"])
            .values_panic([member_id.into(), id.into(), (*uid).into(), crate::db::now_string().into()])
            .on_conflict(OnConflict::columns(["group_id", "user_id"]).do_nothing().to_owned())
            .to_owned();

        let result = crate::db::execute(&pool, &stmt).await.map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
        })?;

        if result.rows_affected() > 0 {
            added += 1;
        } else {
            skipped += 1;
        }
    }

    Ok(Json(json!({"success": true, "data": {"added": added, "skipped": skipped}})))
}

// ─── Remove Member from Group ─────────────────────────────────────

async fn remove_member(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Path((group_id_str, user_id_str)): Path<(String, String)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let group_id = crate::serde_utils::parse_path_id(&group_id_str)?;
    let user_id = crate::serde_utils::parse_path_id(&user_id_str)?;
    // Verify ownership
    let count_stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("address_book_groups")
        .and_where(Expr::col("id").eq(group_id).into())
        .and_where(Expr::col("user_id").eq(user.id).into())
        .to_owned();
    
    let owned: i64 = crate::db::fetch_scalar(&pool, &count_stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    if owned == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "그룹을 찾을 수 없습니다."}))));
    }

    let stmt = SeaQuery::delete()
        .from_table("address_book_members")
        .and_where(Expr::col("group_id").eq(group_id).into())
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    
    crate::db::execute(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    Ok(Json(json!({"success": true, "data": null})))
}
