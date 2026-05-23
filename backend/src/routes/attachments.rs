use axum::{
    extract::{Extension, Path, Multipart},
    response::{IntoResponse, Json},
    http::{StatusCode, header},
    routing::{get, post, delete},
    Router,
};
use std::sync::Arc;
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Expr, ExprTrait, Query as SeaQuery, SelectStatement};

/// 첨부가 매달린 상위 리소스의 `project_id` 조회용 질의.
fn parent_project_stmt(table: &'static str, id: i64) -> SelectStatement {
    SeaQuery::select()
        .column("project_id")
        .from(table)
        .and_where(Expr::col("id").eq(id))
        .to_owned()
}
use axum::body::Body;
use std::path::Path as StdPath;
use tokio::io::AsyncWriteExt;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/attachments/batch-download", get(batch_download))
            .route("/attachments", post(upload_attachment))
            .route("/attachments/:id", get(download_attachment))
            .route("/attachments/:id", delete(delete_attachment)),
    )
}

pub async fn upload_attachment(
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
    user: crate::auth::AuthUser,
    mut multipart: Multipart,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut description = Some("".to_string());
    let mut issue_id = None;
    let mut wiki_page_id = None;
    let mut post_id = None;
    let mut comment_id = None;
    let mut memo_ids = Vec::<String>::new();
    
    let mut files_to_save = Vec::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            let original_name = field.file_name().unwrap_or("file").to_string();
            let ext = StdPath::new(&original_name).extension().and_then(|e| e.to_str()).unwrap_or("").to_string();
            let file_data = field.bytes().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?.to_vec();
            files_to_save.push((original_name, ext, file_data));
        } else if name == "description" {
            description = Some(field.text().await.unwrap_or_default());
        } else if name == "issue_id" {
            issue_id = field.text().await.unwrap_or_default().parse::<i64>().ok();
        } else if name == "wiki_page_id" {
            wiki_page_id = field.text().await.unwrap_or_default().parse::<i64>().ok();
        } else if name == "post_id" {
            post_id = field.text().await.unwrap_or_default().parse::<i64>().ok();
        } else if name == "comment_id" {
            comment_id = field.text().await.unwrap_or_default().parse::<i64>().ok();
        } else if name == "memo_ids" {
            let text = field.text().await.unwrap_or_default();
            if let Ok(Value::Array(arr)) = serde_json::from_str(&text) {
                memo_ids = arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
            } else {
                memo_ids = text.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            }
        }
    }

    if files_to_save.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "No files uploaded"}))));
    }

    let mut saved_attachments = Vec::new();

    for (original_name, ext, file_data) in files_to_save {
        if !app_config.allowed_extensions.contains(&ext.to_lowercase()) {
            continue; // Skip invalid extensions
        }

        let disk_filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
        let upload_dir = &app_config.upload_dir;

        if !StdPath::new(upload_dir).exists() {
            let _ = tokio::fs::create_dir_all(upload_dir).await;
        }

        let path = StdPath::new(upload_dir).join(&disk_filename);
        let mut file = File::create(&path).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        file.write_all(&file_data).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let filesize = file_data.len() as i64;
        let content_type = mime_guess::from_path(&original_name).first_or_octet_stream().to_string();

        let mut last_id = 0i64;
        if !memo_ids.is_empty() {
            for memo_id in &memo_ids {
                let attachment_id = crate::db::new_id();
                let stmt = SeaQuery::insert()
                    .into_table("attachments")
                    .columns([
                        "id",
                        "filename",
                        "disk_filename",
                        "filesize",
                        "content_type",
                        "description",
                        "author_id",
                        "memo_id",
                        "created_at",
                    ])
                    .values_panic([
                        attachment_id.into(),
                        original_name.clone().into(),
                        disk_filename.clone().into(),
                        filesize.into(),
                        content_type.clone().into(),
                        description.clone().into(),
                        user.id.into(),
                        memo_id.into(),
                        crate::db::now_string().into(),
                    ])
                    .to_owned();

                crate::db::execute(&pool, &stmt)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
                last_id = attachment_id;
            }
        } else {
            let attachment_id = crate::db::new_id();
            let stmt = SeaQuery::insert()
                .into_table("attachments")
                .columns([
                    "id",
                    "filename",
                    "disk_filename",
                    "filesize",
                    "content_type",
                    "description",
                    "author_id",
                    "issue_id",
                    "wiki_page_id",
                    "post_id",
                    "comment_id",
                    "created_at",
                ])
                .values_panic([
                    attachment_id.into(),
                    original_name.clone().into(),
                    disk_filename.clone().into(),
                    filesize.into(),
                    content_type.clone().into(),
                    description.clone().into(),
                    user.id.into(),
                    issue_id.into(),
                    wiki_page_id.into(),
                    post_id.into(),
                    comment_id.into(),
                    crate::db::now_string().into(),
                ])
                .to_owned();

            crate::db::execute(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
            last_id = attachment_id;
        }

        saved_attachments.push(json!({
            "id": last_id.to_string(),
            "filename": original_name,
            "filesize": filesize,
            "content_type": content_type
        }));
    }

    if saved_attachments.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "No valid files uploaded"}))));
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": saved_attachments[0]["id"],
            "attachments": saved_attachments
        }
    })))
}

