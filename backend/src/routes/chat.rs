use axum::{
    extract::{Extension, Path, Query},
    response::Json,
    http::StatusCode,
    routing::{get, post, delete, put},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Asterisk, Expr, ExprTrait, Func, JoinType, OnConflict, Order, Query as SeaQuery};
use crate::auth::AuthUser;
use tokio::sync::broadcast;
use std::collections::HashMap;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/chat/rooms", post(create_chat_room))
            .route("/chat/rooms", get(get_chat_rooms))
            .route("/chat/rooms/:room_id/members", get(get_chat_room_members))
            .route("/chat/rooms/:room_id/members", post(add_chat_room_member))
            .route("/chat/rooms/:room_id/members/:user_id", delete(remove_chat_room_member))
            .route("/chat/rooms/:room_id/leave", post(leave_chat_room))
            .route("/chat/rooms/:room_id", put(rename_chat_room))
            .route("/chat", get(get_messages))
            .route("/chat/search", get(search_messages))
            .route("/chat", post(send_message))
            .route("/chat/:id", delete(delete_chat_message).put(update_chat_message))
            .route("/chat/rooms/:room_id/read", post(update_last_read)),
    )
}

async fn rename_chat_room(
    Path(room_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(payload): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = crate::serde_utils::parse_path_id(&room_id_str)?;
    let new_name = payload.get("name").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "name is required"}))))?;

    // Check if user is a member of the room
    let check_stmt = SeaQuery::select()
        .column(sea_query::Alias::new("id"))
        .from(sea_query::Alias::new("chat_room_members"))
        .and_where(Expr::col(sea_query::Alias::new("room_id")).eq(room_id))
        .and_where(Expr::col(sea_query::Alias::new("user_id")).eq(user.id))
        .to_owned();

    let is_member = crate::db::fetch_optional(&pool, &check_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .is_some();

    if !is_member {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."}))));
    }

    let stmt = SeaQuery::update()
        .table(sea_query::Alias::new("chat_rooms"))
        .value(sea_query::Alias::new("name"), new_name)
        .and_where(Expr::col(sea_query::Alias::new("id")).eq(room_id))
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // broadcast room rename is tricky, but frontend can just re-fetch chat rooms
    Ok(Json(json!({ "success": true })))
}

async fn update_last_read(
    Path(room_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(payload): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = crate::serde_utils::parse_path_id(&room_id_str)?;
    let last_read_id = payload.get("last_read_message_id")
        .and_then(|v| {
            if let Some(s) = v.as_str() { s.parse::<i64>().ok() }
            else { v.as_i64() }
        })
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "last_read_message_id is required"}))))?;

    let stmt = SeaQuery::update()
        .table(sea_query::Alias::new("chat_room_members"))
        .value(sea_query::Alias::new("last_read_message_id"), last_read_id)
        .and_where(Expr::col(sea_query::Alias::new("room_id")).eq(room_id))
        .and_where(Expr::col(sea_query::Alias::new("user_id")).eq(user.id))
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn create_chat_room(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(room_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let name = room_data.get("name").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "name is required"}))))?;
    let creator_id = user.id;

    let room_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table(sea_query::Alias::new("chat_rooms"))
        .columns([sea_query::Alias::new("id"), sea_query::Alias::new("name"), sea_query::Alias::new("created_at")])
        .values_panic([room_id.into(), name.into(), crate::db::now_string().into()])
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::insert()
        .into_table(sea_query::Alias::new("chat_room_members"))
        .columns([sea_query::Alias::new("id"), sea_query::Alias::new("room_id"), sea_query::Alias::new("user_id"), sea_query::Alias::new("joined_at")])
        .values_panic([crate::db::new_id().into(), room_id.into(), creator_id.into(), crate::db::now_string().into()])
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "id": room_id.to_string() })))
}

