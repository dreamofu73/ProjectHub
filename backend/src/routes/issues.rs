use crate::models::{CreateIssueRequest, UpdateIssueRequest, CreateCommentRequest};
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
use crate::auth::AuthUser;
use std::collections::HashMap;
use crate::routes::utils::{check_project_access, require_project_member, is_project_archived, display_name};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/issues", get(get_issues))
            .route("/issues/bulk", put(bulk_update_issues))
            .route("/issues/:id", get(get_issue_by_id))
            .route("/issues", post(create_issue))
            .route("/issues/:id", put(update_issue))
            .route("/issues/:id", delete(delete_issue))
            .route("/comments", post(create_comment)),
    )
}

#[utoipa::path(
    get,
    path = "/issues",
    responses(
        (status = 200, description = "List issues", body = Vec<Issue>)
    ),
    security(("bearerAuth" = []))
)]
async fn get_issues(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_admin = user.role == "admin";

    let mut stmt = SeaQuery::select();
    stmt.columns([
        ("i", Asterisk),
    ])
    .expr_as(Expr::col(("p", "name")), "project_name")
    .expr_as(Expr::col(("p", "identifier")), "project_identifier")
    .expr_as(Expr::col(("u", "login")), "assigned_login")
    .expr_as(Expr::col(("u", "firstname")), "assigned_firstname")
    .expr_as(Expr::col(("u", "lastname")), "assigned_lastname")
    .from_as("issues", "i")
    .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("i", "project_id")).equals(("p", "id")))
    .join_as(JoinType::LeftJoin, "users", "u", Expr::col(("i", "assigned_to_id")).equals(("u", "id")));

    if !is_admin {
        stmt.join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("i", "project_id")).and(Expr::col(("pm", "user_id")).eq(user.id)));
    }

    stmt.order_by(("i", "updated_at"), Order::Desc);

    let issues = crate::db::fetch_all(&pool, &stmt.to_owned()).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut filtered_data: Vec<Value> = issues.into_iter().map(|i| {
        let firstname: Option<String> = i.get("assigned_firstname");
        let lastname: Option<String> = i.get("assigned_lastname");
        let login: Option<String> = i.get("assigned_login");
        
        let assigned_name = if let Some(l) = login.as_ref() {
            Some(display_name(firstname.as_deref(), lastname.as_deref(), l))
        } else {
            None
        };

        json!({
            "id": i.get::<i64, _>("id").to_string(),
            "project_id": i.get::<i64, _>("project_id").to_string(),
            "tracker": i.get::<String, _>("tracker"),
            "subject": i.get::<String, _>("subject"),
            "description": i.get::<Option<String>, _>("description"),
            "status": i.get::<String, _>("status"),
            "priority": i.get::<String, _>("priority"),
            "assigned_to_id": i.get::<Option<i64>, _>("assigned_to_id").map(|v| v.to_string()),
            "assigned_login": login,
            "assigned_name": assigned_name,
            "project_name": i.get::<String, _>("project_name"),
            "project_identifier": i.get::<String, _>("project_identifier"),
            "due_date": i.get::<Option<String>, _>("due_date"),
            "updated_at": i.get::<String, _>("updated_at")
        })
    }).collect();

    // Accept both `project_id` (client/api convention) and `project` (legacy web param) as fallback.
    let project = params.get("project_id").or_else(|| params.get("project"));
    let status = params.get("status");
    let tracker = params.get("tracker");
    let search = params.get("search");
    let assigned_to = params.get("assigned_to");

    if let Some(p_id) = project {
        if !p_id.is_empty() && p_id != "all" {
            filtered_data.retain(|item| {
                item["project_identifier"].as_str() == Some(p_id.as_str()) ||
                item["project_id"].as_str() == Some(p_id.as_str())
            });
        }
    }
    if let Some(track) = tracker {
        if !track.is_empty() && track != "all" {
            filtered_data.retain(|item| item["tracker"].as_str() == Some(track));
        }
    }
    if let Some(assigned) = assigned_to {
        if !assigned.is_empty() && assigned != "all" {
            if assigned == "me" {
                let my_id = user.id;
                filtered_data.retain(|item| {
                    item["assigned_to_id"].as_i64() == Some(my_id)
                });
            } else {
                filtered_data.retain(|item| {
                    item["assigned_login"].as_str() == Some(assigned) ||
                    item["assigned_name"].as_str() == Some(assigned)
                });
            }
        }
    }
    if let Some(q) = search {
        if !q.is_empty() {
            let q_lower = q.to_lowercase();
            filtered_data.retain(|item| {
                item["subject"].as_str().map(|s| s.to_lowercase().contains(&q_lower)).unwrap_or(false) ||
                item["description"].as_str().map(|s| s.to_lowercase().contains(&q_lower)).unwrap_or(false)
            });
        }
    }

    let mut status_counts = std::collections::HashMap::new();
    for item in &filtered_data {
        let s = item["status"].as_str().unwrap_or("unknown").to_string();
        *status_counts.entry(s).or_insert(0i64) += 1;
    }
    let pretotal = filtered_data.len() as i64;

    if let Some(stat) = status {
        if !stat.is_empty() && stat != "all" {
            let stats: Vec<&str> = stat.split(',').collect();
            filtered_data.retain(|item| {
                if let Some(s) = item["status"].as_str() {
                    stats.contains(&s)
                } else {
                    false
                }
            });
        }
    }

    let total = filtered_data.len();
    Ok(Json(json!({ "success": true, "data": filtered_data, "total": total, "pretotal": pretotal, "status_counts": status_counts })))
}

