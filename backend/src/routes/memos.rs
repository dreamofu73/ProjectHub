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
use sea_query::{Expr, ExprTrait, Func, JoinType, Order, Query as SeaQuery, SelectStatement};
use uuid::Uuid;
use crate::auth::AuthUser;
use std::collections::HashMap;

/// 쪽지 단건의 플래그 컬럼(0/1)을 갱신하는 문장.
fn set_memo_flag(id: &str, column: &'static str, value: i64) -> sea_query::UpdateStatement {
    SeaQuery::update()
        .table("memos")
        .value(column, value)
        .and_where(Expr::col("id").eq(id.to_string()))
        .to_owned()
}

/// 쪽지 단건을 id 로 조회하는 문장. 호출부에서 `.columns(..)` 로 컬럼을 지정합니다.
fn memo_by_id(id: &str) -> SelectStatement {
    SeaQuery::select().from("memos").and_where(Expr::col("id").eq(id.to_string())).to_owned()
}

/// 쪽지 건수 질의의 공통 뼈대. 호출부에서 `.and_where(..)` 로 조건을 덧붙입니다.
fn memo_count_stmt() -> SelectStatement {
    SeaQuery::select().expr(sea_query::Func::count(Expr::col("id"))).from("memos").to_owned()
}

/// 플래그 컬럼(0/1)이 기대값인지 비교하는 조건들을 한 번에 적용합니다.
fn with_flags(stmt: &mut SelectStatement, flags: &[(&'static str, i64)]) {
    for (column, expected) in flags {
        stmt.and_where(Expr::col(*column).eq(*expected));
    }
}

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/memos/received", get(get_received_memos))
            .route("/memos/sent", get(get_sent_memos))
            .route("/memos/sent/reserved", get(get_reserved_memos))
            .route("/memos/archived", get(get_archived_memos))
            .route("/memos/spam", get(get_spam_memos))
            .route("/memos/trash", get(get_trash_memos))
            .route("/memos/unread/count", get(get_unread_memos_count))
            .route("/memos", post(send_memo))
            .route("/memos/folders", get(get_folders))
            .route("/memos/folders", post(create_folder))
            .route("/memos/folders/move", post(move_memos_to_folder))
            .route("/memos/folders/:id", put(update_folder))
            .route("/memos/folders/:id", delete(delete_folder))
            .route("/memos/folders/:id/memos", get(get_folder_memos))
            .route("/memos/:id", get(get_memo_detail))
            .route("/memos/:id", delete(delete_memo))
            .route("/memos/:id/archive", put(toggle_archive_memo))
            .route("/memos/:id/spam", put(toggle_spam_memo))
            .route("/memos/:id/restore", put(restore_memo))
            .route("/memos/:id/extend", post(extend_memo_expiry))
            .route("/memos/received/unread", delete(delete_unread_received_memos))
            .route("/memos/batch/read", post(batch_toggle_read_memos)),
    )
}

// 1. 받은 쪽지함 조회 (스팸, 보관 제외)
async fn get_received_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;
    let filter = params.get("filter").map(|s| s.as_str()).unwrap_or("all");

    let mut count_stmt = SeaQuery::select();
    count_stmt.expr(Func::count(Expr::col("id"))).from("memos");
    
    if filter == "group" {
        count_stmt
            .from_as("memos", "m")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("m", "sender_id")).equals(("u", "id")))
            .and_where(Expr::col(("m", "receiver_id")).eq(user.id))
            .and_where(Expr::col(("m", "receiver_deleted")).eq(0i64))
            .and_where(Expr::col(("m", "is_spam")).eq(0i64))
            .and_where(Expr::col(("m", "is_archived")).eq(0i64))
            .and_where(Expr::col(("m", "receiver_in_trash")).eq(0i64))
            .and_where(Expr::col(("u", "login")).eq("admin"))
            .and_where(Expr::col(("m", "is_sent")).eq(1i64));
    } else {
        count_stmt
            .and_where(Expr::col("receiver_id").eq(user.id))
            .and_where(Expr::col("receiver_deleted").eq(0i64))
            .and_where(Expr::col("is_spam").eq(0i64))
            .and_where(Expr::col("is_archived").eq(0i64))
            .and_where(Expr::col("receiver_in_trash").eq(0i64))
            .and_where(Expr::col("is_sent").eq(1i64));
        
        if filter == "self" {
            count_stmt.and_where(Expr::col("sender_id").eq(Expr::col("receiver_id")));
        } else if filter == "personal" {
            count_stmt.and_where(Expr::col("sender_id").ne(Expr::col("receiver_id")));
        }
    }

    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt.to_owned())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut data_stmt = SeaQuery::select();
    data_stmt
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), ("m", "content"), 
            ("m", "created_at"), ("m", "is_read"), ("m", "is_archived"), ("m", "is_spam")
        ])
        .expr_as(Expr::col(("u", "login")), "sender_login")
        .expr_as(Expr::col(("u", "firstname")), "sender_firstname")
        .expr_as(Expr::col(("u", "lastname")), "sender_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("m", "sender_id")).equals(("u", "id")))
        .and_where(Expr::col(("m", "receiver_id")).eq(user.id))
        .and_where(Expr::col(("m", "receiver_deleted")).eq(0i64))
        .and_where(Expr::col(("m", "is_spam")).eq(0i64))
        .and_where(Expr::col(("m", "is_archived")).eq(0i64))
        .and_where(Expr::col(("m", "receiver_in_trash")).eq(0i64))
        .and_where(Expr::col(("m", "is_sent")).eq(1i64));

    if filter == "self" {
        data_stmt.and_where(Expr::col(("m", "sender_id")).eq(Expr::col(("m", "receiver_id"))));
    } else if filter == "personal" {
        data_stmt.and_where(Expr::col(("m", "sender_id")).ne(Expr::col(("m", "receiver_id"))));
    } else if filter == "group" {
        data_stmt.and_where(Expr::col(("u", "login")).eq("admin"));
    }

    data_stmt.order_by(("m", "created_at"), Order::Desc)
        .limit(limit as u64)
        .offset(offset as u64);

    let rows = crate::db::fetch_all(&pool, &data_stmt.to_owned())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(json!({
            "id": row.get::<String, _>("id"),
            "sender_id": row.get::<i64, _>("sender_id").to_string(),
            "receiver_id": row.get::<i64, _>("receiver_id").to_string(),
            "title": row.get::<String, _>("title"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<String, _>("created_at"),
            "is_read": row.get::<i64, _>("is_read"),
            "is_archived": row.get::<i64, _>("is_archived"),
            "is_spam": row.get::<i64, _>("is_spam"),
            "sender_login": row.get::<String, _>("sender_login"),
            "sender_firstname": row.get::<String, _>("sender_firstname"),
            "sender_lastname": row.get::<String, _>("sender_lastname"),
        }));
    }

    Ok(Json(json!({ "success": true, "data": memos, "total": total })))
}

