use axum::{
    extract::{Extension, Path, Query},
    response::Json,
    http::StatusCode,
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Expr, ExprTrait, JoinType, Order, Query as SeaQuery, SimpleExpr, Func};
use crate::auth::AuthUser;
use crate::routes::utils::{check_project_access, require_project_member, is_project_archived, display_name};
use std::path::Path as StdPath;
use std::collections::HashMap;


#[derive(serde::Deserialize)]
pub struct CreateWikiPageRequest {
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub project_id: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub parent_id: Option<i64>,
    pub title: String,
    pub content: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}

#[derive(serde::Deserialize)]
pub struct UpdateWikiPageRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub parent_id: Option<i64>,
}

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/wiki", get(get_wiki_pages))
            .route("/wiki", post(create_wiki_page))
            .route("/wiki/:id", put(update_wiki_page).delete(delete_wiki_page))
            .route("/wiki/:id/attachments", get(get_wiki_attachments))
            .route("/wiki/:id/versions", get(get_wiki_versions))
            .route("/wiki/:id/versions/:version_id", get(get_wiki_version))
            .route("/wiki/:id/comments", get(get_wiki_comments))
            .route("/wiki/:id/comments", post(create_wiki_comment))
            .route("/wiki/:id/comments/:comment_id", put(update_wiki_comment).delete(delete_wiki_comment))
            .route("/wiki/:id/versions/:version_id/restore", post(restore_wiki_version)),
    )
}

async fn get_wiki_pages(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = params.get("project_id").and_then(|v| v.parse::<i64>().ok());

    if let Some(pid) = project_id {
        check_project_access(&pool, &user, &pid.to_string()).await?;
    }

    let mut stmt = SeaQuery::select();
    stmt.columns([
        ("w", "id"), ("w", "project_id"), ("w", "parent_id"), ("w", "title"), ("w", "slug"), ("w", "content"), ("w", "updated_at")
    ]);
    stmt.expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "firstname")
        .expr_as(Expr::col(("u", "lastname")), "lastname");
    
    if let Some(pid) = project_id {
        stmt.expr_as(Expr::col(("p", "name")), "project_name")
            .expr_as(Expr::col(("p", "identifier")), "project_identifier")
            .from_as("wiki_pages", "w")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("w", "author_id")))
            .join_as(JoinType::LeftJoin, "projects", "p", Expr::col(("p", "id")).equals(("w", "project_id")))
            .and_where(Expr::col(("w", "project_id")).eq(pid));
    } else {
        stmt.expr(Expr::cust("NULL AS project_name"))
            .expr(Expr::cust("NULL AS project_identifier"))
            .from_as("wiki_pages", "w")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("w", "author_id")))
            .and_where(Expr::col(("w", "project_id")).is_null());
    }
    stmt.order_by(("w", "updated_at"), Order::Desc);

    let rows = crate::db::fetch_all(&pool, &stmt).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let pages: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "project_id": r.get::<Option<i64>, _>("project_id").map(|v| v.to_string()),
            "parent_id": r.get::<Option<i64>, _>("parent_id").map(|v| v.to_string()),
            "title": r.get::<String, _>("title"),
            "slug": r.get::<String, _>("slug"),
            "content": r.get::<Option<String>, _>("content").unwrap_or_default(),
            "author_login": r.get::<String, _>("author_login"),
            "author_name": display_name(r.get::<Option<String>, _>("firstname").as_deref(), r.get::<Option<String>, _>("lastname").as_deref(), &r.get::<String, _>("author_login")),
            "project_name": r.get::<Option<String>, _>("project_name"),
            "project_identifier": r.get::<Option<String>, _>("project_identifier"),
            "updated_at": r.get::<String, _>("updated_at")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": pages })))
}

