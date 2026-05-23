use axum::{
    extract::{Extension, Path},
    response::Json,
    http::StatusCode,
    routing::{get, post, put, delete},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery, Func, OnConflict};
use sqlx::{AnyPool, Row};
use crate::auth::AuthUser;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/groups", get(list_groups).post(create_group))
            .route("/groups/:id", get(get_group).put(update_group).delete(delete_group))
            .route("/groups/:id/transfer", post(transfer_group))
            .route("/groups/:id/members", get(list_members).post(add_member))
            .route("/groups/:id/members/:user_id", put(update_member_role).delete(remove_member))
            .route("/groups/:id/shares", get(list_shares).post(create_share))
            .route("/groups/:id/shares/:share_id", delete(delete_share))
            .route("/groups/:id/chat-room", post(create_chat_room)),
    )
}

// ── Permission helpers ──

async fn require_group_member(
    pool: &AnyPool,
    user: &AuthUser,
    group_id: i64,
) -> Result<(), (StatusCode, Json<Value>)> {
    if user.role == "admin" {
        return Ok(());
    }

    // Check if user is the group owner
    let stmt = SeaQuery::select()
        .columns(["id", "user_id", "owner_id"])
        .from("user_groups")
        .and_where(Expr::col("id").eq(group_id))
        .to_owned();
    let group = crate::db::fetch_optional(pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    let owner_id: Option<i64> = group.get("owner_id");
    let creator_id: i64 = group.get("user_id");

    if owner_id == Some(user.id) || creator_id == user.id {
        return Ok(());
    }

    // Check membership
    let stmt = SeaQuery::select()
        .expr(Expr::val(1))
        .from("user_group_members")
        .and_where(Expr::col("group_id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();
    let member = crate::db::fetch_optional(pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if member.is_some() {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "그룹 멤버만 접근 가능합니다."}))))
    }
}

async fn require_group_admin(
    pool: &AnyPool,
    user: &AuthUser,
    group_id: i64,
) -> Result<(), (StatusCode, Json<Value>)> {
    if user.role == "admin" {
        return Ok(());
    }

    // Check if user is the group owner
    let stmt = SeaQuery::select()
        .columns(["id", "user_id", "owner_id"])
        .from("user_groups")
        .and_where(Expr::col("id").eq(group_id))
        .to_owned();
    let group = crate::db::fetch_optional(pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    let owner_id: Option<i64> = group.get("owner_id");
    let creator_id: i64 = group.get("user_id");

    if owner_id == Some(user.id) || creator_id == user.id {
        return Ok(());
    }

    // Check admin role in group_members
    let stmt = SeaQuery::select()
        .column("role")
        .from("user_group_members")
        .and_where(Expr::col("group_id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user.id))
        .to_owned();
    let role: Option<String> = crate::db::fetch_scalar_optional(pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    match role {
        Some(r) if r == "owner" || r == "admin" => Ok(()),
        _ => Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "그룹 관리 권한이 없습니다."})))),
    }
}

// ── Group CRUD ──