// 2. 보낸 쪽지함 조회 (보관 제외)
async fn get_sent_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut count_stmt = memo_count_stmt();
    count_stmt.and_where(Expr::col("sender_id").eq(user.id));
    with_flags(
        &mut count_stmt,
        &[
            ("sender_deleted", 0),
            ("is_archived", 0),
            ("is_spam", 0),
            ("sender_in_trash", 0),
            ("is_sent", 1),
        ],
    );
    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let rows = crate::db::fetch_all(&pool, &SeaQuery::select()
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), ("m", "content"), 
            ("m", "created_at"), ("m", "is_read"), ("m", "is_archived"), ("m", "is_spam")
        ])
        .expr_as(Expr::col(("u", "login")), "receiver_login")
        .expr_as(Expr::col(("u", "firstname")), "receiver_firstname")
        .expr_as(Expr::col(("u", "lastname")), "receiver_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("m", "receiver_id")).equals(("u", "id")))
        .and_where(Expr::col(("m", "sender_id")).eq(user.id))
        .and_where(Expr::col(("m", "sender_deleted")).eq(0i64))
        .and_where(Expr::col(("m", "is_archived")).eq(0i64))
        .and_where(Expr::col(("m", "is_spam")).eq(0i64))
        .and_where(Expr::col(("m", "sender_in_trash")).eq(0i64))
        .and_where(Expr::col(("m", "is_sent")).eq(1i64))
        .order_by(("m", "created_at"), Order::Desc)
        .limit(limit as u64)
        .offset(offset as u64)
        .to_owned()
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(json!({
            "id": row.get::<String, _>("id"),
            "sender_id": row.get::<i64, _>("sender_id").to_string(),
            "receiver_id": row.get::<i64, _>("receiver_id").to_string(),
            "title": row.get::<String, _>("title"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<String, _>("created_at"),
            "is_read": row.get::<i64, _>("is_read"),
            "is_archived": row.get::<i64, _>("is_archived"),
            "is_spam": row.get::<i64, _>("is_spam"),
            "receiver_login": row.get::<String, _>("receiver_login"),
            "receiver_firstname": row.get::<String, _>("receiver_firstname"),
            "receiver_lastname": row.get::<String, _>("receiver_lastname"),
        }));
    }

    Ok(Json(json!({ "success": true, "data": memos, "total": total })))
}

// 3. 안 읽은 쪽지 개수 조회
async fn get_unread_memos_count(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut count_stmt = memo_count_stmt();
    count_stmt.and_where(Expr::col("receiver_id").eq(user.id));
    with_flags(
        &mut count_stmt,
        &[
            ("is_read", 0),
            ("receiver_deleted", 0),
            ("is_spam", 0),
            ("is_archived", 0),
            ("receiver_in_trash", 0),
            ("is_sent", 1),
        ],
    );
    let count: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "count": count })))
}

