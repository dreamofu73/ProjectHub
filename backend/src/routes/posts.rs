use crate::models::{CreatePostRequest, UpdatePostRequest};
use axum::{
    extract::{Extension, Path, Query},
    response::Json,
    http::StatusCode,
    routing::{get, post, put, delete},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Expr, ExprTrait, JoinType, Order, Query as SeaQuery};
use crate::auth::AuthUser;
use crate::routes::utils::{check_project_access, require_project_member, display_name};
use std::collections::HashMap;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/posts", get(get_posts))
            .route("/posts/:id", get(get_post_by_id))
            .route("/posts", post(create_post))
            .route("/posts/:id", put(update_post))
            .route("/posts/:id", delete(delete_post))
            .route("/posts/:id/attachments", get(get_post_attachments)),
    )
}

#[utoipa::path(
    get,
    path = "/posts",
    responses(
        (status = 200, description = "List posts", body = Vec<Post>)
    ),
    security(("bearerAuth" = []))
)]
async fn get_posts(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {

    let is_admin = user.role == "admin";
    let user_id = user.id;

    // 프로젝트 파라미터는 숫자 project_id 또는 프로젝트 식별자(identifier) 모두 허용합니다.
    // (라우트 `:id`가 슬러그일 수 있으므로 i64 파싱만으로는 프로젝트 필터가 누락됩니다.)
    let project = params
        .get("project_id")
        .filter(|v| !v.is_empty() && v.as_str() != "all");
    let is_global = params.get("is_global").and_then(|v| v.parse::<bool>().ok());
    let category = params.get("category").cloned();

    let mut query = SeaQuery::select();
    // 컬럼은 반드시 (테이블, 컬럼) 튜플로 지정합니다.
    // "p.id" 처럼 점이 포함된 문자열은 하나의 식별자로 인용되어("p.id")
    // 결과 컬럼명이 `id` 가 아니라 `p.id` 가 됩니다.
    query.columns([
        ("p", "id"),
        ("p", "project_id"),
        ("p", "author_id"),
        ("p", "title"),
        ("p", "content"),
        ("p", "category"),
        ("p", "popup_start_date"),
        ("p", "popup_end_date"),
        ("p", "created_at"),
        ("p", "updated_at"),
    ])
        .expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "author_firstname")
        .expr_as(Expr::col(("u", "lastname")), "author_lastname")
        .expr_as(
            Expr::cust("(SELECT COUNT(*) FROM post_comments WHERE post_id = p.id)"),
            "comment_count"
        )
        .from_as("posts", "p")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("p", "author_id")));

    if !is_admin {
        query.and_where(
            Expr::col(("p", "project_id")).is_null()
            .or(Expr::col(("p", "project_id")).in_subquery(
                SeaQuery::select()
                    .column("project_id")
                    .from("project_members")
                    .and_where(Expr::col("user_id").eq(user_id))
                    .to_owned()
            ))
        );
    }

    if is_global == Some(true) {
        query.and_where(Expr::col(("p", "project_id")).is_null());
    }

    if let Some(p) = project {
        // 프로젝트 파라미터(숫자 id 또는 identifier)를 실제 project_id 로 해석하여 필터링합니다.
        // issues.rs 의 get_issues 규약과 동일하게 identifier 와 numeric id 를 모두 매칭합니다.
        let mut cond = Expr::col("identifier").eq(p.clone());
        if let Ok(pid) = p.parse::<i64>() {
            cond = cond.or(Expr::col("id").eq(pid));
        }
        query.and_where(
            Expr::col(("p", "project_id")).in_subquery(
                SeaQuery::select()
                    .column("id")
                    .from("projects")
                    .and_where(cond)
                    .to_owned(),
            ),
        );
    }

    if let Some(cat) = category {
        query.and_where(Expr::col(("p", "category")).eq(cat));
    }

    query.order_by(("p", "created_at"), Order::Desc);
    
    let stmt = query.to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let posts: Vec<Value> = rows.into_iter().map(|r| {
        let firstname: String = r.get("author_firstname");
        let lastname: String = r.get("author_lastname");
        let login: String = r.get("author_login");
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "project_id": r.get::<Option<i64>, _>("project_id").map(|v| v.to_string()),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": login,
            "author_name": display_name(Some(&firstname), Some(&lastname), &login),
            "title": r.get::<String, _>("title"),
            "content": r.get::<Option<String>, _>("content").unwrap_or_default(),
            "category": r.get::<String, _>("category"),
            "comment_count": r.get::<i64, _>("comment_count"),
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": r.get::<String, _>("updated_at")
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": posts })))
}

#[utoipa::path(
    get,
    path = "/posts/{id}",
    params(
        ("id" = i64, Path, description = "Post ID")
    ),
    responses(
        (status = 200, description = "Get post by ID", body = Post),
        (status = 404, description = "Post not found")
    ),
    security(("bearerAuth" = []))
)]
async fn get_post_by_id(
    Path(id): Path<i64>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("posts")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let post_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Post not found"}))))?;

    let project_id: Option<i64> = post_info.get("project_id");
    if let Some(pid) = project_id {
        check_project_access(&pool, &user, &pid.to_string()).await?;
    }

    let stmt = SeaQuery::select()
        .columns([
            ("p", "id"),
            ("p", "project_id"),
            ("p", "author_id"),
            ("p", "title"),
            ("p", "content"),
            ("p", "category"),
            ("p", "popup_start_date"),
            ("p", "popup_end_date"),
            ("p", "created_at"),
            ("p", "updated_at"),
        ])
        .expr_as(Expr::col(("u", "login")), "author_login")
        .expr_as(Expr::col(("u", "firstname")), "author_firstname")
        .expr_as(Expr::col(("u", "lastname")), "author_lastname")
        .expr_as(
                Expr::cust("(SELECT COUNT(*) FROM post_comments WHERE post_id = p.id)"),
            "comment_count"
        )
        .from_as("posts", "p")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("p", "author_id")))
        .and_where(Expr::col(("p", "id")).eq(id))
        .to_owned();

    let post = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(p) = post {
        let firstname: String = p.get("author_firstname");
        let lastname: String = p.get("author_lastname");
        let login: String = p.get("author_login");
        Ok(Json(json!({
            "success": true,
            "data": {
                "id": p.get::<i64, _>("id").to_string(),
                "project_id": p.get::<Option<i64>, _>("project_id").map(|v| v.to_string()),
                "author_id": p.get::<i64, _>("author_id").to_string(),
                "author_login": login,
                "author_name": display_name(Some(&firstname), Some(&lastname), &login),
                "title": p.get::<String, _>("title"),
                "content": p.get::<Option<String>, _>("content").unwrap_or_default(),
                "category": p.get::<String, _>("category"),
                "comment_count": p.get::<i64, _>("comment_count"),
                "created_at": p.get::<String, _>("created_at"),
                "updated_at": p.get::<String, _>("updated_at")
            }
        })))

    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Post not found"}))))
    }
}
#[utoipa::path(
    post,
    path = "/posts",
    request_body = CreatePostRequest,
    responses(
        (status = 200, description = "Post created successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn create_post(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(post_data): axum::Json<CreatePostRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = post_data.project_id;

    if let Some(pid) = project_id {
        require_project_member(&pool, &user, pid).await?;
    }

    let title = post_data.title;
    let content = post_data.content.unwrap_or_default();
    let category = post_data.category;
    let popup_start_date = post_data.popup_start_date;
    let popup_end_date = post_data.popup_end_date;

    // 공지사항·자료실은 관리자만 작성 가능
    if (category == "notice" || category == "resource") && user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "success": false, "error": "Admin permission required for this category" }))
        ));
    }

    let author_id = user.id;

    let post_id = crate::db::new_id();

    let stmt = SeaQuery::insert()
        .into_table("posts")
        .columns(["id", "project_id", "author_id", "title", "content", "category", "popup_start_date", "popup_end_date", "created_at", "updated_at"])
        .values_panic([
            post_id.into(),
            project_id.into(),
            author_id.into(),
            title.into(),
            content.into(),
            category.into(),
            popup_start_date.into(),
            popup_end_date.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    if let Some(attachment_ids) = post_data.attachment_ids {
        for att_id in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("post_id", post_id)
                .and_where(Expr::col("id").eq(att_id))
                .and_where(Expr::col("author_id").eq(author_id))
                .to_owned();
            let _ = crate::db::execute(&pool, &stmt).await;
        }
    }
    Ok(Json(json!({ "success": true, "id": post_id.to_string() })))
}