async fn create_wiki_page(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(wiki_data): axum::Json<CreateWikiPageRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = wiki_data.project_id;
    let parent_id = wiki_data.parent_id;

    if let Some(pid) = project_id {
        let stmt = SeaQuery::select()
            .expr(Expr::val(1))
            .from("projects")
            .and_where(Expr::col("id").eq(pid))
            .to_owned();
        let proj_exists = crate::db::fetch_optional(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        if proj_exists.is_none() {
            return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "프로젝트가 존재하지 않습니다."}))));
        }
        require_project_member(&pool, &user, pid).await?;
        if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }
    } else if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "글로벌 위키는 관리자만 작성 가능합니다."}))));
    }

    let title = wiki_data.title;
    let content = wiki_data.content.unwrap_or_default();

    let slug = title.to_lowercase().replace(|c: char| !c.is_alphanumeric(), "-");
    let author_id = user.id;

    // SQLite UNIQUE(project_id, slug) 에서 NULL 끼리는 구분되므로
    // 글로벌 위키(project_id IS NULL) 의 슬러그 중복을 별도 체크한다.
    if project_id.is_none() {
        let stmt = SeaQuery::select()
            .column("id")
            .from("wiki_pages")
            .and_where(Expr::col("project_id").is_null())
            .and_where(Expr::col("slug").eq(&slug))
            .to_owned();
        let dup = crate::db::fetch_optional(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        if dup.is_some() {
            return Err((StatusCode::CONFLICT, Json(json!({"success": false, "error": "이미 동일한 이름의 글로벌 위키 페이지가 존재합니다."}))));
        }
    }

    let page_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("wiki_pages")
        .columns(["id", "project_id", "parent_id", "title", "slug", "content", "author_id", "created_at", "updated_at"])
        .values_panic([
            page_id.into(),
            project_id.into(),
            parent_id.into(),
            title.clone().into(),
            slug.clone().into(),
            content.clone().into(),
            author_id.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| {
            let msg = if e.to_string().contains("UNIQUE constraint failed") || e.to_string().contains("duplicate key") {
                "이미 동일한 이름의 위키 페이지가 존재합니다.".to_string()
            } else {
                e.to_string()
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": msg})))
        })?;

    if let Some(pid) = project_id {
        let stmt = SeaQuery::insert()
            .into_table("activity_logs")
            .columns(["id", "project_id", "user_id", "action_type", "subject_type", "subject_id", "subject_title", "created_at"])
            .values_panic([
                crate::db::new_id().into(),
                pid.into(),
                author_id.into(),
                "created".into(),
                "wiki".into(),
                page_id.into(),
                title.into(),
                crate::db::now_string().into(),
            ])
            .to_owned();
        let _ = crate::db::execute(&pool, &stmt).await;
    }

    if let Some(attachment_ids) = wiki_data.attachment_ids {
        for att_id in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("wiki_page_id", page_id)
                .and_where(Expr::col("id").eq(att_id))
                .to_owned();
            let _ = crate::db::execute(&pool, &stmt).await;
        }
    }
    Ok(Json(json!({ "success": true, "data": { "id": page_id.to_string(), "slug": slug } })))
}

async fn update_wiki_page(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(wiki_data): axum::Json<UpdateWikiPageRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["project_id", "title", "content", "author_id"])
        .from("wiki_pages")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let wiki_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Wiki page not found"}))))?;

    let project_id: Option<i64> = wiki_info.get("project_id");
    if let Some(pid) = project_id {
        require_project_member(&pool, &user, pid).await?;
        if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }
    } else if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "글로벌 위키는 관리자만 수정 가능합니다."}))));
    }

    let title = wiki_data.title;
    let content = wiki_data.content;
    let parent_id = wiki_data.parent_id;
    let author_id = user.id;

    // Save current version before updating (if content actually changed)
    let current_title: String = wiki_info.get("title");
    let current_content: String = wiki_info.get::<Option<String>, _>("content").unwrap_or_default();
    let current_author_id: i64 = wiki_info.get("author_id");

    if title.as_ref().map_or(true, |t| t != &current_title) || content.as_ref().map_or(true, |c| c != &current_content) {
        // Get next version number
        let stmt = SeaQuery::select()
            .expr(Func::coalesce(vec![SimpleExpr::from(Func::max(Expr::col("version"))), SimpleExpr::from(0)]))
            .from("wiki_page_versions")
            .and_where(Expr::col("wiki_page_id").eq(id))
            .to_owned();



        let max_ver: Option<i64> = crate::db::fetch_scalar_optional(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let next_version = max_ver.map_or(1, |v| v + 1);

        let stmt = SeaQuery::insert()
            .into_table("wiki_page_versions")
            .columns(["id", "wiki_page_id", "title", "content", "author_id", "version", "created_at"])
            .values_panic([
                crate::db::new_id().into(),
                id.into(),
                current_title.into(),
                current_content.into(),
                current_author_id.into(),
                next_version.into(),
                crate::db::now_string().into(),
            ])
            .to_owned();
        crate::db::execute(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    }

    let mut stmt = SeaQuery::update();
    stmt.table("wiki_pages");
    if let Some(t) = title { stmt.value("title", t); }
    if let Some(c) = content { stmt.value("content", c); }
    if let Some(p) = parent_id { stmt.value("parent_id", p); }
    stmt.value("author_id", author_id)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(id));
    
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn delete_wiki_page(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("wiki_pages")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let wiki_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Wiki page not found"}))))?;

    let project_id: Option<i64> = wiki_info.get("project_id");
    if let Some(pid) = project_id {
        require_project_member(&pool, &user, pid).await?;
        if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }
    } else if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "글로벌 위키는 관리자만 삭제 가능합니다."}))));
    }

    let stmt = SeaQuery::select()
        .column("disk_filename")
        .from("attachments")
        .and_where(Expr::col("wiki_page_id").eq(id))
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    for r in rows {
        let disk_filename: String = r.get("disk_filename");
        let path = StdPath::new(&app_config.upload_dir).join(disk_filename);
        let _ = std::fs::remove_file(path);
    }

    let stmt = SeaQuery::delete()
        .from_table("attachments")
        .and_where(Expr::col("wiki_page_id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::delete()
        .from_table("wiki_pages")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn get_wiki_comments(
    Path(page_id_str): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page_id = crate::serde_utils::parse_path_id(&page_id_str)?;
    let stmt = SeaQuery::select()
        .columns([
            ("wc", "id"), ("wc", "wiki_page_id"), ("wc", "author_id"), ("wc", "content"), ("wc", "created_at"), ("wc", "updated_at")
        ])
        .expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "firstname")
        .expr_as(Expr::col(("u", "lastname")), "lastname")
        .from_as("wiki_comments", "wc")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("wc", "author_id")))
        .and_where(Expr::col(("wc", "wiki_page_id")).eq(page_id))
        .order_by(("wc", "created_at"), Order::Asc)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut comments: Vec<Value> = Vec::new();
    for r in rows {
        let comment_id: i64 = r.get("id");
        let stmt = SeaQuery::select()
            .columns(["id", "filename", "filesize", "content_type"])
            .from("attachments")
            .and_where(Expr::col("comment_id").eq(comment_id))
            .order_by("created_at", Order::Asc)
            .to_owned();
        let att_rows = crate::db::fetch_all(&pool, &stmt)
            .await
            .unwrap_or_default();

        let attachments: Vec<Value> = att_rows.iter().map(|a| {
            json!({
                "id": a.get::<i64, _>("id").to_string(),
                "filename": a.get::<String, _>("filename"),
                "filesize": a.get::<i64, _>("filesize"),
                "content_type": a.get::<String, _>("content_type"),
            })
        }).collect();

        let _ = app_config.upload_dir.as_str();
        comments.push(json!({
            "id": comment_id.to_string(),
            "wiki_page_id": r.get::<i64, _>("wiki_page_id").to_string(),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": r.get::<String, _>("author_login"),
            "author_name": display_name(r.get::<Option<String>, _>("firstname").as_deref(), r.get::<Option<String>, _>("lastname").as_deref(), &r.get::<String, _>("author_login")),
            "content": r.get::<String, _>("content"),
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": r.get::<String, _>("updated_at"),
            "attachments": attachments,
        }));
    }

    Ok(Json(json!({ "success": true, "data": comments })))
}