// 4. 쪽지 보내기
async fn send_memo(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(payload): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let receiver_ids = payload.get("receiver_ids")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| {
                    if let Some(n) = x.as_i64() {
                        Some(n)
                    } else if let Some(s) = x.as_str() {
                        s.parse::<i64>().ok()
                    } else {
                        None
                    }
                })
                .collect::<Vec<i64>>()
        })
        .ok_or_else(|| {
            (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "receiver_ids is required and must be an array"})))
        })?;

    if receiver_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "수신자를 최소 한 명 이상 지정해야 합니다."}))));
    }

    let title = payload.get("title").and_then(|v| v.as_str()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "title is required"})))
    })?;
    let content = payload.get("content").and_then(|v| v.as_str()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "content is required"})))
    })?;

    // 트랜잭션 시작
    let mut tx = pool.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut created_ids = Vec::new();
    for receiver_id in receiver_ids {
        // 수신 사용자 유효성 검사
        let exists_stmt = SeaQuery::select()
            .expr(Func::count(Expr::col("id")))
            .from("users")
            .and_where(Expr::col("id").eq(receiver_id))
            .to_owned();
        let receiver_exists: i64 =
            crate::db::to_query_scalar::<i64, _>(&exists_stmt, crate::db::get_kind(&pool))
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        if receiver_exists == 0 {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": format!("수신자(ID: {})를 찾을 수 없습니다.", receiver_id)}))));
        }

        let id = Uuid::new_v4().to_string();
        created_ids.push(id.clone());
        let created_at = chrono::Utc::now().to_rfc3339();

        let reserved_at = payload.get("reserved_at").and_then(|v| v.as_str());
        let mut is_sent = 1;
        if let Some(res_at) = reserved_at {
            if let Ok(parsed_time) = chrono::DateTime::parse_from_rfc3339(res_at) {
                if parsed_time.with_timezone(&chrono::Utc) > chrono::Utc::now() {
                    is_sent = 0;
                }
            }
        }

        let stmt = SeaQuery::insert()
            .into_table("memos")
            .columns([
                "id", "sender_id", "receiver_id", "title", "content", "created_at", 
                "is_read", "sender_deleted", "receiver_deleted", "is_sent", "reserved_at"
            ])
            .values_panic([
                id.clone().into(), 
                user.id.into(), 
                receiver_id.into(), 
                title.into(), 
                content.into(), 
                created_at.clone().into(), 
                0i64.into(), 
                0i64.into(), 
                0i64.into(), 
                is_sent.into(), 
                reserved_at.map(|s| s.to_string()).into()
            ])
            .to_owned();
        crate::db::to_query(&stmt, crate::db::get_kind(&pool))
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        // 즉시 발송 쪽지(is_sent=1)만 수신자에게 알림 생성.
        // 예약 발송 쪽지는 스케줄러(process_reserved_send)가 실제 발송 시 알림 처리.
        if is_sent == 1 {
            let notif_id = Uuid::new_v4().to_string();
            let notif_title = "새 쪽지가 도착했습니다".to_string();
            let notif_msg = format!("'{title}' 쪽지가 도착했습니다.");
            let notif_link = format!("/memos/{id}");
            let notif_stmt = SeaQuery::insert()
                .into_table("notifications")
                .columns([
                    "id", "user_id", "type", "title", "message", "link", "is_read", "created_at",
                ])
                .values_panic([
                    notif_id.into(),
                    receiver_id.into(),
                    "memo_received".into(),
                    notif_title.into(),
                    notif_msg.into(),
                    notif_link.into(),
                    0i64.into(),
                    created_at.into(),
                ])
                .to_owned();
            crate::db::to_query(&notif_stmt, crate::db::get_kind(&pool))
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }

    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "data": { "memo_ids": created_ids } })))
}

// 5. 쪽지 상세 조회
async fn get_memo_detail(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let select_stmt = SeaQuery::select()
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), ("m", "content"), 
            ("m", "created_at"), ("m", "is_read"), ("m", "sender_deleted"), ("m", "receiver_deleted"), ("m", "expires_at")
        ])
        .expr_as(Expr::col(("sender", "login")), "sender_login")
        .expr_as(Expr::col(("sender", "firstname")), "sender_firstname")
        .expr_as(Expr::col(("sender", "lastname")), "sender_lastname")
        .expr_as(Expr::col(("receiver", "login")), "receiver_login")
        .expr_as(Expr::col(("receiver", "firstname")), "receiver_firstname")
        .expr_as(Expr::col(("receiver", "lastname")), "receiver_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "users", "sender", Expr::col(("m", "sender_id")).equals(("sender", "id")))
        .join_as(JoinType::InnerJoin, "users", "receiver", Expr::col(("m", "receiver_id")).equals(("receiver", "id")))
        .and_where(Expr::col(("m", "id")).eq(id.clone()))
        .to_owned();

    let row = crate::db::fetch_optional(&pool, &select_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(r) = row {
        let sender_id = r.get::<i64, _>("sender_id");
        let receiver_id = r.get::<i64, _>("receiver_id");
        let sender_deleted = r.get::<i64, _>("sender_deleted");
        let receiver_deleted = r.get::<i64, _>("receiver_deleted");

        // 권한 검증: 현재 유저가 발신자 또는 수신자여야 함
        if user.id != sender_id && user.id != receiver_id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "해당 쪽지를 볼 권한이 없습니다."}))));
        }

        // 삭제 여부 검증
        if (user.id == sender_id && sender_deleted == 1) || (user.id == receiver_id && receiver_deleted == 1) {
            return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "삭제된 쪽지입니다."}))));
        }

        // 수신자가 열람하고 읽지 않은 상태인 경우, 읽음 상태로 업데이트 (및 만료 예정일 30일 설정)
        let is_read = r.get::<i64, _>("is_read");
        if user.id == receiver_id && is_read == 0 {
            let expires_at = (chrono::Utc::now() + chrono::Duration::days(30)).to_rfc3339();
            let stmt = SeaQuery::update()
                .table("memos")
                .value("is_read", 1i64)
                .value("expires_at", expires_at)
                .and_where(Expr::col("id").eq(id.clone()))
                .to_owned();
            crate::db::execute(&pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }

        // 첨부파일 조회
        let att_stmt = SeaQuery::select()
            .columns(["id", "filename", "filesize", "content_type", "created_at"])
            .from("attachments")
            .and_where(Expr::col("memo_id").eq(id.clone()))
            .to_owned();

        let attachments_rows = crate::db::fetch_all(&pool, &att_stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let mut attachments = Vec::new();
        for att_row in attachments_rows {
            attachments.push(json!({
                "id": att_row.get::<i64, _>("id").to_string(),
                "filename": att_row.get::<String, _>("filename"),
                "filesize": att_row.get::<i64, _>("filesize"),
                "content_type": att_row.get::<String, _>("content_type"),
                "created_at": att_row.get::<String, _>("created_at"),
            }));
        }

        // 폴더 매핑 조회
        let mapping_stmt = SeaQuery::select()
            .column("folder_id")
            .from("memo_folder_mappings")
            .and_where(Expr::col("memo_id").eq(id.clone()))
            .and_where(Expr::col("user_id").eq(user.id))
            .to_owned();

        let folder_mapping = crate::db::fetch_optional(&pool, &mapping_stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let folder_id = folder_mapping.map(|row| row.get::<String, _>("folder_id"));

        Ok(Json(json!({
            "success": true,
            "data": {
                "id": r.get::<String, _>("id"),
                "sender_id": sender_id.to_string(),
                "receiver_id": receiver_id.to_string(),
                "title": r.get::<String, _>("title"),
                "content": r.get::<String, _>("content"),
                "created_at": r.get::<String, _>("created_at"),
                "is_read": if user.id == receiver_id { 1 } else { is_read },
                "expires_at": r.get::<Option<String>, _>("expires_at"),
                "sender_login": r.get::<String, _>("sender_login"),
                "sender_firstname": r.get::<String, _>("sender_firstname"),
                "sender_lastname": r.get::<String, _>("sender_lastname"),
                "receiver_login": r.get::<String, _>("receiver_login"),
                "receiver_firstname": r.get::<String, _>("receiver_firstname"),
                "receiver_lastname": r.get::<String, _>("receiver_lastname"),
                "attachments": attachments,
                "folder_id": folder_id,
            }
        })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "쪽지를 찾을 수 없습니다."}))))
    }
}