async fn get_chat_rooms(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .columns([
            (sea_query::Alias::new("cr"), sea_query::Alias::new("id")),
            (sea_query::Alias::new("cr"), sea_query::Alias::new("name")),
            (sea_query::Alias::new("cr"), sea_query::Alias::new("created_at")),
        ])
        .expr_as(
            Expr::expr(
                SeaQuery::select()
                    .expr(sea_query::Expr::col(sea_query::Alias::new("id")).count())
                    .from(sea_query::Alias::new("messages"))
                    .and_where(Expr::col(sea_query::Alias::new("room_id")).equals((sea_query::Alias::new("cr"), sea_query::Alias::new("id"))))
                    .and_where(
                        Expr::col(sea_query::Alias::new("id"))
                            .gt(sea_query::Func::coalesce([Expr::col((sea_query::Alias::new("crm"), sea_query::Alias::new("last_read_message_id"))), Expr::val(0)]))
                    )
                    .to_owned()
            ),
            "unread_count",
        )
        .from_as(sea_query::Alias::new("chat_rooms"), sea_query::Alias::new("cr"))
        .join_as(
            JoinType::InnerJoin,
            sea_query::Alias::new("chat_room_members"),
            sea_query::Alias::new("crm"),
            Expr::col((sea_query::Alias::new("crm"), sea_query::Alias::new("room_id"))).equals((sea_query::Alias::new("cr"), sea_query::Alias::new("id"))),
        )
        .and_where(Expr::col((sea_query::Alias::new("crm"), sea_query::Alias::new("user_id"))).eq(user.id))
        .order_by((sea_query::Alias::new("cr"), sea_query::Alias::new("created_at")), Order::Desc)
        .to_owned();
    
    let rows = crate::db::fetch_all(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    
    let rooms: Vec<Value> = rows.iter().map(|row| json!({
        "id": row.get::<i64, _>("id").to_string(),
        "name": row.get::<String, _>("name"),
        "created_at": row.get::<String, _>("created_at"),
        "unread_count": row.try_get::<i64, _>("unread_count").unwrap_or(0),
    })).collect();

    Ok(Json(json!({ "success": true, "data": rooms })))
}

async fn get_chat_room_members(
    Path(room_id_str): Path<String>,
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = crate::serde_utils::parse_path_id(&room_id_str)?;
    let stmt = SeaQuery::select()
        .columns([
            (sea_query::Alias::new("crm"), sea_query::Alias::new("id")),
            (sea_query::Alias::new("crm"), sea_query::Alias::new("user_id")),
            (sea_query::Alias::new("crm"), sea_query::Alias::new("joined_at")),
            (sea_query::Alias::new("u"), sea_query::Alias::new("login")),
            (sea_query::Alias::new("u"), sea_query::Alias::new("email")),
            (sea_query::Alias::new("u"), sea_query::Alias::new("firstname")),
            (sea_query::Alias::new("u"), sea_query::Alias::new("lastname")),
        ])
        .from_as(sea_query::Alias::new("chat_room_members"), sea_query::Alias::new("crm"))
        .join_as(
            JoinType::InnerJoin,
            sea_query::Alias::new("users"),
            sea_query::Alias::new("u"),
            Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("id"))).equals((sea_query::Alias::new("crm"), sea_query::Alias::new("user_id"))),
        )
        .and_where(Expr::col((sea_query::Alias::new("crm"), sea_query::Alias::new("room_id"))).eq(room_id))
        .to_owned();

    let members = crate::db::fetch_all(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = members.into_iter().map(|m| {
        json!({
            "id": m.get::<i64, _>("id").to_string(),
            "user_id": m.get::<i64, _>("user_id").to_string(),
            "login": m.get::<String, _>("login"),
            "email": m.get::<String, _>("email"),
            "firstname": m.get::<Option<String>, _>("firstname"),
            "lastname": m.get::<Option<String>, _>("lastname"),
            "joined_at": m.get::<String, _>("joined_at")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn add_chat_room_member(
    Path(room_id_str): Path<String>,
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(member_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = crate::serde_utils::parse_path_id(&room_id_str)?;
    let user_id = member_data.get("user_id").and_then(crate::serde_utils::value_to_opt_i64).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_id is required"}))))?;

    let stmt = SeaQuery::insert()
        .into_table("chat_room_members")
        .columns(["id", "room_id", "user_id", "joined_at"])
        .values_panic([crate::db::new_id().into(), room_id.into(), user_id.into(), crate::db::now_string().into()])
        .on_conflict(OnConflict::columns(["room_id", "user_id"]).do_nothing().to_owned())
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;


    Ok(Json(json!({ "success": true })))
}

async fn remove_chat_room_member(
    Path((room_id_str, user_id_str)): Path<(String, String)>,
    current_user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = crate::serde_utils::parse_path_id(&room_id_str)?;
    let target_user_id = crate::serde_utils::parse_path_id(&user_id_str)?;

    // Check if current user is room creator (owner) or removing themselves
    let stmt = SeaQuery::select()
        .columns([sea_query::Alias::new("id")])
        .from(sea_query::Alias::new("chat_rooms"))
        .and_where(Expr::col(sea_query::Alias::new("id")).eq(room_id))
        .to_owned();

    let room = crate::db::fetch_optional(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    let room = match room {
        Some(r) => r,
        None => return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "채팅방을 찾을 수 없습니다."})))),
    };

    let _room = room;
    // Note: chat_rooms doesn't have creator_id column, need to check chat_room_members for first member
    // For now, allow users to remove themselves, and room creators to remove others
    // We'll check if current user is the one being removed, or if they're the room "owner"
    
    // Check if target user is in the room
    let member_stmt = SeaQuery::select()
        .expr(Func::count(Expr::col("id")))
        .from("chat_room_members")
        .and_where(Expr::col("room_id").eq(room_id).into())
        .and_where(Expr::col("user_id").eq(target_user_id).into())
        .to_owned();

    let is_member: i64 = crate::db::fetch_scalar(&pool, &member_stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    if is_member == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "해당 사용자는 이 채팅방의 멤버가 아닙니다."}))));
    }

    // Allow: removing yourself, or if you're the room creator (first member)
    let is_self = target_user_id == current_user.id;
    
    // Check if current user is room creator (first member of the room)
    let creator_stmt = SeaQuery::select()
        .column("user_id")
        .from("chat_room_members")
        .and_where(Expr::col("room_id").eq(room_id).into())
        .order_by("joined_at", Order::Asc)
        .limit(1)
        .to_owned();

    let creator_row = crate::db::fetch_optional(&pool, &creator_stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    let is_creator = creator_row.map(|r| r.get::<i64, _>("user_id") == current_user.id).unwrap_or(false);

    if !is_self && !is_creator {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "멤버를 내보낼 권한이 없습니다."}))));
    }

    let stmt = SeaQuery::delete()
        .from_table("chat_room_members")
        .and_where(Expr::col("room_id").eq(room_id).into())
        .and_where(Expr::col("user_id").eq(target_user_id).into())
        .to_owned();

    crate::db::execute(&pool, &stmt).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()})))
    })?;

    Ok(Json(json!({"success": true})))
}