async fn create_wiki_comment(
    Path(page_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(comment_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page_id = crate::serde_utils::parse_path_id(&page_id_str)?;
    // Verify wiki page exists and check access
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("wiki_pages")
        .and_where(Expr::col("id").eq(page_id))
        .to_owned();
    let page_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Wiki page not found"}))))?;

    let project_id: Option<i64> = page_info.get("project_id");
    if let Some(pid) = project_id {
        require_project_member(&pool, &user, pid).await?;
        if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }
    } else if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 댓글을 작성할 수 있습니다."}))));
    }

    let content = comment_data.get("content").and_then(|v| v.as_str()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "content is required"}))))?;

    let comment_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("wiki_comments")
        .columns(["id", "wiki_page_id", "author_id", "content", "created_at", "updated_at"])
        .values_panic([
            comment_id.into(),
            page_id.into(),
            user.id.into(),
            content.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "id": comment_id.to_string() })))
}

async fn update_wiki_comment(
    Path((_page_id_str, comment_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let comment_id = crate::serde_utils::parse_path_id(&comment_id_str)?;
    let stmt = SeaQuery::select()
        .column("author_id")
        .from("wiki_comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    let comment = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Comment not found"}))))?;

    let author_id: i64 = comment.get("author_id");
    if user.id != author_id && user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "Permission denied"}))));
    }

    let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let stmt = SeaQuery::update()
        .table("wiki_comments")
        .value("content", content)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn delete_wiki_comment(
    Path((_page_id_str, comment_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let comment_id = crate::serde_utils::parse_path_id(&comment_id_str)?;
    let stmt = SeaQuery::select()
        .column("author_id")
        .from("wiki_comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    let comment = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
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
    let att_rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .unwrap_or_default();
    for row in att_rows {
        let disk_filename: String = row.get("disk_filename");
        let path = std::path::Path::new(&app_config.upload_dir).join(disk_filename);
        let _ = tokio::fs::remove_file(path).await;
    }
    let stmt = SeaQuery::delete()
        .from_table("attachments")
        .and_where(Expr::col("comment_id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::delete()
        .from_table("wiki_comments")
        .and_where(Expr::col("id").eq(comment_id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn get_wiki_attachments(
    Path(id_str): Path<String>,
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns([
            ("a", "id"), ("a", "filename"), ("a", "content_type"), ("a", "filesize"), ("a", "description"), ("a", "created_at")
        ])
        .expr_as(Expr::col(("u", "login")), "author_login")
        .from_as("attachments", "a")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("a", "author_id")))
        .and_where(Expr::col(("a", "wiki_page_id")).eq(id))
        .order_by(("a", "created_at"), Order::Desc)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let attachments: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "filename": r.get::<String, _>("filename"),
            "content_type": r.get::<Option<String>, _>("content_type"),
            "filesize": r.get::<i64, _>("filesize"),
            "description": r.get::<Option<String>, _>("description"),
            "author_login": r.get::<String, _>("author_login"),
            "created_at": r.get::<String, _>("created_at")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": attachments })))
}

async fn get_wiki_versions(
    Path(id_str): Path<String>,
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns([
            ("v", "id"), ("v", "wiki_page_id"), ("v", "title"), ("v", "content"), ("v", "author_id"), ("v", "version"), ("v", "created_at")
        ])
        .expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "firstname")
        .expr_as(Expr::col(("u", "lastname")), "lastname")
        .from_as("wiki_page_versions", "v")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("v", "author_id")))
        .and_where(Expr::col(("v", "wiki_page_id")).eq(id))
        .order_by(("v", "version"), Order::Desc)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let versions: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "wiki_page_id": r.get::<i64, _>("wiki_page_id").to_string(),
            "title": r.get::<String, _>("title"),
            "content": r.get::<String, _>("content"),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": r.get::<String, _>("author_login"),
            "author_name": display_name(r.get::<Option<String>, _>("firstname").as_deref(), r.get::<Option<String>, _>("lastname").as_deref(), &r.get::<String, _>("author_login")),
            "version": r.get::<i64, _>("version"),
            "created_at": r.get::<String, _>("created_at")
        })
    }).collect();


    Ok(Json(json!({ "success": true, "data": versions })))
}