// 6. 쪽지 삭제 (1차 삭제 시 휴지통으로 이동, 휴지통에서 다시 삭제 시 완전 삭제)
async fn delete_memo(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut stmt = memo_by_id(&id);
    stmt.columns(["sender_id", "receiver_id", "sender_in_trash", "receiver_in_trash", "is_sent"]);

    let row = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(r) = row {
        let sender_id = r.get::<i64, _>("sender_id");
        let receiver_id = r.get::<i64, _>("receiver_id");
        let sender_in_trash = r.get::<i64, _>("sender_in_trash");
        let receiver_in_trash = r.get::<i64, _>("receiver_in_trash");
        let is_sent = r.get::<i64, _>("is_sent");

        if user.id != sender_id && user.id != receiver_id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "해당 쪽지를 삭제할 권한이 없습니다."}))));
        }

        if is_sent == 0 && user.id == sender_id {
            let delete_memo = SeaQuery::delete()
                .from_table("memos")
                .and_where(Expr::col("id").eq(id.clone()))
                .to_owned();
            crate::db::execute(&pool, &delete_memo)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

            let delete_attachments = SeaQuery::delete()
                .from_table("attachments")
                .and_where(Expr::col("memo_id").eq(id.clone()))
                .to_owned();
            crate::db::execute_ignore(&pool, &delete_attachments).await;
            return Ok(Json(json!({ "success": true, "message": "예약이 취소되었습니다." })));
        }

        // 휴지통에 이미 있으면 완전 삭제 표시, 아니면 휴지통으로 이동
        if user.id == sender_id {
            let column = if sender_in_trash == 1 { "sender_deleted" } else { "sender_in_trash" };
            crate::db::execute(&pool, &set_memo_flag(&id, column, 1))
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }

        if user.id == receiver_id {
            let column = if receiver_in_trash == 1 { "receiver_deleted" } else { "receiver_in_trash" };
            crate::db::execute(&pool, &set_memo_flag(&id, column, 1))
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }

        // 양측 모두 삭제 처리했다면 완전히 삭제 처리 가능
        let purge_stmt = SeaQuery::delete()
            .from_table("memos")
            .and_where(Expr::col("sender_deleted").eq(1i64))
            .and_where(Expr::col("receiver_deleted").eq(1i64))
            .to_owned();
        crate::db::execute_ignore(&pool, &purge_stmt).await;

        Ok(Json(json!({ "success": true })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "쪽지를 찾을 수 없습니다."}))))
    }
}

// 7. 보관 쪽지함 조회
async fn get_archived_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut count_stmt = memo_count_stmt();
    count_stmt.and_where(Expr::col("receiver_id").eq(user.id));
    with_flags(
        &mut count_stmt,
        &[("receiver_deleted", 0), ("is_archived", 1), ("receiver_in_trash", 0)],
    );
    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let rows = crate::db::fetch_all(&pool, &SeaQuery::select()
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), ("m", "content"), 
            ("m", "created_at"), ("m", "is_read"), ("m", "is_archived"), ("m", "is_spam")
        ])
        .expr_as(Expr::col(("u", "login")), "sender_login")
        .expr_as(Expr::col(("u", "firstname")), "sender_firstname")
        .expr_as(Expr::col(("u", "lastname")), "sender_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("m", "sender_id")).equals(("u", "id")))
        .and_where(Expr::col(("m", "receiver_id")).eq(user.id))
        .and_where(Expr::col(("m", "receiver_deleted")).eq(0i64))
        .and_where(Expr::col(("m", "is_archived")).eq(1i64))
        .and_where(Expr::col(("m", "receiver_in_trash")).eq(0i64))
        .order_by(("m", "created_at"), Order::Desc)
        .limit(limit as u64)
        .offset(offset as u64)
        .to_owned()
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(json!({
            "id": row.get::<String, _>("id"),
            "sender_id": row.get::<i64, _>("sender_id").to_string(),
            "receiver_id": row.get::<i64, _>("receiver_id").to_string(),
            "title": row.get::<String, _>("title"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<String, _>("created_at"),
            "is_read": row.get::<i64, _>("is_read"),
            "is_archived": row.get::<i64, _>("is_archived"),
            "is_spam": row.get::<i64, _>("is_spam"),
            "sender_login": row.get::<String, _>("sender_login"),
            "sender_firstname": row.get::<String, _>("sender_firstname"),
            "sender_lastname": row.get::<String, _>("sender_lastname"),
        }));
    }

    Ok(Json(json!({ "success": true, "data": memos, "total": total })))
}