async fn get_messages(
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = params.get("room_id").and_then(|v| v.parse::<i64>().ok());
    let before_id = params.get("before_id").and_then(|v| v.parse::<i64>().ok());
    let since_id = params.get("since_id").and_then(|v| v.parse::<i64>().ok());
    let limit = std::cmp::min(params.get("limit").and_then(|v| v.parse::<u64>().ok()).unwrap_or(50), 100);

    let mut stmt = SeaQuery::select();
    stmt.column((sea_query::Alias::new("m"), Asterisk))
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("login"))), "login")
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("firstname"))), "firstname")
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("lastname"))), "lastname")
        .from_as(sea_query::Alias::new("messages"), sea_query::Alias::new("m"))
        .join_as(
            JoinType::InnerJoin,
            sea_query::Alias::new("users"),
            sea_query::Alias::new("u"),
            Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("id"))).equals((sea_query::Alias::new("m"), sea_query::Alias::new("author_id"))),
        );

    if let Some(id) = room_id {
        stmt.and_where(Expr::col((sea_query::Alias::new("m"), sea_query::Alias::new("room_id"))).eq(id));
    }

    if let Some(b_id) = before_id {
        stmt.and_where(Expr::col((sea_query::Alias::new("m"), sea_query::Alias::new("id"))).lt(b_id));
        stmt.order_by((sea_query::Alias::new("m"), sea_query::Alias::new("id")), Order::Desc);
    } else if let Some(s_id) = since_id {
        stmt.and_where(Expr::col((sea_query::Alias::new("m"), sea_query::Alias::new("id"))).gt(s_id));
        stmt.order_by((sea_query::Alias::new("m"), sea_query::Alias::new("id")), Order::Asc);
    } else {
        stmt.order_by((sea_query::Alias::new("m"), sea_query::Alias::new("id")), Order::Desc);
    }
    stmt.limit(limit);

    let rows = crate::db::fetch_all(&pool, &stmt.to_owned()).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut messages: Vec<Value> = rows.into_iter().map(|r| {
        let firstname: Option<String> = r.get("firstname");
        let lastname: Option<String> = r.get("lastname");
        let login: String = r.get("login");
        let author_name = crate::routes::utils::display_name(firstname.as_deref(), lastname.as_deref(), &login);
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "room_id": r.get::<i64, _>("room_id").to_string(),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": login,
            "author_name": author_name,
            "content": r.get::<String, _>("content"),
            "created_at": r.get::<String, _>("created_at"),
            "edited_at": r.get::<Option<String>, _>("edited_at")
        })
    }).collect();

    if since_id.is_none() {
        messages.reverse();
    }

    Ok(Json(json!({ "success": true, "data": messages })))
}