async fn list_groups(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Groups where user is owner or member
    let stmt = SeaQuery::select()
        .expr(Expr::col(("ug", Asterisk)))
        .from_as("user_groups", "ug")
        .join_as(JoinType::LeftJoin, "user_group_members", "ugm", Expr::col(("ugm", "group_id")).equals(("ug", "id")))
        .distinct()
        .and_where(
            Expr::col(("ug", "owner_id")).eq(user.id)
            .or(Expr::col(("ug", "user_id")).eq(user.id))
            .or(Expr::col(("ugm", "user_id")).eq(user.id))
        )
        .order_by(("ug", "created_at"), Order::Desc)
        .to_owned();
    let groups = crate::db::fetch_all(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = groups.into_iter().map(|g| {
        json!({
            "id": g.get::<i64, _>("id").to_string(),
            "name": g.get::<String, _>("name"),
            "description": g.get::<String, _>("description"),
            "user_id": g.get::<i64, _>("user_id").to_string(),
            "owner_id": g.get::<Option<i64>, _>("owner_id").map(|v| v.to_string()),
            "is_shared": g.get::<i64, _>("is_shared"),
            "created_at": g.get::<String, _>("created_at"),
            "updated_at": g.get::<String, _>("updated_at"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn create_group(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let name = body.get("name").and_then(|v| v.as_str()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "name is required"})))
    })?;

    if name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "name cannot be empty"}))));
    }

    let description = body.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let is_shared = body.get("is_shared").and_then(|v| v.as_i64()).unwrap_or(0);

    let new_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("user_groups")
        .columns(["id", "name", "description", "user_id", "owner_id", "is_shared", "created_at", "updated_at"])
        .values_panic([
            new_id.into(),
            name.into(),
            description.into(),
            user.id.into(),
            user.id.into(),
            is_shared.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Add creator as member with role 'owner'
    let stmt = SeaQuery::insert()
        .into_table("user_group_members")
        .columns(["id", "group_id", "user_id", "role", "joined_at", "invited_by"])
        .values_panic([
            crate::db::new_id().into(),
            new_id.into(),
            user.id.into(),
            "owner".into(),
            crate::db::now_string().into(),
            user.id.into(),
        ])
        .on_conflict(
            OnConflict::columns(["group_id", "user_id"])
                .do_nothing()
                .to_owned()
        )
        .to_owned();
    let _ = crate::db::execute(&*pool, &stmt).await;

    // Add initial members if provided
    if let Some(member_ids) = body.get("member_ids").and_then(|v| v.as_array()) {
        for member_val in member_ids {
            if let Some(member_id) = crate::serde_utils::value_to_opt_i64(member_val) {
                let stmt = SeaQuery::insert()
                    .into_table("user_group_members")
                    .columns(["id", "group_id", "user_id", "role", "joined_at", "invited_by"])
                    .values_panic([
                        crate::db::new_id().into(),
                        new_id.into(),
                        member_id.into(),
                        "member".into(),
                        crate::db::now_string().into(),
                        user.id.into(),
                    ])
                    .on_conflict(
                        OnConflict::columns(["group_id", "user_id"])
                            .do_nothing()
                            .to_owned()
                    )
                    .to_owned();
                let _ = crate::db::execute(&*pool, &stmt).await;
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": new_id.to_string(),
            "name": name,
            "description": description,
            "user_id": user.id.to_string(),
            "owner_id": user.id.to_string(),
            "is_shared": is_shared,
            "member_count": 1,
            "created_at": crate::db::now_string(),
            "updated_at": crate::db::now_string(),
        }
    })))
}

async fn get_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_member(&pool, &user, id).await?;

    let stmt = SeaQuery::select()
        .expr(Expr::col(Asterisk))
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let group = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    // Get member count
    let stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("user_group_members")
        .and_where(Expr::col("group_id").eq(id))
        .to_owned();
    let count: i64 = crate::db::fetch_scalar(&*pool, &stmt).await
        .unwrap_or(0);

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": group.get::<i64, _>("id").to_string(),
            "name": group.get::<String, _>("name"),
            "description": group.get::<String, _>("description"),
            "user_id": group.get::<i64, _>("user_id").to_string(),
            "owner_id": group.get::<Option<i64>, _>("owner_id").map(|v| v.to_string()),
            "is_shared": group.get::<i64, _>("is_shared"),
            "created_at": group.get::<String, _>("created_at"),
            "updated_at": group.get::<String, _>("updated_at"),
            "member_count": count,
        }
    })))
}

async fn update_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_admin(&pool, &user, id).await?;

    let stmt = SeaQuery::select()
        .columns(["name", "description", "is_shared"])
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let current = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    let name = body.get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| current.get::<String, _>("name"));

    let description = body.get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| current.get::<String, _>("description"));

    let is_shared = body.get("is_shared")
        .and_then(|v| v.as_i64())
        .unwrap_or_else(|| current.get::<i64, _>("is_shared"));

    let stmt = SeaQuery::update()
        .table("user_groups")
        .value("name", name)
        .value("description", description)
        .value("is_shared", is_shared)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let result = crate::db::execute(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))));
    }

    // Return updated group
    let stmt = SeaQuery::select()
        .columns(["id", "name", "description", "user_id", "owner_id", "is_shared", "created_at", "updated_at"])
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let updated = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": updated.get::<i64, _>("id").to_string(),
            "name": updated.get::<String, _>("name"),
            "description": updated.get::<String, _>("description"),
            "user_id": updated.get::<i64, _>("user_id").to_string(),
            "owner_id": updated.get::<Option<i64>, _>("owner_id").map(|v| v.to_string()),
            "is_shared": updated.get::<i64, _>("is_shared"),
            "created_at": updated.get::<String, _>("created_at"),
            "updated_at": updated.get::<String, _>("updated_at"),
        }
    })))
}