// 8. 스팸 쪽지함 조회
async fn get_spam_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut count_stmt = memo_count_stmt();
    count_stmt.and_where(Expr::col("receiver_id").eq(user.id));
    with_flags(
        &mut count_stmt,
        &[("receiver_deleted", 0), ("is_spam", 1), ("receiver_in_trash", 0)],
    );
    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let rows = crate::db::fetch_all(&pool, &SeaQuery::select()
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), ("m", "content"), 
            ("m", "created_at"), ("m", "is_read"), ("m", "is_archived"), ("m", "is_spam")
        ])
        .expr_as(Expr::col(("u", "login")), "sender_login")
        .expr_as(Expr::col(("u", "firstname")), "sender_firstname")
        .expr_as(Expr::col(("u", "lastname")), "sender_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("m", "sender_id")).equals(("u", "id")))
        .and_where(Expr::col(("m", "receiver_id")).eq(user.id))
        .and_where(Expr::col(("m", "receiver_deleted")).eq(0i64))
        .and_where(Expr::col(("m", "is_spam")).eq(1i64))
        .and_where(Expr::col(("m", "receiver_in_trash")).eq(0i64))
        .order_by(("m", "created_at"), Order::Desc)
        .limit(limit as u64)
        .offset(offset as u64)
        .to_owned()
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(json!({
            "id": row.get::<String, _>("id"),
            "sender_id": row.get::<i64, _>("sender_id").to_string(),
            "receiver_id": row.get::<i64, _>("receiver_id").to_string(),
            "title": row.get::<String, _>("title"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<String, _>("created_at"),
            "is_read": row.get::<i64, _>("is_read"),
            "is_archived": row.get::<i64, _>("is_archived"),
            "is_spam": row.get::<i64, _>("is_spam"),
            "sender_login": row.get::<String, _>("sender_login"),
            "sender_firstname": row.get::<String, _>("sender_firstname"),
            "sender_lastname": row.get::<String, _>("sender_lastname"),
        }));
    }

    Ok(Json(json!({ "success": true, "data": memos, "total": total })))
}

// 9. 쪽지 보관 상태 토글
async fn toggle_archive_memo(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(payload): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_archived = payload.get("is_archived")
        .and_then(|v| v.as_i64())
        .unwrap_or(1);

    let mut ownership_stmt = memo_by_id(&id);
    ownership_stmt.columns(["sender_id", "receiver_id"]);

    let ownership = crate::db::fetch_optional(&pool, &ownership_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = ownership {
        let sender_id = row.get::<i64, _>("sender_id");
        let receiver_id = row.get::<i64, _>("receiver_id");

        if user.id != sender_id && user.id != receiver_id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "해당 쪽지 상태를 수정할 권한이 없습니다."}))));
        }

        crate::db::execute(&pool, &set_memo_flag(&id, "is_archived", is_archived))
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        Ok(Json(json!({ "success": true })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "쪽지를 찾을 수 없습니다."}))))
    }
}

// 10. 쪽지 스팸 상태 토글
async fn toggle_spam_memo(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(payload): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_spam = payload.get("is_spam")
        .and_then(|v| v.as_i64())
        .unwrap_or(1);

    let mut ownership_stmt = memo_by_id(&id);
    ownership_stmt.column("receiver_id");

    let ownership = crate::db::fetch_optional(&pool, &ownership_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = ownership {
        let receiver_id = row.get::<i64, _>("receiver_id");

        if user.id != receiver_id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "수신인만 스팸 신고가 가능합니다."}))));
        }

        crate::db::execute(&pool, &set_memo_flag(&id, "is_spam", is_spam))
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        Ok(Json(json!({ "success": true })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "쪽지를 찾을 수 없습니다."}))))
    }
}

// 11. 안 읽은 받은 쪽지 일괄 삭제 (휴지통으로 이동)
async fn delete_unread_received_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::db::execute(&pool, &SeaQuery::update()
        .table("memos")
        .value("receiver_in_trash", 1i64)
        .and_where(Expr::col("receiver_id").eq(user.id))
        .and_where(Expr::col("is_read").eq(0i64))
        .and_where(Expr::col("receiver_deleted").eq(0i64))
        .and_where(Expr::col("receiver_in_trash").eq(0i64))
        .to_owned()
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

// 12. 휴지통 쪽지 조회 (내가 보냈거나 받은 쪽지 중 휴지통 상태인 것)
async fn get_trash_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    // 휴지통: 수신자 관점과 발신자 관점 중 하나라도 해당하면 포함합니다.
    let mut count_stmt = memo_count_stmt();
    count_stmt.and_where(
        Expr::col("receiver_id")
            .eq(user.id)
            .and(Expr::col("receiver_deleted").eq(0i64))
            .and(Expr::col("receiver_in_trash").eq(1i64))
            .or(Expr::col("sender_id")
                .eq(user.id)
                .and(Expr::col("sender_deleted").eq(0i64))
                .and(Expr::col("sender_in_trash").eq(1i64))),
    );
    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::select()
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), ("m", "content"), 
            ("m", "created_at"), ("m", "is_read"), ("m", "is_archived"), ("m", "is_spam"),
            ("m", "sender_in_trash"), ("m", "receiver_in_trash")
        ])
        .expr_as(Expr::col(("sender", "login")), "sender_login")
        .expr_as(Expr::col(("sender", "firstname")), "sender_firstname")
        .expr_as(Expr::col(("sender", "lastname")), "sender_lastname")
        .expr_as(Expr::col(("receiver", "login")), "receiver_login")
        .expr_as(Expr::col(("receiver", "firstname")), "receiver_firstname")
        .expr_as(Expr::col(("receiver", "lastname")), "receiver_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "users", "sender", Expr::col(("m", "sender_id")).equals(("sender", "id")))
        .join_as(JoinType::InnerJoin, "users", "receiver", Expr::col(("m", "receiver_id")).equals(("receiver", "id")))
        .and_where(
            Expr::col(("m", "receiver_id")).eq(user.id)
                .and(Expr::col(("m", "receiver_deleted")).eq(0i64))
                .and(Expr::col(("m", "receiver_in_trash")).eq(1i64))
                .or(Expr::col(("m", "sender_id")).eq(user.id)
                    .and(Expr::col(("m", "sender_deleted")).eq(0i64))
                    .and(Expr::col(("m", "sender_in_trash")).eq(1i64)))
        )
        .order_by(("m", "created_at"), Order::Desc)
        .limit(limit as u64)
        .offset(offset as u64)
        .to_owned();
    
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(json!({
            "id": row.get::<String, _>("id"),
            "sender_id": row.get::<i64, _>("sender_id").to_string(),
            "receiver_id": row.get::<i64, _>("receiver_id").to_string(),
            "title": row.get::<String, _>("title"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<String, _>("created_at"),
            "is_read": row.get::<i64, _>("is_read"),
            "is_archived": row.get::<i64, _>("is_archived"),
            "is_spam": row.get::<i64, _>("is_spam"),
            "sender_in_trash": row.get::<i64, _>("sender_in_trash"),
            "receiver_in_trash": row.get::<i64, _>("receiver_in_trash"),
            "sender_login": row.get::<String, _>("sender_login"),
            "sender_firstname": row.get::<String, _>("sender_firstname"),
            "sender_lastname": row.get::<String, _>("sender_lastname"),
            "receiver_login": row.get::<String, _>("receiver_login"),
            "receiver_firstname": row.get::<String, _>("receiver_firstname"),
            "receiver_lastname": row.get::<String, _>("receiver_lastname"),
        }));
    }

    Ok(Json(json!({ "success": true, "data": memos, "total": total })))
}