pub async fn download_attachment(
    Path(id_str): Path<String>,
    user: crate::auth::AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns([
            "disk_filename",
            "content_type",
            "filename",
            "issue_id",
            "wiki_page_id",
            "post_id",
            "memo_id",
        ])
        .from("attachments")
        .and_where(Expr::col("id").eq(id))
        .to_owned();

    let row = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Attachment not found"}))))?;

    let disk_filename: String = row.get(0);
    let content_type: String = row.get(1);
    let filename: String = row.get(2);
    let issue_id: Option<i64> = row.get(3);
    let wiki_page_id: Option<i64> = row.get(4);
    let post_id: Option<i64> = row.get(5);
    let memo_id: Option<String> = row.get(6);

    // Basic authorization check: verify access to parent resource
    if user.role != "admin" {
        if let Some(iid) = issue_id {
            let res = crate::db::fetch_optional(&pool, &parent_project_stmt("issues", iid)).await.unwrap_or(None);
            if let Some(r) = res {
                let pid: i64 = r.get(0);
                let _ = crate::routes::utils::check_project_access(&pool, &user, &pid.to_string()).await?;
            }
        } else if let Some(wid) = wiki_page_id {
            let res = crate::db::fetch_optional(&pool, &parent_project_stmt("wiki_pages", wid)).await.unwrap_or(None);
            if let Some(r) = res {
                let pid: Option<i64> = r.get(0);
                if let Some(p) = pid {
                    let _ = crate::routes::utils::check_project_access(&pool, &user, &p.to_string()).await?;
                }
            }
        } else if let Some(pid) = post_id {
            let res = crate::db::fetch_optional(&pool, &parent_project_stmt("posts", pid)).await.unwrap_or(None);
            if let Some(r) = res {
                let p_id: Option<i64> = r.get(0);
                if let Some(p) = p_id {
                    let _ = crate::routes::utils::check_project_access(&pool, &user, &p.to_string()).await?;
                }
            }
        } else if let Some(mid) = memo_id {
            let memo_stmt = SeaQuery::select()
                .columns(["sender_id", "receiver_id"])
                .from("memos")
                .and_where(Expr::col("id").eq(mid))
                .to_owned();
            let res = crate::db::fetch_optional(&pool, &memo_stmt).await.unwrap_or(None);
            if let Some(r) = res {
                let sid: i64 = r.get(0);
                let rid: i64 = r.get(1);
                if user.id != sid && user.id != rid {
                    return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."}))));
                }
            }
        }
    }

    let path = StdPath::new(&app_config.upload_dir).join(disk_filename);

    let file = File::open(path).await.map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "File not found"}))))?;
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, content_type),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename)),
    ];

    Ok((headers, body))
}

pub async fn delete_attachment(
    Path(id_str): Path<String>,
    user: crate::auth::AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["author_id", "disk_filename"])
        .from("attachments")
        .and_where(Expr::col("id").eq(id))
        .to_owned();

    let row = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Attachment not found"}))))?;

    let author_id: i64 = row.get(0);
    let disk_filename: String = row.get(1);

    if author_id != user.id && user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."}))));
    }

    let path = StdPath::new(&app_config.upload_dir).join(disk_filename);
    let _ = tokio::fs::remove_file(path).await;

    let delete_stmt = SeaQuery::delete()
        .from_table("attachments")
        .and_where(Expr::col("id").eq(id))
        .to_owned();

    crate::db::execute(&pool, &delete_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

use serde::Deserialize;
use std::io::{Write, Cursor};
use zip::write::FileOptions;
use zip::ZipWriter;

#[derive(Deserialize)]
pub struct BatchDownloadQuery {
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub post_id: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub wiki_page_id: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub issue_id: Option<i64>,
    pub memo_id: Option<String>,
    pub attachment_ids: Option<String>,
}

pub async fn batch_download(
    axum::extract::Query(query): axum::extract::Query<BatchDownloadQuery>,
    _user: crate::auth::AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    // 조건이 동적이므로 SeaQuery 로 조립합니다.
    // sqlx QueryBuilder 는 방언과 무관하게 `?` 플레이스홀더를 생성해 PostgreSQL 에서 문법 오류가 납니다.
    let mut stmt = SeaQuery::select();
    stmt.columns(["filename", "disk_filename"]).from("attachments");

    let has_cond = if let Some(ref ids_str) = query.attachment_ids {
        let ids: Vec<i64> = ids_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if ids.is_empty() {
            false
        } else {
            stmt.and_where(Expr::col("id").is_in(ids));
            true
        }
    } else if let Some(pid) = query.post_id {
        stmt.and_where(Expr::col("post_id").eq(pid));
        true
    } else if let Some(wid) = query.wiki_page_id {
        stmt.and_where(Expr::col("wiki_page_id").eq(wid));
        true
    } else if let Some(iid) = query.issue_id {
        stmt.and_where(Expr::col("issue_id").eq(iid));
        true
    } else if let Some(ref mid) = query.memo_id {
        stmt.and_where(Expr::col("memo_id").eq(mid.clone()));
        true
    } else {
        false
    };

    if !has_cond {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Missing target ID"}))));
    }

    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if rows.is_empty() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "No attachments found"}))));
    }

    let mut buffer = Vec::new();
    {
        let mut zip = ZipWriter::new(Cursor::new(&mut buffer));
        let options = FileOptions::<'_, ()>::default().compression_method(zip::CompressionMethod::Stored);

        for row in rows {
            let filename: String = row.get(0);
            let disk_filename: String = row.get(1);
            let path = StdPath::new(&app_config.upload_dir).join(disk_filename);

            if let Ok(content) = std::fs::read(path) {
                if zip.start_file(filename, options).is_ok() {
                    let _ = zip.write_all(&content);
                }
            }
        }
        let _ = zip.finish();
    }

    let headers = [
        (header::CONTENT_TYPE, "application/zip".to_string()),
        (header::CONTENT_DISPOSITION, "attachment; filename=\"attachments.zip\"".to_string()),
    ];

    Ok((headers, Body::from(buffer)))
}