async fn delete_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_admin(&pool, &user, id).await?;

    // Delete associated resource shares first
    let stmt = SeaQuery::delete()
        .from_table("group_resource_shares")
        .and_where(Expr::col("group_id").eq(id))
        .to_owned();
    let _ = crate::db::execute(&*pool, &stmt).await;

    // Members are cascade-deleted via FK
    let stmt = SeaQuery::delete()
        .from_table("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let result = crate::db::execute(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))));
    }

    Ok(Json(json!({ "success": true })))
}

async fn transfer_group(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let new_owner_id = body.get("new_owner_id").and_then(crate::serde_utils::value_to_opt_i64).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "new_owner_id is required"})))
    })?;

    // Only current owner can transfer
    let stmt = SeaQuery::select()
        .columns(["id", "user_id", "owner_id"])
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let group = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    let owner_id: Option<i64> = group.get("owner_id");
    let creator_id: i64 = group.get("user_id");

    let is_owner = user.role == "admin"
        || owner_id == Some(user.id)
        || (owner_id.is_none() && creator_id == user.id);

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "그룹 소유자만 소유권을 이전할 수 있습니다."}))));
    }

    if new_owner_id == creator_id || (owner_id.is_some() && new_owner_id == owner_id.unwrap()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "이미 해당 사용자가 소유자입니다."}))));
    }

    // Verify new owner is a member
    let stmt = SeaQuery::select()
        .expr(Expr::val(1))
        .from("user_group_members")
        .and_where(Expr::col("group_id").eq(id))
        .and_where(Expr::col("user_id").eq(new_owner_id))
        .to_owned();
    let member = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if member.is_none() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "새 소유자는 그룹 멤버여야 합니다."}))));
    }

    // Update owner_id
    let stmt = SeaQuery::update()
        .table("user_groups")
        .value("owner_id", new_owner_id)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Update roles: new owner gets 'owner', old owner gets 'admin'
    let stmt = SeaQuery::update()
        .table("user_group_members")
        .value("role", "owner")
        .and_where(Expr::col("group_id").eq(id))
        .and_where(Expr::col("user_id").eq(new_owner_id))
        .to_owned();
    crate::db::execute(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Demote old owner to admin
    let old_owner_id = owner_id.unwrap_or(creator_id);
    if old_owner_id != new_owner_id {
        let stmt = SeaQuery::update()
            .table("user_group_members")
            .value("role", "admin")
            .and_where(Expr::col("group_id").eq(id))
            .and_where(Expr::col("user_id").eq(old_owner_id))
            .to_owned();
        crate::db::execute(&*pool, &stmt).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    }

    Ok(Json(json!({ "success": true })))
}

// ── Member Management ──