// 13. 휴지통 쪽지 복원
async fn restore_memo(
    Path(id): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut ownership_stmt = memo_by_id(&id);
    ownership_stmt.columns(["sender_id", "receiver_id"]);

    let ownership = crate::db::fetch_optional(&pool, &ownership_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = ownership {
        let sender_id = row.get::<i64, _>("sender_id");
        let receiver_id = row.get::<i64, _>("receiver_id");

        if user.id != sender_id && user.id != receiver_id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "해당 쪽지를 복원할 권한이 없습니다."}))));
        }

        if user.id == sender_id {
            let stmt = SeaQuery::update()
                .table("memos")
                .value("sender_in_trash", 0i64)
                .and_where(Expr::col("id").eq(id.clone()))
                .to_owned();
            crate::db::execute(&pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }

        if user.id == receiver_id {
            let stmt = SeaQuery::update()
                .table("memos")
                .value("receiver_in_trash", 0i64)
                .and_where(Expr::col("id").eq(id.clone()))
                .to_owned();
            crate::db::execute(&pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }

        Ok(Json(json!({ "success": true })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "쪽지를 찾을 수 없습니다."}))))
    }
}

// ─── 쪽지 폴더 CRUD 및 매핑 API 구현 ───

// 1. 폴더 목록 조회
async fn get_folders(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .columns(["id", "name", "created_at"])
        .from("memo_folders")
        .and_where(Expr::col("user_id").eq(user.id))
        .order_by("name", Order::Asc)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut folders = Vec::new();
    for row in rows {
        folders.push(json!({
            "id": row.get::<String, _>("id"),
            "name": row.get::<String, _>("name"),
            "created_at": row.get::<String, _>("created_at"),
        }));
    }
    Ok(Json(json!({"success": true, "data": folders})))
}

// 2. 새 폴더 생성
#[derive(serde::Deserialize)]
struct CreateFolderInput {
    name: String,
}

async fn create_folder(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Json(input): Json<CreateFolderInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if input.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "폴더 이름을 입력하세요."}))));
    }
    let id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();

    let stmt = SeaQuery::insert()
        .into_table("memo_folders")
        .columns(["id", "user_id", "name", "created_at"])
        .values_panic([
            id.clone().into(),
            user.id.into(),
            input.name.trim().into(),
            created_at.clone().into()
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({"success": true, "data": {"id": id.to_string(), "name": input.name.trim(), "created_at": created_at}})))
}

// 3. 폴더명 변경
#[derive(serde::Deserialize)]
struct UpdateFolderInput {
    name: String,
}

async fn update_folder(
    user: AuthUser,
    Path(id): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
    Json(input): Json<UpdateFolderInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if input.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "폴더 이름을 입력하세요."}))));
    }

    let stmt = SeaQuery::select()
        .column("user_id")
        .from("memo_folders")
        .and_where(Expr::col("id").eq(id.clone()))
        .to_owned();
    let folder = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = folder {
        if row.get::<i64, _>("user_id") != user.id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."}))));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "폴더를 찾을 수 없습니다."}))));
    }

    let stmt = SeaQuery::update()
        .table("memo_folders")
        .value("name", input.name.trim())
        .and_where(Expr::col("id").eq(id.clone()))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({"success": true})))
}

// 4. 폴더 삭제
async fn delete_folder(
    user: AuthUser,
    Path(id): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .column("user_id")
        .from("memo_folders")
        .and_where(Expr::col("id").eq(id.clone()))
        .to_owned();
    let folder = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = folder {
        if row.get::<i64, _>("user_id") != user.id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."}))));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "폴더를 찾을 수 없습니다."}))));
    }

    let stmt = SeaQuery::delete()
        .from_table("memo_folders")
        .and_where(Expr::col("id").eq(id.clone()))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({"success": true})))
}