#[utoipa::path(
    put,
    path = "/posts/{id}",
    params(
        ("id" = i64, Path, description = "Post ID")
    ),
    request_body = UpdatePostRequest,
    responses(
        (status = 200, description = "Post updated successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn update_post(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(post_data): axum::Json<UpdatePostRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["category", "author_id"])
        .from("posts")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let existing = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = &existing {
        let existing_category: String = row.get("category");
        let author_id: i64 = row.get("author_id");

        if user.role != "admin" && user.id != author_id {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "success": false, "error": "You do not have permission to edit this post" }))
            ));
        }

        if (existing_category == "notice" || existing_category == "resource") && user.role != "admin" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "success": false, "error": "Admin permission required for this category" }))
            ));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": "Post not found" }))));
    }

    let title = post_data.title;
    let content = post_data.content;
    let category = post_data.category;

    // 변경하려는 카테고리도 admin 전용인 경우 체크
    if let Some(new_cat) = &category {
        if (new_cat == "notice" || new_cat == "resource") && user.role != "admin" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "success": false, "error": "Admin permission required for this category" }))
            ));
        }
    }

    let popup_start_date = post_data.popup_start_date;
    let popup_end_date = post_data.popup_end_date;
    let project_id = post_data.project_id;

    if let Some(pid) = project_id {
        if pid != -1 {
            require_project_member(&pool, &user, pid).await?;
        }
    }

    let actual_project_id: Option<Option<i64>> = match project_id {
        Some(-1) => Some(None),
        Some(pid) => Some(Some(pid)),
        None => None,
    };

    let mut update = SeaQuery::update();
    update.table("posts");
    if let Some(t) = title { update.value("title", t); }
    if let Some(c) = content { update.value("content", c); }
    if let Some(cat) = category { update.value("category", cat); }
    if let Some(ps) = popup_start_date { update.value("popup_start_date", ps); }
    if let Some(pe) = popup_end_date { update.value("popup_end_date", pe); }
    
    if let Some(pid) = actual_project_id {
        update.value("project_id", pid);
    }
    
    update.value("updated_at", crate::db::now_string());
    update.and_where(Expr::col("id").eq(id));
    
    let stmt = update.to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(attachment_ids) = post_data.attachment_ids {
        for att_id in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("post_id", id)
                .and_where(Expr::col("id").eq(att_id))
                .and_where(Expr::col("author_id").eq(user.id))
                .to_owned();
            let _ = crate::db::execute(&pool, &stmt).await;
        }
    }

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    delete,
    path = "/posts/{id}",
    params(
        ("id" = i64, Path, description = "Post ID")
    ),
    responses(
        (status = 200, description = "Post deleted successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn delete_post(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(app_config): Extension<Arc<crate::models::AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // 삭제 대상 게시글의 카테고리 및 작성자를 조회하여 권한 체크
    let stmt = SeaQuery::select()
        .columns(["category", "author_id"])
        .from("posts")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let existing = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(row) = &existing {
        let existing_category: String = row.get("category");
        let author_id: i64 = row.get("author_id");

        if user.role != "admin" && user.id != author_id {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "success": false, "error": "You do not have permission to delete this post" }))
            ));
        }

        if (existing_category == "notice" || existing_category == "resource") && user.role != "admin" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "success": false, "error": "Admin permission required for this category" }))
            ));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": "Post not found" }))));
    }

    let stmt = SeaQuery::select()
        .column("disk_filename")
        .from("attachments")
        .and_where(Expr::col("post_id").eq(id))
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    for r in rows {
        let disk_filename: String = r.get("disk_filename");
        let path = std::path::Path::new(&app_config.upload_dir).join(disk_filename);
        let _ = std::fs::remove_file(path);
    }

    let stmt = SeaQuery::delete()
        .from_table("attachments")
        .and_where(Expr::col("post_id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::delete()
        .from_table("posts")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    get,
    path = "/posts/{id}/attachments",
    params(
        ("id" = i64, Path, description = "Post ID")
    ),
    responses(
        (status = 200, description = "Get post attachments")
    ),
    security(("bearerAuth" = []))
)]
async fn get_post_attachments(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("posts")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let post_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Post not found"}))))?;

    let project_id: Option<i64> = post_info.get("project_id");
    if let Some(pid) = project_id {
        check_project_access(&pool, &user, &pid.to_string()).await?;
    }

    let stmt = SeaQuery::select()
        .columns([
            ("a", "id"),
            ("a", "filename"),
            ("a", "content_type"),
            ("a", "filesize"),
            ("a", "description"),
            ("a", "created_at"),
        ])
        .expr_as(Expr::col(("u", "login")), "author_login")
        .from_as("attachments", "a")
        .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("a", "author_id")))
        .and_where(Expr::col(("a", "post_id")).eq(id))
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