async fn get_wiki_version(
    Path((page_id_str, version_id_str)): Path<(String, String)>,
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page_id = crate::serde_utils::parse_path_id(&page_id_str)?;
    let version_id = crate::serde_utils::parse_path_id(&version_id_str)?;
    let stmt = SeaQuery::select()
        .columns([
            ("v", "id"), ("v", "wiki_page_id"), ("v", "title"), ("v", "content"), ("v", "author_id"), ("v", "version"), ("v", "created_at")
        ])
        .expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "firstname")
        .expr_as(Expr::col(("u", "lastname")), "lastname")
        .from_as("wiki_page_versions", "v")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("v", "author_id")))
        .and_where(Expr::col(("v", "wiki_page_id")).eq(page_id))
        .and_where(Expr::col(("v", "id")).eq(version_id))
        .to_owned();
    let version = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Version not found"}))))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": version.get::<i64, _>("id").to_string(),
            "wiki_page_id": version.get::<i64, _>("wiki_page_id").to_string(),
            "title": version.get::<String, _>("title"),
            "content": version.get::<String, _>("content"),
            "author_id": version.get::<i64, _>("author_id").to_string(),
            "author_login": version.get::<String, _>("author_login"),
            "author_name": display_name(version.get::<Option<String>, _>("firstname").as_deref(), version.get::<Option<String>, _>("lastname").as_deref(), &version.get::<String, _>("author_login")),
            "version": version.get::<i64, _>("version"),
            "created_at": version.get::<String, _>("created_at")
        }
    })))
}