// 5. 쪽지 폴더 이동
#[derive(serde::Deserialize)]
struct MoveMemosInput {
    memo_ids: Vec<String>,
    folder_id: Option<String>,
}

async fn move_memos_to_folder(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Json(input): Json<MoveMemosInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if let Some(ref fid) = input.folder_id {
    let stmt = SeaQuery::select()
        .column("user_id")
        .from("memo_folders")
        .and_where(Expr::col("id").eq(fid.clone()))
        .to_owned();
    let folder = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        if let Some(row) = folder {
            if row.get::<i64, _>("user_id") != user.id {
                return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "해당 폴더에 대한 권한이 없습니다."}))));
            }
        } else {
            return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "폴더를 찾을 수 없습니다."}))));
        }
    }

    for memo_id in &input.memo_ids {
        let stmt = SeaQuery::select()
            .columns(["sender_id", "receiver_id"])
            .from("memos")
            .and_where(Expr::col("id").eq(memo_id.clone()))
            .to_owned();
        let memo = crate::db::fetch_optional(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        if let Some(row) = memo {
            let sender_id = row.get::<i64, _>("sender_id");
            let receiver_id = row.get::<i64, _>("receiver_id");

            if user.id != sender_id && user.id != receiver_id {
                continue;
            }

            if let Some(ref fid) = input.folder_id {
                let stmt = SeaQuery::insert()
                    .into_table("memo_folder_mappings")
                    .columns(["memo_id", "user_id", "folder_id"])
                    .values_panic([
                        memo_id.clone().into(),
                        user.id.into(),
                        fid.clone().into()
                    ])
                    .on_conflict(
                        sea_query::OnConflict::columns(["memo_id", "user_id"])
                            .update_column("folder_id")
                            .value("folder_id", fid.clone())
                            .to_owned()
                    )
                    .to_owned();
                crate::db::execute(&pool, &stmt)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
            } else {
                let stmt = SeaQuery::delete()
                    .from_table("memo_folder_mappings")
                    .and_where(Expr::col("memo_id").eq(memo_id.clone()))
                    .and_where(Expr::col("user_id").eq(user.id))
                    .to_owned();
                crate::db::execute(&pool, &stmt)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
            }
        }
    }

    Ok(Json(json!({"success": true})))
}

// 6. 특정 폴더의 쪽지 목록 조회
async fn get_folder_memos(
    user: AuthUser,
    Path(folder_id): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let stmt = SeaQuery::select()
        .column("user_id")
        .from("memo_folders")
        .and_where(Expr::col("id").eq(folder_id.clone()))
        .to_owned();
    let folder = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = folder {
        if row.get::<i64, _>("user_id") != user.id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."}))));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "폴더를 찾을 수 없습니다."}))));
    }

    let mut count_stmt = SeaQuery::select();
    count_stmt
        .expr(Func::count(Expr::col(("m", "id"))))
        .from_as("memos", "m")
        .join_as(
            JoinType::InnerJoin,
            "memo_folder_mappings",
            "map",
            Expr::col(("m", "id"))
                .equals(("map", "memo_id"))
                .and(Expr::col(("map", "user_id")).eq(user.id)),
        )
        .and_where(Expr::col(("map", "folder_id")).eq(folder_id.clone()))
        .and_where(
            Expr::col(("m", "receiver_id"))
                .eq(user.id)
                .and(Expr::col(("m", "receiver_deleted")).eq(0i64))
                .and(Expr::col(("m", "receiver_in_trash")).eq(0i64))
                .or(Expr::col(("m", "sender_id"))
                    .eq(user.id)
                    .and(Expr::col(("m", "sender_deleted")).eq(0i64))
                    .and(Expr::col(("m", "sender_in_trash")).eq(0i64))),
        );
    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::select()
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), ("m", "content"), 
            ("m", "created_at"), ("m", "is_read"), ("m", "is_archived"), ("m", "is_spam"),
            ("m", "sender_in_trash"), ("m", "receiver_in_trash")
        ])
        .expr_as(Expr::col(("u_send", "login")), "sender_login")
        .expr_as(Expr::col(("u_send", "firstname")), "sender_firstname")
        .expr_as(Expr::col(("u_send", "lastname")), "sender_lastname")
        .expr_as(Expr::col(("u_recv", "login")), "receiver_login")
        .expr_as(Expr::col(("u_recv", "firstname")), "receiver_firstname")
        .expr_as(Expr::col(("u_recv", "lastname")), "receiver_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "memo_folder_mappings", "map", Expr::col(("m", "id")).equals(("map", "memo_id")).and(Expr::col(("map", "user_id")).eq(user.id)))
        .join_as(JoinType::InnerJoin, "users", "u_send", Expr::col(("m", "sender_id")).equals(("u_send", "id")))
        .join_as(JoinType::InnerJoin, "users", "u_recv", Expr::col(("m", "receiver_id")).equals(("u_recv", "id")))
        .and_where(Expr::col(("map", "folder_id")).eq(folder_id.clone()))
        .and_where(
            Expr::col(("m", "receiver_id")).eq(user.id)
                .and(Expr::col(("m", "receiver_deleted")).eq(0i64))
                .and(Expr::col(("m", "receiver_in_trash")).eq(0i64))
                .or(Expr::col(("m", "sender_id")).eq(user.id)
                    .and(Expr::col(("m", "sender_deleted")).eq(0i64))
                    .and(Expr::col(("m", "sender_in_trash")).eq(0i64)))
        )
        .order_by(("m", "created_at"), Order::Desc)
        .limit(limit as u64)
        .offset(offset as u64)
        .to_owned();
    
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(json!({
            "id": row.get::<String, _>("id"),
            "sender_id": row.get::<i64, _>("sender_id").to_string(),
            "receiver_id": row.get::<i64, _>("receiver_id").to_string(),
            "title": row.get::<String, _>("title"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<String, _>("created_at"),
            "is_read": row.get::<i64, _>("is_read"),
            "is_archived": row.get::<i64, _>("is_archived"),
            "is_spam": row.get::<i64, _>("is_spam"),
            "sender_in_trash": row.get::<i64, _>("sender_in_trash"),
            "receiver_in_trash": row.get::<i64, _>("receiver_in_trash"),
            "sender_login": row.get::<String, _>("sender_login"),
            "sender_firstname": row.get::<String, _>("sender_firstname"),
            "sender_lastname": row.get::<String, _>("sender_lastname"),
            "receiver_login": row.get::<String, _>("receiver_login"),
            "receiver_firstname": row.get::<String, _>("receiver_firstname"),
            "receiver_lastname": row.get::<String, _>("receiver_lastname"),
        }));
    }

    Ok(Json(json!({"success": true, "data": memos, "total": total})))
}