async fn search_messages(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = params.get("room_id").and_then(|v| v.parse::<i64>().ok());
    let query = params.get("q").map(|s| s.as_str()).unwrap_or("");
    
    if query.trim().is_empty() {
        return Ok(Json(json!({ "success": true, "data": [] })));
    }

    let mut stmt = SeaQuery::select();
    stmt.column((sea_query::Alias::new("m"), Asterisk))
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("login"))), "login")
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("firstname"))), "firstname")
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("lastname"))), "lastname")
        .from_as(sea_query::Alias::new("messages"), sea_query::Alias::new("m"))
        .join_as(
            JoinType::InnerJoin,
            sea_query::Alias::new("users"),
            sea_query::Alias::new("u"),
            Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("id"))).equals((sea_query::Alias::new("m"), sea_query::Alias::new("author_id"))),
        );

    if let Some(id) = room_id {
        stmt.and_where(Expr::col((sea_query::Alias::new("m"), sea_query::Alias::new("room_id"))).eq(id));
    } else {
        stmt.join_as(
            JoinType::InnerJoin,
            sea_query::Alias::new("chat_room_members"),
            sea_query::Alias::new("crm"),
            Expr::col((sea_query::Alias::new("crm"), sea_query::Alias::new("room_id"))).equals((sea_query::Alias::new("m"), sea_query::Alias::new("room_id"))),
        );
        stmt.and_where(Expr::col((sea_query::Alias::new("crm"), sea_query::Alias::new("user_id"))).eq(user.id));
    }

    stmt.and_where(Expr::col((sea_query::Alias::new("m"), sea_query::Alias::new("content"))).like(format!("%{}%", query)));
    stmt.order_by((sea_query::Alias::new("m"), sea_query::Alias::new("created_at")), Order::Desc);
    stmt.limit(50);

    let rows = crate::db::fetch_all(&pool, &stmt.to_owned()).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let messages: Vec<Value> = rows.into_iter().map(|r| {
        let firstname: Option<String> = r.get("firstname");
        let lastname: Option<String> = r.get("lastname");
        let login: String = r.get("login");
        let author_name = crate::routes::utils::display_name(firstname.as_deref(), lastname.as_deref(), &login);
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "room_id": r.get::<i64, _>("room_id").to_string(),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": login,
            "author_name": author_name,
            "content": r.get::<String, _>("content"),
            "created_at": r.get::<String, _>("created_at"),
            "edited_at": r.get::<Option<String>, _>("edited_at")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": messages })))
}

async fn send_message(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(broadcast_tx): Extension<Arc<broadcast::Sender<String>>>,
    axum::Json(message_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = message_data.get("room_id").and_then(crate::serde_utils::value_to_opt_i64).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "room_id is required"}))))?;
    let content = message_data.get("content").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "content is required"}))))?;

    let author_id = user.id;

    let new_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table(sea_query::Alias::new("messages"))
        .columns([
            sea_query::Alias::new("id"),
            sea_query::Alias::new("room_id"),
            sea_query::Alias::new("author_id"),
            sea_query::Alias::new("content"),
            sea_query::Alias::new("created_at"),
        ])
        .values_panic([
            new_id.into(),
            room_id.into(),
            author_id.into(),
            content.into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::select()
        .column((sea_query::Alias::new("m"), Asterisk))
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("login"))), "login")
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("firstname"))), "firstname")
        .expr_as(Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("lastname"))), "lastname")
        .from_as(sea_query::Alias::new("messages"), sea_query::Alias::new("m"))
        .join_as(
            JoinType::InnerJoin,
            sea_query::Alias::new("users"),
            sea_query::Alias::new("u"),
            Expr::col((sea_query::Alias::new("u"), sea_query::Alias::new("id"))).equals((sea_query::Alias::new("m"), sea_query::Alias::new("author_id"))),
        )
        .and_where(Expr::col((sea_query::Alias::new("m"), sea_query::Alias::new("id"))).eq(new_id))
        .to_owned();

    if let Ok(msg_row) = crate::db::fetch_optional(&pool, &stmt).await {
        if let Some(msg) = msg_row {
            let firstname: Option<String> = msg.get("firstname");
            let lastname: Option<String> = msg.get("lastname");
            let login: String = msg.get("login");
            let author_name = crate::routes::utils::display_name(firstname.as_deref(), lastname.as_deref(), &login);
            let message_json = json!({
                "type": "new_message",
                "data": {
                    "id": msg.get::<i64, _>("id").to_string(),
                    "room_id": msg.get::<i64, _>("room_id").to_string(),
                    "author_id": msg.get::<i64, _>("author_id").to_string(),
                    "author_login": login,
                    "author_name": author_name,
                    "content": msg.get::<String, _>("content"),
                    "created_at": msg.get::<String, _>("created_at"),
                    "edited_at": msg.get::<Option<String>, _>("edited_at")
                }
            });
            let _ = broadcast_tx.send(message_json.to_string());
        }
    }

    Ok(Json(json!({ "success": true, "id": new_id.to_string() })))
}

