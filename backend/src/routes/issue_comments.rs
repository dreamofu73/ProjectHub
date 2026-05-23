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
use crate::models::{CreateIssueCommentRequest, UpdateIssueCommentRequest};
use crate::routes::utils::{is_project_archived, require_project_member, display_name};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/issues/:id/comments", get(get_issue_comments).post(create_issue_comment))
            .route("/issues/comments/:comment_id", put(update_issue_comment).delete(delete_issue_comment)),
    )
}

async fn get_issue_comments(
    Path(issue_id_str): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let issue_id = crate::serde_utils::parse_path_id(&issue_id_str)?;
    let stmt = SeaQuery::select()
        .expr(Expr::col(("c", Asterisk)))
        .expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "author_firstname")
        .expr_as(Expr::col(("u", "lastname")), "author_lastname")
        .from_as("comments", "c")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("c", "author_id")))
        .and_where(Expr::col(("c", "issue_id")).eq(issue_id))
        .order_by(("c", "created_at"), Order::Asc)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut comments: Vec<Value> = Vec::new();
    for r in rows {
        let comment_id: i64 = r.get("id");
        let stmt = SeaQuery::select()
            .columns(["id", "filename", "filesize", "content_type"])
            .from("attachments")
            .and_where(Expr::col("comment_id").eq(comment_id))
            .order_by("created_at", Order::Asc)
            .to_owned();
        let att_rows = crate::db::fetch_all(&pool, &stmt).await.unwrap_or_default();

        let attachments: Vec<Value> = att_rows.iter().map(|a| {
            json!({
                "id": a.get::<i64, _>("id").to_string(),
                "filename": a.get::<String, _>("filename"),
                "filesize": a.get::<i64, _>("filesize"),
                "content_type": a.get::<String, _>("content_type"),
            })
        }).collect();

        let updated_at: Option<String> = r.get("updated_at");
        comments.push(json!({
            "id": comment_id.to_string(),
            "issue_id": r.get::<i64, _>("issue_id").to_string(),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": r.get::<String, _>("author_login"),
            "author_name": display_name(
                r.get::<Option<String>, _>("author_firstname").as_deref(),
                r.get::<Option<String>, _>("author_lastname").as_deref(),
                &r.get::<String, _>("author_login"),
            ),
            "content": r.get::<String, _>("content"),
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": updated_at,
            "attachments": attachments,
        }));
    }

    Ok(Json(json!({ "success": true, "data": comments })))
}

async fn create_issue_comment(
    Path(issue_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<CreateIssueCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let issue_id = crate::serde_utils::parse_path_id(&issue_id_str)?;
    // Get project_id for permission check
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("issues")
        .and_where(Expr::col("id").eq(issue_id))
        .to_owned();
    let project_info = crate::db::fetch_optional(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;

    let project_id: i64 = project_info.get(0);
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let now = crate::db::now_string();
    let comment_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("comments")
        .columns(["id", "issue_id", "author_id", "content", "created_at", "updated_at"])
        .values_panic([comment_id.into(), issue_id.into(), user.id.into(), req.content.into(), now.clone().into(), now.into()])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(attachment_ids) = req.attachment_ids {
        for att_id in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("comment_id", comment_id)
                .and_where(Expr::col("id").eq(att_id))
                .to_owned();
            let _ = crate::db::execute(&pool, &stmt).await;
        }
    }

    Ok(Json(json!({ "success": true, "id": comment_id.to_string() })))
}

async fn update_issue_comment(
    Path(comment_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<UpdateIssueCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let comment_id = crate::serde_utils::parse_path_id(&comment_id_str)?;
    let stmt = SeaQuery::select()
        .column("author_id")
        .from("comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    let comment = crate::db::fetch_optional(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Comment not found"}))))?;

    let author_id: i64 = comment.get("author_id");
    if user.id != author_id && user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "Permission denied"}))));
    }

    let stmt = SeaQuery::update()
        .table("comments")
        .value("content", &req.content)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn delete_issue_comment(
    Path(comment_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let comment_id = crate::serde_utils::parse_path_id(&comment_id_str)?;
    let stmt = SeaQuery::select()
        .column("author_id")
        .from("comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    let comment = crate::db::fetch_optional(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Comment not found"}))))?;

    let author_id: i64 = comment.get("author_id");
    if user.id != author_id && user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "Permission denied"}))));
    }

    // Delete attachment files from disk
    let stmt = SeaQuery::select()
        .column("disk_filename")
        .from("attachments")
        .and_where(Expr::col("comment_id").eq(comment_id))
        .to_owned();
    let att_rows = crate::db::fetch_all(&pool, &stmt).await.unwrap_or_default();

    for row in att_rows {
        let disk_filename: String = row.get(0);
        let path = std::path::Path::new(&app_config.upload_dir).join(disk_filename);
        let _ = tokio::fs::remove_file(path).await;
    }

    // Delete attachment records
    let stmt = SeaQuery::delete()
        .from_table("attachments")
        .and_where(Expr::col("comment_id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Delete comment
    let stmt = SeaQuery::delete()
        .from_table("comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