// 7. 쪽지 읽음/안읽음 상태 일괄 변경
async fn batch_toggle_read_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let memo_ids = payload.get("memo_ids")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<String>>())
        .unwrap_or_default();
    let is_read = payload.get("is_read").and_then(|v| v.as_i64()).unwrap_or(1);
    
    if memo_ids.is_empty() {
        return Ok(Json(json!({ "success": true })));
    }
    
    let stmt = SeaQuery::update()
        .table("memos")
        .value("is_read", is_read)
        .and_where(Expr::col("receiver_id").eq(user.id))
        .and_where(Expr::col("id").is_in(memo_ids.clone()))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "error": e.to_string() }))))?;
        
    Ok(Json(json!({ "success": true })))
}

// 8. 발송 대기 중인 예약 쪽지 목록 조회
async fn get_reserved_memos(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.get("page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).clamp(1, i64::MAX);
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut count_stmt = memo_count_stmt();
    count_stmt
        .and_where(Expr::col("sender_id").eq(user.id))
        .and_where(Expr::col("sender_deleted").eq(0i64))
        .and_where(Expr::col("reserved_at").is_not_null());
    let total: i64 = crate::db::fetch_scalar(&pool, &count_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::select()
        .columns([
            ("m", "id"), ("m", "sender_id"), ("m", "receiver_id"), ("m", "title"), 
            ("m", "content"), ("m", "created_at"), ("m", "is_read"), ("m", "is_sent"), ("m", "reserved_at"),
        ])
        .expr_as(Expr::col(("u", "login")), "receiver_login")
        .expr_as(Expr::col(("u", "firstname")), "receiver_firstname")
        .expr_as(Expr::col(("u", "lastname")), "receiver_lastname")
        .from_as("memos", "m")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("m", "receiver_id")))
        .and_where(Expr::col(("m", "sender_id")).eq(user.id))
        .and_where(Expr::col(("m", "sender_deleted")).eq(0i64))
        .and_where(Expr::col(("m", "reserved_at")).is_not_null())
        .order_by(("m", "reserved_at"), Order::Asc)
        .limit(limit as u64)
        .offset(offset as u64)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(json!({
            "id": row.get::<String, _>("id"),
            "sender_id": row.get::<i64, _>("sender_id").to_string(),
            "receiver_id": row.get::<i64, _>("receiver_id").to_string(),
            "title": row.get::<String, _>("title"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<String, _>("created_at"),
            "is_read": row.get::<i64, _>("is_read"),
            "is_sent": row.get::<i64, _>("is_sent"),
            "reserved_at": row.get::<Option<String>, _>("reserved_at"),
            "receiver_login": row.get::<String, _>("receiver_login"),
            "receiver_firstname": row.get::<String, _>("receiver_firstname"),
            "receiver_lastname": row.get::<String, _>("receiver_lastname"),
        }));
    }

    Ok(Json(json!({ "success": true, "data": memos, "total": total })))
}

// 9. 쪽지 보관 만료 기한 연장 (30일)
async fn extend_memo_expiry(
    user: AuthUser,
    Path(id): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .columns(["receiver_id", "is_read", "expires_at", "is_archived"])
        .from("memos")
        .and_where(Expr::col("id").eq(id.clone()))
        .to_owned();
    let row = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(r) = row {
        let receiver_id = r.get::<i64, _>("receiver_id");
        let is_read = r.get::<i64, _>("is_read");
        let is_archived = r.get::<i64, _>("is_archived");

        if user.id != receiver_id {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관 기한을 연장할 권한이 없습니다."}))));
        }

        if is_read == 0 {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "아직 읽지 않은 쪽지는 기한을 연장할 필요가 없습니다."}))));
        }

        if is_archived == 1 {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "보관함에 있는 쪽지는 영구 보관되므로 기한을 연장할 필요가 없습니다."}))));
        }

        // 현재 설정된 expires_at이 있으면 그 날짜를 기준으로 하고, 없으면 현재 시간 기준으로 30일 더 연장
        let current_expires = r.get::<Option<String>, _>("expires_at");
        let base_time = if let Some(ref ext_str) = current_expires {
            chrono::DateTime::parse_from_rfc3339(ext_str)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now())
        } else {
            chrono::Utc::now()
        };

        let new_expires_at = (base_time + chrono::Duration::days(30)).to_rfc3339();

    let stmt = SeaQuery::update()
        .table("memos")
        .value("expires_at", new_expires_at.as_str())
        .value("expiry_notified", 0i64)
        .and_where(Expr::col("id").eq(id.clone()))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;


        Ok(Json(json!({ "success": true, "data": { "new_expires_at": new_expires_at } })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "쪽지를 찾을 수 없습니다."}))))
    }
}