#[utoipa::path(
    put,
    path = "/issues/bulk",
    request_body = Value,
    responses(
        (status = 200, description = "Bulk update issues successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn bulk_update_issues(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(bulk_data): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let ids = bulk_data.get("ids").and_then(|v| v.as_array()).ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "ids is required"}))))?;
    let status = bulk_data.get("status").and_then(|v| v.as_str());
    let assigned_to_id = bulk_data.get("assigned_to_id");
    let due_date = bulk_data.get("due_date").and_then(|v| v.as_str());

    if ids.is_empty() {
        return Ok(Json(json!({ "success": true })));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    for id_val in ids {
        let id = id_val.as_i64().ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "invalid id"}))))?;
        
        let stmt = SeaQuery::select()
            .column("project_id")
            .from("issues")
            .and_where(Expr::col("id").eq(id))
            .to_owned();
        
        let kind = crate::db::get_kind(&pool);
        let query = crate::db::to_query_scalar::<i64, _>(&stmt, kind).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        let issue_project: Option<i64> = query.fetch_optional(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        
        if let Some(pid) = issue_project {
            require_project_member(&pool, &user, pid).await?;
            if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
                return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
            }
        } else {
            continue;
        }

        let assigned_id_val = if let Some(v) = assigned_to_id {
            if v.is_null() { Some(None) } else { v.as_i64().map(Some) }
        } else {
            None
        };

        let mut update_stmt = SeaQuery::update();
        update_stmt.table("issues");
        
        if let Some(s) = status {
            update_stmt.value("status", s);
        }
        
        if let Some(assigned_id) = assigned_id_val {
            update_stmt.value("assigned_to_id", Expr::val(assigned_id));
        }
        
        if let Some(d) = due_date {
            update_stmt.value("due_date", d);
        }
        
        update_stmt.value("updated_at", crate::db::now_string());
        update_stmt.and_where(Expr::col("id").eq(id));
        
        let query = crate::db::to_query(&update_stmt, kind).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        query.execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    get,
    path = "/issues/{id}",
    params(
        ("id" = i64, Path, description = "Issue ID")
    ),
    responses(
        (status = 200, description = "Get issue by ID", body = Issue),
        (status = 404, description = "Issue not found")
    ),
    security(("bearerAuth" = []))
)]
async fn get_issue_by_id(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    let project_id: i64 = crate::db::fetch_scalar_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;
    
    check_project_access(&pool, &user, &project_id.to_string()).await?;

    let stmt = SeaQuery::select()
        .columns([("i", Asterisk)])
        .expr_as(Expr::col(("p", "name")), "project_name")
        .expr_as(Expr::col(("p", "identifier")), "project_identifier")
        .expr_as(Expr::col(("u", "login")), "assigned_login")
        .expr_as(Expr::col(("u", "firstname")), "assigned_firstname")
        .expr_as(Expr::col(("u", "lastname")), "assigned_lastname")
        .from_as("issues", "i")
        .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("i", "project_id")).equals(("p", "id")))
        .join_as(JoinType::LeftJoin, "users", "u", Expr::col(("i", "assigned_to_id")).equals(("u", "id")))
        .and_where(Expr::col(("i", "id")).eq(id))
        .to_owned();

    let issue = crate::db::fetch_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(i) = issue {
        let firstname: Option<String> = i.get("assigned_firstname");
        let lastname: Option<String> = i.get("assigned_lastname");
        let login: Option<String> = i.get("assigned_login");
        let assigned_name = if let Some(l) = login {
            Some(display_name(firstname.as_deref(), lastname.as_deref(), &l))
        } else {
            None
        };
        let stmt = SeaQuery::select()
            .columns(["id", "filename", "content_type", "filesize", "created_at"])
            .from("attachments")
            .and_where(Expr::col("issue_id").eq(id))
            .and_where(Expr::col("comment_id").is_null())
            .to_owned();

        let issue_attachments = crate::db::fetch_all(&*pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let issue_attachments_json: Vec<Value> = issue_attachments.into_iter().map(|a| {
            json!({
                "id": a.get::<i64, _>("id").to_string(),
                "filename": a.get::<String, _>("filename"),
                "content_type": a.get::<Option<String>, _>("content_type"),
                "filesize": a.get::<i64, _>("filesize"),
                "created_at": a.get::<String, _>("created_at")
            })
        }).collect();

        let stmt = SeaQuery::select()
            .columns([("c", "id"), ("c", "issue_id"), ("c", "author_id"), ("c", "content"), ("c", "created_at")])
            .expr_as(Expr::col(("u", "login")), "author_login")
            .expr_as(Expr::col(("u", "firstname")), "author_firstname")
            .expr_as(Expr::col(("u", "lastname")), "author_lastname")
            .from_as("comments", "c")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("c", "author_id")).equals(("u", "id")))
            .and_where(Expr::col(("c", "issue_id")).eq(id))
            .order_by(("c", "created_at"), Order::Asc)
            .to_owned();

        let comments = crate::db::fetch_all(&*pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let mut comments_json = Vec::new();
        for c in comments {
            let cid = c.get::<i64, _>("id");
            let firstname: Option<String> = c.get("author_firstname");
            let lastname: Option<String> = c.get("author_lastname");
            let login: String = c.get("author_login");
            let author_name = display_name(firstname.as_deref(), lastname.as_deref(), &login);

            let stmt = SeaQuery::select()
                .columns(["id", "filename", "content_type", "filesize", "created_at"])
                .from("attachments")
                .and_where(Expr::col("comment_id").eq(cid))
                .to_owned();

            let comment_attachments = crate::db::fetch_all(&*pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

            let attachments_json: Vec<Value> = comment_attachments.into_iter().map(|a| {
                json!({
                    "id": a.get::<i64, _>("id").to_string(),
                    "filename": a.get::<String, _>("filename"),
                    "content_type": a.get::<Option<String>, _>("content_type"),
                    "filesize": a.get::<i64, _>("filesize"),
                    "created_at": a.get::<String, _>("created_at")
                })
            }).collect();

            comments_json.push(json!({
                "id": cid.to_string(),
                "issue_id": c.get::<i64, _>("issue_id").to_string(),
                "author_id": c.get::<i64, _>("author_id").to_string(),
                "content": c.get::<String, _>("content"),
                "author_login": login,
                "author_name": author_name,
                "created_at": c.get::<String, _>("created_at"),
                "attachments": attachments_json
            }));
        }

        Ok(Json(json!({
            "success": true,
            "data": {
                "issue": {
                    "id": i.get::<i64, _>("id").to_string(),
                    "project_id": i.get::<i64, _>("project_id").to_string(),
                    "tracker": i.get::<String, _>("tracker"),
                    "subject": i.get::<String, _>("subject"),
                    "description": i.get::<Option<String>, _>("description"),
                    "status": i.get::<String, _>("status"),
                    "priority": i.get::<String, _>("priority"),
                    "assigned_to_id": i.get::<Option<i64>, _>("assigned_to_id").map(|v| v.to_string()),
                    "assigned_name": assigned_name,
                    "project_name": i.get::<String, _>("project_name"),
                    "project_identifier": i.get::<String, _>("project_identifier"),
                    "done_ratio": i.get::<i64, _>("done_ratio"),
                    "created_at": i.get::<String, _>("created_at"),
                    "updated_at": i.get::<String, _>("updated_at"),
                    "attachments": issue_attachments_json
                },
                "comments": comments_json
            }
        })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))
    }
}

