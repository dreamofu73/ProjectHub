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
use sea_query::{Condition, Expr, ExprTrait, Func, JoinType, Order, Query as SeaQuery};
use crate::auth::AuthUser;
use crate::routes::utils::{check_project_access, require_project_member, display_name};
use std::collections::HashMap;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/posts", get(get_posts))
            .route("/posts/:id", get(get_post_by_id))
            .route("/posts/:id/adjacent", get(get_adjacent_posts))
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

    // ── 공통 필터 조건 (목록/총건수 쿼리에 동일 적용) ───────────────────────
    let mut cond = Condition::all();

    if !is_admin {
        cond = cond.add(
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
        cond = cond.add(Expr::col(("p", "project_id")).is_null());
    }

    if let Some(p) = project {
        // 프로젝트 파라미터(숫자 id 또는 identifier)를 실제 project_id 로 해석하여 필터링합니다.
        // issues.rs 의 get_issues 규약과 동일하게 identifier 와 numeric id 를 모두 매칭합니다.
        let mut proj_cond = Expr::col("identifier").eq(p.clone());
        if let Ok(pid) = p.parse::<i64>() {
            proj_cond = proj_cond.or(Expr::col("id").eq(pid));
        }
        cond = cond.add(
            Expr::col(("p", "project_id")).in_subquery(
                SeaQuery::select()
                    .column("id")
                    .from("projects")
                    .and_where(proj_cond)
                    .to_owned(),
            ),
        );
    }

    if let Some(cat) = category {
        cond = cond.add(Expr::col(("p", "category")).eq(cat));
    }

    // 서버사이드 검색: search + search_in(title|title_content|author)
    let search = params
        .get("search")
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s.to_lowercase()));
    if let Some(pattern) = search {
        let search_in = params.get("search_in").map(|s| s.as_str()).unwrap_or("title");
        let title_like = Expr::expr(Func::lower(Expr::col(("p", "title")))).like(pattern.clone());
        cond = cond.add(match search_in {
            "title_content" => title_like.or(
                Expr::expr(Func::lower(Expr::col(("p", "content")))).like(pattern.clone())
            ),
            "author" => Expr::expr(Func::lower(Expr::col(("u", "login")))).like(pattern.clone())
                .or(Expr::expr(Func::lower(Expr::col(("u", "firstname")))).like(pattern.clone()))
                .or(Expr::expr(Func::lower(Expr::col(("u", "lastname")))).like(pattern.clone())),
            _ => title_like,
        });
    }

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
        ("p", "is_pinned"),
        ("p", "view_count"),
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
        .cond_where(cond.clone());

    // 정렬: 고정 공지가 항상 최상단, 이후 요청된 정렬 키 적용
    let sort_dir = match params.get("sort_dir").map(|s| s.to_lowercase()) {
        Some(ref d) if d == "asc" => Order::Asc,
        _ => Order::Desc,
    };
    query.order_by(("p", "is_pinned"), Order::Desc);
    match params.get("sort_by").map(|s| s.as_str()).unwrap_or("created_at") {
        "id" => query.order_by(("p", "id"), sort_dir),
        "title" => query.order_by(("p", "title"), sort_dir),
        "category" => query.order_by(("p", "category"), sort_dir),
        "view_count" => query.order_by(("p", "view_count"), sort_dir),
        "author_name" => query.order_by(("u", "login"), sort_dir),
        "comment_count" => query.order_by_expr(Expr::cust("comment_count"), sort_dir),
        _ => query.order_by(("p", "created_at"), sort_dir),
    };

    // 서버사이드 페이징: page_size 가 있을 때만 적용(미지정 시 기존처럼 전량 반환)
    let page_size = params.get("page_size").and_then(|v| v.parse::<u64>().ok()).filter(|v| *v > 0);
    let page = params.get("page").and_then(|v| v.parse::<u64>().ok()).filter(|v| *v > 0).unwrap_or(1);
    if let Some(size) = page_size {
        query.limit(size).offset((page - 1) * size);
    }

    let stmt = query.to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // 페이징 시에만 별도 총건수 조회(동일 필터 조건 재사용)
    let mut total = rows.len() as i64;
    if page_size.is_some() {
        let count_stmt = SeaQuery::select()
            .expr_as(Expr::cust("COUNT(*)"), "total")
            .from_as("posts", "p")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("p", "author_id")))
            .cond_where(cond)
            .to_owned();
        if let Some(row) = crate::db::fetch_optional(&pool, &count_stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        {
            total = row.get::<i64, _>("total");
        }
    }

    let post_ids: Vec<i64> = rows.iter().map(|r| r.get::<i64, _>("id")).collect();
    let attachment_stats = fetch_attachment_stats(&pool, &post_ids).await?;

    let posts: Vec<Value> = rows.into_iter().map(|r| {
        let firstname: String = r.get("author_firstname");
        let lastname: String = r.get("author_lastname");
        let login: String = r.get("author_login");
        let id: i64 = r.get("id");
        let (attachment_count, attachment_total_size) = attachment_stats.get(&id).copied().unwrap_or((0, 0));
        json!({
            "id": id.to_string(),
            "project_id": r.get::<Option<i64>, _>("project_id").map(|v| v.to_string()),
            "author_id": r.get::<i64, _>("author_id").to_string(),
            "author_login": login,
            "author_name": display_name(Some(&firstname), Some(&lastname), &login),
            "title": r.get::<String, _>("title"),
            "content": r.get::<Option<String>, _>("content").unwrap_or_default(),
            "category": r.get::<String, _>("category"),
            "popup_start_date": r.get::<Option<String>, _>("popup_start_date"),
            "popup_end_date": r.get::<Option<String>, _>("popup_end_date"),
            "is_pinned": r.get::<i64, _>("is_pinned") != 0,
            "view_count": r.get::<i64, _>("view_count"),
            "comment_count": r.get::<i64, _>("comment_count"),
            "attachment_count": attachment_count,
            "attachment_total_size": attachment_total_size,
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": r.get::<String, _>("updated_at")
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": posts,
        "meta": {
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    })))
}