async fn list_members(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_member(&pool, &user, id).await?;

    let stmt = SeaQuery::select()
        .column(("ugm", "id"))
        .column(("ugm", "user_id"))
        .column(("ugm", "role"))
        .column(("ugm", "joined_at"))
        .column(("ugm", "invited_by"))
        .column(("u", "login"))
        .column(("u", "email"))
        .column(("u", "firstname"))
        .column(("u", "lastname"))
        .from_as("user_group_members", "ugm")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("ugm", "user_id")))
        .and_where(Expr::col(("ugm", "group_id")).eq(id))
        .order_by(("ugm", "role"), Order::Asc)
        .order_by(("u", "login"), Order::Asc)
        .to_owned();
    let members = crate::db::fetch_all(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = members.into_iter().map(|m| {
        json!({
            "id": m.get::<i64, _>("id").to_string(),
            "user_id": m.get::<i64, _>("user_id").to_string(),
            "role": m.get::<String, _>("role"),
            "joined_at": m.get::<Option<String>, _>("joined_at"),
            "invited_by": m.get::<Option<i64>, _>("invited_by").map(|v| v.to_string()),
            "login": m.get::<String, _>("login"),
            "email": m.get::<String, _>("email"),
            "firstname": m.get::<String, _>("firstname"),
            "lastname": m.get::<String, _>("lastname"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn add_member(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_admin(&pool, &user, id).await?;

    let user_ids = body.get("user_ids").and_then(|v| v.as_array()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_ids is required"})))
    })?;

    if user_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_ids cannot be empty"}))));
    }

    let role = body.get("role").and_then(|v| v.as_str()).unwrap_or("member");
    if !["member", "admin", "viewer"].contains(&role) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Invalid role. Must be one of: member, admin, viewer"}))));
    }

    for member_val in user_ids {
        if let Some(member_id) = crate::serde_utils::value_to_opt_i64(member_val) {
            let stmt = SeaQuery::insert()
                .into_table("user_group_members")
                .columns(["id", "group_id", "user_id", "role", "joined_at", "invited_by"])
                .values_panic([
                    crate::db::new_id().into(),
                    id.into(),
                    member_id.into(),
                    role.into(),
                    crate::db::now_string().into(),
                    user.id.into(),
                ])
                .on_conflict(
                    OnConflict::columns(["group_id", "user_id"])
                        .do_nothing()
                        .to_owned()
                )
                .to_owned();
            let _ = crate::db::execute(&*pool, &stmt).await;
        }
    }

    Ok(Json(json!({ "success": true })))
}

async fn update_member_role(
    Path((group_id_str, user_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let group_id = crate::serde_utils::parse_path_id(&group_id_str)?;
    let user_id = crate::serde_utils::parse_path_id(&user_id_str)?;
    require_group_admin(&pool, &user, group_id).await?;

    let new_role = body.get("role").and_then(|v| v.as_str()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "role is required"})))
    })?;

    if !["member", "admin", "viewer"].contains(&new_role) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Invalid role. Must be one of: member, admin, viewer"}))));
    }

    // Cannot change owner's role via this endpoint
    let stmt = SeaQuery::select()
        .column("role")
        .from("user_group_members")
        .and_where(Expr::col("group_id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    let current_role: Option<String> = crate::db::fetch_scalar_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    match current_role {
        Some(r) if r == "owner" => {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "소유자의 역할은 변경할 수 없습니다. 소유권 이전을 사용하세요."}))));
        }
        None => {
            return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Member not found"}))));
        }
        _ => {}
    }

    let stmt = SeaQuery::update()
        .table("user_group_members")
        .value("role", new_role)
        .and_where(Expr::col("group_id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    crate::db::execute(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn remove_member(
    Path((group_id_str, user_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let group_id = crate::serde_utils::parse_path_id(&group_id_str)?;
    let user_id = crate::serde_utils::parse_path_id(&user_id_str)?;
    require_group_admin(&pool, &user, group_id).await?;

    // Cannot remove owner
    let stmt = SeaQuery::select()
        .column("role")
        .from("user_group_members")
        .and_where(Expr::col("group_id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    let current_role: Option<String> = crate::db::fetch_scalar_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    match current_role {
        Some(r) if r == "owner" => {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "소유자는 그룹에서 제거할 수 없습니다. 소유권 이전을 사용하세요."}))));
        }
        None => {
            return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Member not found"}))));
        }
        _ => {}
    }

    let stmt = SeaQuery::delete()
        .from_table("user_group_members")
        .and_where(Expr::col("group_id").eq(group_id))
        .and_where(Expr::col("user_id").eq(user_id))
        .to_owned();
    crate::db::execute(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

// ── Resource Shares ──

async fn list_shares(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_member(&pool, &user, id).await?;

    let stmt = SeaQuery::select()
        .expr(Expr::col(Asterisk))
        .from("group_resource_shares")
        .and_where(Expr::col("group_id").eq(id))
        .order_by("created_at", Order::Desc)
        .to_owned();
    let shares = crate::db::fetch_all(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = shares.into_iter().map(|s| {
        json!({
            "id": s.get::<i64, _>("id").to_string(),
            "group_id": s.get::<i64, _>("group_id").to_string(),
            "resource_type": s.get::<String, _>("resource_type"),
            "resource_id": s.get::<i64, _>("resource_id").to_string(),
            "permission_level": s.get::<String, _>("permission_level"),
            "shared_by": s.get::<i64, _>("shared_by").to_string(),
            "created_at": s.get::<String, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn create_share(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_admin(&pool, &user, id).await?;

    let resource_type = body.get("resource_type").and_then(|v| v.as_str()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "resource_type is required"})))
    })?;

    if resource_type != "project" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Only 'project' resource type is supported currently"}))));
    }

    let resource_id = body.get("resource_id").and_then(crate::serde_utils::value_to_opt_i64).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "resource_id is required"})))
    })?;

    // Verify project exists
    let stmt = SeaQuery::select()
        .column("id")
        .from("projects")
        .and_where(Expr::col("id").eq(resource_id))
        .to_owned();
    let project = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if project.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Project not found"}))));
    }

    let permission_level = body.get("permission_level").and_then(|v| v.as_str()).unwrap_or("viewer");
    if !["viewer", "member", "admin"].contains(&permission_level) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Invalid permission_level. Must be one of: viewer, member, admin"}))));
    }

    // Check for existing share
    let stmt = SeaQuery::select()
        .column("id")
        .from("group_resource_shares")
        .and_where(Expr::col("group_id").eq(id))
        .and_where(Expr::col("resource_type").eq(resource_type))
        .and_where(Expr::col("resource_id").eq(resource_id))
        .to_owned();
    let existing: Option<i64> = crate::db::fetch_scalar_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if existing.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"success": false, "error": "Resource share already exists"}))));
    }

    let share_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("group_resource_shares")
        .columns(["id", "group_id", "resource_type", "resource_id", "permission_level", "shared_by", "created_at"])
        .values_panic([
            share_id.into(),
            id.into(),
            resource_type.into(),
            resource_id.into(),
            permission_level.into(),
            user.id.into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "id": share_id.to_string() })))
}