async fn restore_wiki_version(
    Path((page_id_str, version_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page_id = crate::serde_utils::parse_path_id(&page_id_str)?;
    let version_id = crate::serde_utils::parse_path_id(&version_id_str)?;
    // Verify page exists and check access
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("wiki_pages")
        .and_where(Expr::col("id").eq(page_id))
        .to_owned();
    let page_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Wiki page not found"}))))?;

    let project_id: Option<i64> = page_info.get("project_id");
    if let Some(pid) = project_id {
        require_project_member(&pool, &user, pid).await?;
        if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }
    } else if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "글로벌 위키는 관리자만 복원 가능합니다."}))));
    }

    // Fetch the version
    let stmt = SeaQuery::select()
        .columns(["title", "content"])
        .from("wiki_page_versions")
        .and_where(Expr::col("wiki_page_id").eq(page_id))
        .and_where(Expr::col("id").eq(version_id))
        .to_owned();
    let version = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Version not found"}))))?;

    let restored_title: String = version.get("title");
    let restored_content: String = version.get("content");

    // Save current version before restoring
    let stmt = SeaQuery::select()
        .columns(["title", "content", "author_id"])
        .from("wiki_pages")
        .and_where(Expr::col("id").eq(page_id))
        .to_owned();
    let current = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Wiki page not found"}))))?;

    let current_title: String = current.get("title");
    let current_content: String = current.get::<Option<String>, _>("content").unwrap_or_default();
    let current_author_id: i64 = current.get("author_id");

    let stmt = SeaQuery::select()
        .expr(Expr::cust("COALESCE(MAX(version), 0)"))
        .from("wiki_page_versions")
        .and_where(Expr::col("wiki_page_id").eq(page_id))
        .to_owned();
    let max_ver: Option<i64> = crate::db::fetch_scalar_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let next_version = max_ver.map_or(1, |v| v + 1);

    let stmt = SeaQuery::insert()
        .into_table("wiki_page_versions")
        .columns(["id", "wiki_page_id", "title", "content", "author_id", "version", "created_at"])
        .values_panic([
            crate::db::new_id().into(),
            page_id.into(),
            current_title.into(),
            current_content.into(),
            current_author_id.into(),
            next_version.into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Restore the old version as current
    let stmt = SeaQuery::update()
        .table("wiki_pages")
        .value("title", restored_title)
        .value("content", restored_content)
        .value("author_id", user.id)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(page_id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