/// 게시글별 첨부 개수·총용량을 집계합니다.
///
/// `SUM()` 은 백엔드(SQLite/MySQL/PostgreSQL)마다 반환 타입이 달라 `AnyPool` 디코딩이
/// 실패할 수 있으므로, 행을 그대로 읽어 Rust 에서 합산합니다.
async fn fetch_attachment_stats(
    pool: &AnyPool,
    post_ids: &[i64],
) -> Result<HashMap<i64, (i64, i64)>, (StatusCode, Json<Value>)> {
    let mut stats: HashMap<i64, (i64, i64)> = HashMap::new();
    if post_ids.is_empty() {
        return Ok(stats);
    }

    let stmt = SeaQuery::select()
        .columns(["post_id", "filesize"])
        .from("attachments")
        .and_where(Expr::col("post_id").is_in(post_ids.to_vec()))
        .to_owned();
    let rows = crate::db::fetch_all(pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    for r in rows {
        let Some(post_id) = r.get::<Option<i64>, _>("post_id") else { continue };
        let filesize: i64 = r.get("filesize");
        let entry = stats.entry(post_id).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += filesize;
    }
    Ok(stats)
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
    Query(params): Query<HashMap<String, String>>,
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

    // 조회수 증가는 상세 화면이 명시적으로 요청할 때만 수행합니다(작성/수정 폼 로드는 제외).
    if params.get("count_view").map(|v| v == "true" || v == "1").unwrap_or(false) {
        let stmt = SeaQuery::update()
            .table("posts")
            .value("view_count", Expr::col("view_count").add(1))
            .and_where(Expr::col("id").eq(id))
            .to_owned();
        let _ = crate::db::execute(&pool, &stmt).await;
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
            ("p", "is_pinned"),
            ("p", "view_count"),
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
                "popup_start_date": p.get::<Option<String>, _>("popup_start_date"),
                "popup_end_date": p.get::<Option<String>, _>("popup_end_date"),
                "is_pinned": p.get::<i64, _>("is_pinned") != 0,
                "view_count": p.get::<i64, _>("view_count"),
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
    get,
    path = "/posts/{id}/adjacent",
    params(
        ("id" = i64, Path, description = "Post ID")
    ),
    responses(
        (status = 200, description = "Get previous/next post in the same board scope"),
        (status = 404, description = "Post not found")
    ),
    security(("bearerAuth" = []))
)]
async fn get_adjacent_posts(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;

    let stmt = SeaQuery::select()
        .columns(["project_id", "category", "created_at"])
        .from("posts")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let current = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Post not found"}))))?;

    let project_id: Option<i64> = current.get("project_id");
    if let Some(pid) = project_id {
        check_project_access(&pool, &user, &pid.to_string()).await?;
    }
    let category: String = current.get("category");
    let created_at: String = current.get("created_at");

    // 같은 게시판 범위(프로젝트/전역 + 카테고리) 안에서 인접 글을 찾습니다.
    // 목록 기본 정렬이 최신순이므로 prev = 더 오래된 글, next = 더 최신 글입니다.
    let neighbor = |older: bool| {
        let mut q = SeaQuery::select();
        q.columns(["id", "title"])
            .from("posts")
            .and_where(Expr::col("category").eq(category.clone()));
        match project_id {
            Some(pid) => { q.and_where(Expr::col("project_id").eq(pid)); }
            None => { q.and_where(Expr::col("project_id").is_null()); }
        }
        // created_at 이 동일한 경우 id 로 안정적인 순서를 보장합니다.
        if older {
            q.and_where(
                Expr::col("created_at").lt(created_at.clone())
                    .or(Expr::col("created_at").eq(created_at.clone()).and(Expr::col("id").lt(id)))
            )
            .order_by("created_at", Order::Desc)
            .order_by("id", Order::Desc);
        } else {
            q.and_where(
                Expr::col("created_at").gt(created_at.clone())
                    .or(Expr::col("created_at").eq(created_at.clone()).and(Expr::col("id").gt(id)))
            )
            .order_by("created_at", Order::Asc)
            .order_by("id", Order::Asc);
        }
        q.limit(1).to_owned()
    };

    let mut result = HashMap::new();
    for (key, older) in [("prev", true), ("next", false)] {
        let stmt = neighbor(older);
        let row = crate::db::fetch_optional(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        let value = row.map(|r| json!({
            "id": r.get::<i64, _>("id").to_string(),
            "title": r.get::<String, _>("title"),
        }));
        result.insert(key, value.unwrap_or(Value::Null));
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "prev": result.get("prev").cloned().unwrap_or(Value::Null),
            "next": result.get("next").cloned().unwrap_or(Value::Null),
        }
    })))
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

    // 상단 고정은 관리자만 설정할 수 있습니다.
    let is_pinned: i64 = if user.role == "admin" && post_data.is_pinned.unwrap_or(false) { 1 } else { 0 };

    let post_id = crate::db::new_id();

    let stmt = SeaQuery::insert()
        .into_table("posts")
        .columns(["id", "project_id", "author_id", "title", "content", "category", "popup_start_date", "popup_end_date", "is_pinned", "created_at", "updated_at"])
        .values_panic([
            post_id.into(),
            project_id.into(),
            author_id.into(),
            title.into(),
            content.into(),
            category.into(),
            popup_start_date.into(),
            popup_end_date.into(),
            is_pinned.into(),
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
    // 상단 고정은 관리자만 변경할 수 있습니다.
    if let Some(pinned) = post_data.is_pinned {
        if user.role == "admin" {
            update.value("is_pinned", if pinned { 1_i64 } else { 0_i64 });
        }
    }

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
