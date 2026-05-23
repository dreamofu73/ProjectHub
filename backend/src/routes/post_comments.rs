use axum::{
    extract::{Extension, Path},
    response::Json,
    http::StatusCode,
    routing::{get, put},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery};
use crate::auth::AuthUser;
use crate::models::{CreatePostCommentRequest, UpdatePostCommentRequest};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/posts/:id/comments", get(get_post_comments).post(create_post_comment))
            .route("/posts/comments/:comment_id", put(update_post_comment).delete(delete_post_comment)),
    )
}

async fn get_post_comments(
    Path(post_id_str): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let post_id = crate::serde_utils::parse_path_id(&post_id_str)?;
    let stmt = SeaQuery::select()
        .expr(Expr::col(("c", Asterisk)))
        .expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "author_firstname")
        .expr_as(Expr::col(("u", "lastname")), "author_lastname")
        .from_as("post_comments", "c")
        .join_as(
            JoinType::InnerJoin,
            "users",
            "u",
            Expr::col(("u", "id")).equals(("c", "author_id")),
        )
        .and_where(Expr::col(("c", "post_id")).eq(post_id))
        .order_by(("c", "created_at"), Order::Asc)
        .to_owned();

    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut comments: Vec<Value> = Vec::new();
    for r in rows {
        let comment_id: i64 = r.get("id");
        // 해당 댓글의 첨부파일 목록 조회
        let att_stmt = SeaQuery::select()
            .columns(["id", "filename", "filesize", "content_type"])
            .from("attachments")
            .and_where(Expr::col("comment_id").eq(comment_id))
            .order_by("created_at", Order::Asc)
            .to_owned();

        let att_rows = crate::db::fetch_all(&pool, &att_stmt).await.unwrap_or_default();

        let attachments: Vec<Value> = att_rows.iter().map(|a| {
            json!({
                "id": a.get::<i64, _>("id").to_string(),
                "filename": a.get::<String, _>("filename"),
                "filesize": a.get::<i64, _>("filesize"),
                "content_type": a.get::<String, _>("content_type"),
            })
        }).collect();

        comments.push(json!({
            "id": comment_id.to_string(),
            "post_id": r.get::<i64, _>("post_id").to_string(),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": r.get::<String, _>("author_login"),
            "author_name": crate::routes::utils::display_name(
                r.get::<Option<String>, _>("author_firstname").as_deref(),
                r.get::<Option<String>, _>("author_lastname").as_deref(),
                &r.get::<String, _>("author_login"),
            ),
            "content": r.get::<String, _>("content"),
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": r.get::<String, _>("updated_at"),
            "attachments": attachments,
        }));
    }

    Ok(Json(json!({ "success": true, "data": comments })))
}

async fn create_post_comment(
    Path(post_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<CreatePostCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let post_id = crate::serde_utils::parse_path_id(&post_id_str)?;
    let now = crate::db::now_string();
    let comment_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("post_comments")
        .columns(["id", "post_id", "author_id", "content", "created_at", "updated_at"])
        .values_panic([
            comment_id.into(),
            post_id.into(),
            user.id.into(),
            req.content.clone().into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    Ok(Json(json!({ "success": true, "id": comment_id.to_string() })))
}

async fn update_post_comment(
    Path(comment_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<UpdatePostCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let comment_id = crate::serde_utils::parse_path_id(&comment_id_str)?;
    let author_stmt = SeaQuery::select()
        .column("author_id")
        .from("post_comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();

    let comment = crate::db::fetch_optional(&pool, &author_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Comment not found"}))))?;

    let author_id: i64 = comment.get("author_id");
    if user.id != author_id && user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "Permission denied"}))));
    }

    let update_stmt = SeaQuery::update()
        .table("post_comments")
        .value("content", req.content.clone())
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();

    crate::db::execute(&pool, &update_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn delete_post_comment(
    Path(comment_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let comment_id = crate::serde_utils::parse_path_id(&comment_id_str)?;
    let author_stmt = SeaQuery::select()
        .column("author_id")
        .from("post_comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();

    let comment = crate::db::fetch_optional(&pool, &author_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Comment not found"}))))?;

    let author_id: i64 = comment.get("author_id");
    if user.id != author_id && user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "Permission denied"}))));
    }

    // 댓글 첨부파일 디스크에서 삭제
    let disk_stmt = SeaQuery::select()
        .column("disk_filename")
        .from("attachments")
        .and_where(Expr::col("comment_id").eq(comment_id))
        .to_owned();

    let att_rows = crate::db::fetch_all(&pool, &disk_stmt).await.unwrap_or_default();

    for row in att_rows {
        let disk_filename: String = row.get(0);
        let path = std::path::Path::new(&app_config.upload_dir).join(disk_filename);
        let _ = tokio::fs::remove_file(path).await;
    }

    // DB에서 첨부파일 레코드 삭제
    let delete_attachments = SeaQuery::delete()
        .from_table("attachments")
        .and_where(Expr::col("comment_id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &delete_attachments)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let delete_comment = SeaQuery::delete()
        .from_table("post_comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &delete_comment)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