async fn delete_chat_message(
    Path(id_str): Path<String>,
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(broadcast_tx): Extension<Arc<broadcast::Sender<String>>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns([sea_query::Alias::new("content"), sea_query::Alias::new("room_id")])
        .from(sea_query::Alias::new("messages"))
        .and_where(Expr::col(sea_query::Alias::new("id")).eq(id))
        .to_owned();
    let row = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Message not found"}))))?;

    let content: String = row.get("content");
    let msg_room_id: i64 = row.get("room_id");

    let re = regex::Regex::new(r"\[FILE:(\d+):.*\]").unwrap();
    if let Some(caps) = re.captures(&content) {
        if let Some(file_id_str) = caps.get(1) {
            if let Ok(file_id) = file_id_str.as_str().parse::<i64>() {
                let stmt = SeaQuery::select()
                    .column(sea_query::Alias::new("disk_filename"))
                    .from(sea_query::Alias::new("attachments"))
                    .and_where(Expr::col(sea_query::Alias::new("id")).eq(file_id))
                    .to_owned();
                let att_row = crate::db::fetch_optional(&pool, &stmt)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

                if let Some(r) = att_row {
                    let disk_filename: String = r.get("disk_filename");
                    let path = std::path::Path::new(&app_config.upload_dir).join(disk_filename);
                    let _ = std::fs::remove_file(path);

                    let stmt = SeaQuery::delete()
                        .from_table(sea_query::Alias::new("attachments"))
                        .and_where(Expr::col(sea_query::Alias::new("id")).eq(file_id))
                        .to_owned();
                    crate::db::execute(&pool, &stmt)
                        .await
                        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
                }
            }
        }
    }

    let stmt = SeaQuery::delete()
        .from_table(sea_query::Alias::new("messages"))
        .and_where(Expr::col(sea_query::Alias::new("id")).eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let delete_json = json!({
        "type": "delete_message",
        "data": { "id": id.to_string(), "room_id": msg_room_id.to_string() }
    });
    let _ = broadcast_tx.send(delete_json.to_string());

    Ok(Json(json!({ "success": true })))
}

async fn update_chat_message(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(broadcast_tx): Extension<Arc<broadcast::Sender<String>>>,
    axum::Json(message_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let content = message_data
        .get("content")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "content is required"}))))?;

    // 기존 메시지 조회 (작성자/타입 검증)
    let stmt = SeaQuery::select()
        .columns([sea_query::Alias::new("author_id"), sea_query::Alias::new("content")])
        .from(sea_query::Alias::new("messages"))
        .and_where(Expr::col(sea_query::Alias::new("id")).eq(id))
        .to_owned();
    let row = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Message not found"}))))?;

    let author_id: i64 = row.get("author_id");
    let existing: String = row.get("content");
    if author_id != user.id {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "Not allowed"}))));
    }
    if existing.starts_with("[FILE:") {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Cannot edit file message"}))));
    }

    let stmt = SeaQuery::update()
        .table(sea_query::Alias::new("messages"))
        .value("content", content)
        .value("edited_at", crate::db::now_string())
        .and_where(Expr::col(sea_query::Alias::new("id")).eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // 갱신된 메시지를 브로드캐스트하여 실시간 반영
    let stmt = SeaQuery::select()
        .column((sea_query::Alias::new("m"), Asterisk))
        .from_as(sea_query::Alias::new("messages"), sea_query::Alias::new("m"))
        .and_where(Expr::col((sea_query::Alias::new("m"), sea_query::Alias::new("id"))).eq(id))
        .to_owned();
    if let Ok(Some(msg)) = crate::db::fetch_optional(&pool, &stmt).await {
        let edit_json = json!({
            "type": "edit_message",
            "data": {
                "id": msg.get::<i64, _>("id").to_string(),
                "room_id": msg.get::<i64, _>("room_id").to_string(),
                "content": msg.get::<String, _>("content"),
                "edited_at": msg.get::<Option<String>, _>("edited_at")
            }
        });
        let _ = broadcast_tx.send(edit_json.to_string());
    }

    Ok(Json(json!({ "success": true })))
}

async fn leave_chat_room(
    Path(room_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let room_id = crate::serde_utils::parse_path_id(&room_id_str)?;
    let stmt = SeaQuery::delete()
        .from_table(sea_query::Alias::new("chat_room_members"))
        .and_where(Expr::col(sea_query::Alias::new("room_id")).eq(room_id))
        .and_where(Expr::col(sea_query::Alias::new("user_id")).eq(user.id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