#[utoipa::path(
    post,
    path = "/issues",
    request_body = CreateIssueRequest,
    responses(
        (status = 200, description = "Issue created successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn create_issue(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<CreateIssueRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_project_member(&pool, &user, req.project_id).await?;

    if is_project_archived(&pool, req.project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let issue_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("issues")
        .columns([
            "id", "project_id", "tracker", "subject", "description", "status", "priority",
            "author_id", "created_at", "updated_at", "task_type", "planned_start_date",
            "actual_start_date", "actual_end_date"
        ])
        .values_panic([
            issue_id.into(),
            req.project_id.into(),
            req.tracker.unwrap_or_else(|| "bug".to_string()).into(),
            req.subject.into(),
            req.description.unwrap_or_default().into(),
            req.status.unwrap_or_else(|| "new".to_string()).into(),
            req.priority.unwrap_or_else(|| "normal".to_string()).into(),
            user.id.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
            req.task_type.into(),
            req.planned_start_date.into(),
            req.actual_start_date.into(),
            req.actual_end_date.into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(attachment_ids) = req.attachment_ids {
        for aid in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("issue_id", issue_id)
                .and_where(Expr::col("id").eq(aid))
                .to_owned();
            
            crate::db::execute(&*pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }
    }

    Ok(Json(json!({ "success": true, "id": issue_id.to_string() })))
}

#[utoipa::path(
    put,
    path = "/issues/{id}",
    params(
        ("id" = i64, Path, description = "Issue ID")
    ),
    request_body = UpdateIssueRequest,
    responses(
        (status = 200, description = "Issue updated successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn update_issue(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<UpdateIssueRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["project_id", "author_id"])
        .from("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    let issue_info = crate::db::fetch_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;

    let project_id: i64 = issue_info.get("project_id");
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let assigned_id = match req.assigned_to_id {
        Some(None) => Some(None),
        Some(Some(id)) => Some(Some(id)),
        None => None
    };

    let mut update_stmt = SeaQuery::update();
    update_stmt.table("issues");
    
    if let Some(subject) = req.subject { update_stmt.value("subject", subject); }
    if let Some(description) = req.description { update_stmt.value("description", description); }
    if let Some(tracker) = req.tracker { update_stmt.value("tracker", tracker); }
    if let Some(status) = req.status { update_stmt.value("status", status); }
    if let Some(priority) = req.priority { update_stmt.value("priority", priority); }
    
    if let Some(assigned_id) = assigned_id {
        update_stmt.value("assigned_to_id", Expr::val(assigned_id));
    }
    
    if let Some(done_ratio) = req.done_ratio { update_stmt.value("done_ratio", done_ratio); }
    if let Some(due_date) = req.due_date { update_stmt.value("due_date", due_date); }
    if let Some(task_type) = req.task_type { update_stmt.value("task_type", task_type); }
    if let Some(planned_start_date) = req.planned_start_date { update_stmt.value("planned_start_date", planned_start_date); }
    if let Some(actual_start_date) = req.actual_start_date { update_stmt.value("actual_start_date", actual_start_date); }
    if let Some(actual_end_date) = req.actual_end_date { update_stmt.value("actual_end_date", actual_end_date); }
    
    update_stmt.value("updated_at", crate::db::now_string());
    update_stmt.and_where(Expr::col("id").eq(id));
    
    crate::db::execute(&*pool, &update_stmt.to_owned())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    delete,
    path = "/issues/{id}",
    params(
        ("id" = i64, Path, description = "Issue ID")
    ),
    responses(
        (status = 200, description = "Issue deleted successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn delete_issue(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["project_id", "author_id"])
        .from("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    let issue_info = crate::db::fetch_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;

    let project_id: i64 = issue_info.get("project_id");
    let author_id: i64 = issue_info.get("author_id");

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    if user.id != author_id && user.role != "admin" {
        // If not author or admin, check if project manager
        let stmt = SeaQuery::select()
            .column("role")
            .from("project_members")
            .and_where(Expr::col("project_id").eq(project_id))
            .and_where(Expr::col("user_id").eq(user.id))
            .to_owned();
        
        let role: Option<String> = crate::db::fetch_scalar_optional(&*pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        match role {
            Some(r) if r == "manager" => (),
            _ => return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."})))),
        }
    }

    let stmt = SeaQuery::delete()
        .from_table("issues")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    
    crate::db::execute(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    post,
    path = "/comments",
    request_body = CreateCommentRequest,
    responses(
        (status = 200, description = "Comment created successfully")
    ),
    security(("bearerAuth" = []))
)]
async fn create_comment(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(comment_data): axum::Json<CreateCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let issue_id = comment_data.issue_id;
    let content = comment_data.content;
    let author_id = user.id;

    let stmt = SeaQuery::select()
        .column("project_id")
        .from("issues")
        .and_where(Expr::col("id").eq(issue_id))
        .to_owned();
    
    let issue_info: Option<i64> = crate::db::fetch_scalar_optional(&*pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        
    if let Some(pid) = issue_info {
        if is_project_archived(&pool, pid).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }
    }

    let comment_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("comments")
        .columns(["id", "issue_id", "author_id", "content", "created_at", "updated_at"])
        .values_panic([
            comment_id.into(),
            issue_id.into(),
            author_id.into(),
            content.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(attachment_ids) = comment_data.attachment_ids {
        for aid in attachment_ids {
            let stmt = SeaQuery::update()
                .table("attachments")
                .value("comment_id", comment_id)
                .value("issue_id", issue_id)
                .and_where(Expr::col("id").eq(aid))
                .to_owned();
            
            crate::db::execute(&*pool, &stmt)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
        }
    }

    Ok(Json(json!({ "success": true, "id": comment_id.to_string() })))
}