async fn delete_share(
    Path((group_id_str, share_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let group_id = crate::serde_utils::parse_path_id(&group_id_str)?;
    let share_id = crate::serde_utils::parse_path_id(&share_id_str)?;
    require_group_admin(&pool, &user, group_id).await?;

    let stmt = SeaQuery::delete()
        .from_table("group_resource_shares")
        .and_where(Expr::col("id").eq(share_id))
        .and_where(Expr::col("group_id").eq(group_id))
        .to_owned();
    let result = crate::db::execute(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))));
    }

    Ok(Json(json!({ "success": true })))
}

// ── Chat Room from Group ──

async fn create_chat_room(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    require_group_admin(&pool, &user, id).await?;

    // Get group info
    let stmt = SeaQuery::select()
        .column("name")
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let group = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Group not found"}))))?;

    let group_name: String = group.get("name");

    // Check if chat room already exists for this group
    let stmt = SeaQuery::select()
        .column(("cr", "id"))
        .from_as("chat_rooms", "cr")
        .join_as(JoinType::InnerJoin, "chat_room_members", "crm", Expr::col(("crm", "room_id")).equals(("cr", "id")))
        .and_where(Expr::col(("cr", "name")).eq(format!("[Group] {}", group_name)))
        .and_where(Expr::col(("crm", "user_id")).eq(user.id))
        .to_owned();
    let existing_room: Option<i64> = crate::db::fetch_scalar_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(room_id) = existing_room {
        return Ok(Json(json!({ "success": true, "id": room_id.to_string(), "existing": true })));
    }

    // Create chat room
    let room_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("chat_rooms")
        .columns(["id", "name", "created_at"])
        .values_panic([
            room_id.into(),
            format!("[Group] {}", group_name).into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Add all group members to the chat room
    let stmt = SeaQuery::select()
        .column("user_id")
        .from("user_group_members")
        .and_where(Expr::col("group_id").eq(id))
        .to_owned();
    let members = crate::db::fetch_all(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    for member in members {
        let member_id: i64 = member.get("user_id");
        let stmt = SeaQuery::insert()
            .into_table("chat_room_members")
            .columns(["id", "room_id", "user_id", "joined_at"])
            .values_panic([
                crate::db::new_id().into(),
                room_id.into(),
                member_id.into(),
                crate::db::now_string().into(),
            ])
            .on_conflict(
                OnConflict::columns(["room_id", "user_id"])
                    .do_nothing()
                    .to_owned()
            )
            .to_owned();
        let _ = crate::db::execute(&*pool, &stmt).await;
    }

    // Also add the group owner if not already a member
    let stmt = SeaQuery::select()
        .columns(["owner_id", "user_id"])
        .from("user_groups")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let group_owner = crate::db::fetch_optional(&*pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(owner_row) = group_owner {
        let owner_id: Option<i64> = owner_row.get("owner_id");
        let creator_id: i64 = owner_row.get("user_id");
        let owner = owner_id.unwrap_or(creator_id);
        let stmt = SeaQuery::insert()
            .into_table("chat_room_members")
            .columns(["id", "room_id", "user_id", "joined_at"])
            .values_panic([
                crate::db::new_id().into(),
                room_id.into(),
                owner.into(),
                crate::db::now_string().into(),
            ])
            .on_conflict(
                OnConflict::columns(["room_id", "user_id"])
                    .do_nothing()
                    .to_owned()
            )
            .to_owned();
        let _ = crate::db::execute(&*pool, &stmt).await;
    }

    Ok(Json(json!({ "success": true, "id": room_id.to_string(), "existing": false })))
}
