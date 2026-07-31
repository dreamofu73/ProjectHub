use crate::models::{BulkUpdateTasksRequest, CreateTaskRequest, UpdateTaskRequest};
use axum::{
    extract::{Extension, Path, Query, Multipart},
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
use csv::ReaderBuilder;
use calamine::{open_workbook_from_rs, DataType, Reader, Xlsx};
use std::io::Cursor;
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery, SelectStatement};

/// 상위 일감 체인을 따라 올라갈 때 허용하는 최대 깊이.
/// 기존 데이터가 손상되어 순환이 있더라도 무한 루프에 빠지지 않도록 하는 안전장치.
const MAX_TASK_DEPTH: usize = 20;

/// `parent_id`가 `task_id`(신규 생성 시 `None`)의 상위 일감이 될 수 있는지 검증한다.
/// 상위 일감은 존재해야 하고, 같은 프로젝트에 속해야 하며, 순환을 만들지 않아야 한다.
async fn validate_parent_task(
    pool: &Arc<AnyPool>,
    project_id: i64,
    task_id: Option<i64>,
    parent_id: i64,
) -> Result<(), (StatusCode, Json<Value>)> {
    let mut current = Some(parent_id);
    let mut depth = 0usize;

    while let Some(id) = current {
        if task_id == Some(id) {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "A task cannot be its own ancestor"}))));
        }
        depth += 1;
        if depth > MAX_TASK_DEPTH {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Task hierarchy is too deep"}))));
        }

        let stmt = SeaQuery::select()
            .columns(["project_id", "parent_task_id"])
            .from("tasks")
            .and_where(Expr::col("id").eq(id))
            .to_owned();
        let row = crate::db::fetch_optional(pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
            .ok_or((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Parent task not found"}))))?;

        let row_project: i64 = row.get("project_id");
        if row_project != project_id {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Parent task must belong to the same project"}))));
        }

        current = row.get::<Option<i64>, _>("parent_task_id");
    }

    Ok(())
}

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/tasks", get(get_tasks))
            .route("/tasks/bulk", post(bulk_create_tasks).put(bulk_update_tasks))
            .route("/tasks/:id", get(get_task_by_id))
            .route("/tasks", post(create_task))
            .route("/tasks/:id", put(update_task))
            .route("/tasks/:id", delete(delete_task)),
    )
}

async fn bulk_create_tasks(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    mut multipart: Multipart,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut project_id: Option<i64> = None;
    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": e.to_string()}))))? {
        let name = field.name().unwrap_or_default().to_string();
        if name == "project_id" {
            let text = field.text().await.map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": e.to_string()}))))?;
            project_id = text.parse::<i64>().ok();
        } else if name == "file" {
            file_name = field.file_name().map(|s| s.to_string());
            file_data = Some(field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": e.to_string()}))))?.to_vec());
        }
    }

    let project_id = project_id.ok_or((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Missing or invalid project_id"}))))?;
    let file_data = file_data.ok_or((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Missing file"}))))?;
    let file_name = file_name.ok_or((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Missing file name"}))))?;

    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let mut tasks: Vec<crate::models::TaskRow> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    if file_name.ends_with(".csv") {
        let mut rdr = ReaderBuilder::new().from_reader(file_data.as_slice());
        for result in rdr.deserialize::<crate::models::TaskRow>() {
            match result {
                Ok(task) => tasks.push(task),
                Err(e) => errors.push(format!("CSV parsing error: {}", e)),
            }
        }
    } else if file_name.ends_with(".xlsx") || file_name.ends_with(".xls") {
        let mut excel: Xlsx<_> = open_workbook_from_rs(Cursor::new(file_data)).map_err(|e: calamine::XlsxError| (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": e.to_string()}))))?;
        if let Some(Ok(range)) = excel.worksheet_range_at(0) {
            let mut rows = range.rows();
            if let Some(_header) = rows.next() {
                for row in rows {
                    let task = crate::models::TaskRow {
                        title: row.get(0).map(|d| d.to_string()).unwrap_or_default(),
                        description: row.get(1).map(|d| d.to_string()),
                        task_type: row.get(2).map(|d| d.to_string()),
                        task_category: row.get(3).map(|d| d.to_string()),
                        status: row.get(4).map(|d| d.to_string()),
                        planned_start_date: row.get(5).map(|d| d.to_string()),
                        planned_end_date: row.get(6).map(|d| d.to_string()),
                        actual_start_date: row.get(7).map(|d| d.to_string()),
                        actual_end_date: row.get(8).map(|d| d.to_string()),
                        progress: row.get(9).and_then(|d| d.as_i64()),
                        assignee_login: row.get(10).map(|d| d.to_string()),
                    };
                    tasks.push(task);
                }
            }
        }
    } else {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Unsupported file format"}))));
    }

    let mut created = 0;
    let mut failed = 0;

    for task in tasks {
        let assignee_id = if let Some(login) = task.assignee_login {
            let stmt = SeaQuery::select()
                .column("id")
                .from("users")
                .and_where(Expr::col("login").eq(login))
                .to_owned();
            crate::db::fetch_optional(&pool, &stmt)
                .await
                .ok()
                .flatten()
                .map(|row| row.get::<i64, _>("id"))
        } else {
            None
        };

        let now = crate::db::now_string();
        let stmt = SeaQuery::insert()
            .into_table("tasks")
            .columns([
                "id", "project_id", "title", "description", "task_type", "task_category", "status",
                "planned_start_date", "planned_end_date", "actual_start_date", "actual_end_date",
                "progress", "author_id", "assignee_id", "created_at", "updated_at"
            ])
            .values_panic([
                crate::db::new_id().into(),
                project_id.into(),
                task.title.clone().into(),
                task.description.clone().into(),
                task.task_type.clone().into(),
                task.task_category.clone().into(),
                task.status.clone().unwrap_or_else(|| "New".to_string()).into(),
                task.planned_start_date.clone().into(),
                task.planned_end_date.clone().into(),
                task.actual_start_date.clone().into(),
                task.actual_end_date.clone().into(),
                task.progress.unwrap_or(0).into(),
                user.id.into(),
                assignee_id.into(),
                now.clone().into(),
                now.into()
            ])
            .to_owned();
        let result = crate::db::execute(&pool, &stmt).await;

        match result {
            Ok(_) => created += 1,
            Err(e) => {
                failed += 1;
                errors.push(format!("Failed to insert task '{}': {}", task.title, e));
            }
        }
    }

    Ok(Json(json!({ "success": true, "data": { "created": created, "failed": failed, "errors": errors } })))
}

async fn get_tasks(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_admin = user.role == "admin";

    let mut stmt = SeaQuery::select();
    stmt.expr(Expr::col(("t", Asterisk)))
        .expr_as(Expr::col(("p", "name")), "project_name")
        .expr_as(Expr::col(("p", "identifier")), "project_identifier")
        .expr_as(Expr::col(("u", "login")), "assignee_login")
        .expr_as(Expr::col(("u", "firstname")), "assignee_firstname")
        .expr_as(Expr::col(("u", "lastname")), "assignee_lastname")
        .from_as("tasks", "t")
        .join_as(JoinType::Join, "projects", "p", Expr::col(("p", "id")).equals(("t", "project_id")))
        .join_as(JoinType::LeftJoin, "users", "u", Expr::col(("u", "id")).equals(("t", "assignee_id")))
        .order_by(("t", "updated_at"), Order::Desc);

    if !is_admin {
        stmt.join_as(JoinType::Join, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")).and(Expr::col(("pm", "user_id")).eq(user.id)));
    }


    let tasks = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let mut filtered_data: Vec<Value> = tasks.into_iter().map(|t| {
        let firstname: Option<String> = t.get("assignee_firstname");
        let lastname: Option<String> = t.get("assignee_lastname");
        let login: Option<String> = t.get("assignee_login");
        let assignee_name = display_name(firstname.as_deref(), lastname.as_deref(), login.as_deref().unwrap_or(""));

        json!({
            "id": t.get::<i64, _>("id").to_string(),
            "project_id": t.get::<i64, _>("project_id").to_string(),
            "title": t.get::<String, _>("title"),
            "description": t.get::<Option<String>, _>("description"),
            "task_type": t.get::<Option<String>, _>("task_type"),
            "task_category": t.get::<Option<String>, _>("task_category"),
            "status": t.get::<Option<String>, _>("status"),
            "planned_start_date": t.get::<Option<String>, _>("planned_start_date"),
            "planned_end_date": t.get::<Option<String>, _>("planned_end_date"),
            "actual_start_date": t.get::<Option<String>, _>("actual_start_date"),
            "actual_end_date": t.get::<Option<String>, _>("actual_end_date"),
            "progress": t.get::<i64, _>("progress"),
            "author_id": t.get::<i64, _>("author_id").to_string(),
            "assignee_id": t.get::<Option<i64>, _>("assignee_id").map(|v| v.to_string()),
            "parent_task_id": t.get::<Option<i64>, _>("parent_task_id").map(|v| v.to_string()),
            "assignee_login": login,
            "assignee_name": assignee_name,
            "project_name": t.get::<String, _>("project_name"),
            "project_identifier": t.get::<String, _>("project_identifier"),
            "updated_at": t.get::<String, _>("updated_at")
        })
    }).collect();

    // Accept both `project_id` (client/api convention) and `project` (legacy web param).
    let project = params.get("project_id").or_else(|| params.get("project"));
    if let Some(p_id) = project {
        if !p_id.is_empty() && p_id != "all" {
            filtered_data.retain(|item| {
                item["project_identifier"].as_str() == Some(p_id.as_str()) ||
                item["project_id"].as_str() == Some(p_id.as_str())
            });
        }
    }
    if let Some(status) = params.get("status") {
        if !status.is_empty() && status != "all" {
            let statuses: Vec<&str> = status.split(',').collect();
            filtered_data.retain(|item| {
                item["status"].as_str().map(|s| statuses.contains(&s)).unwrap_or(false)
            });
        }
    }
    if let Some(assignee) = params.get("assignee_id") {
        if !assignee.is_empty() && assignee != "all" {
            filtered_data.retain(|item| item["assignee_id"].as_str() == Some(assignee.as_str()));
        }
    }

    let total = filtered_data.len();
    Ok(Json(json!({ "success": true, "data": filtered_data, "total": total })))
}

async fn create_task(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<CreateTaskRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_project_member(&pool, &user, req.project_id).await?;

    if is_project_archived(&pool, req.project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    // Validation: title required (non-blank after trim), progress must be 0..=100,
    // planned_start_date must be on or before planned_end_date.
    if req.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Title is required"}))));
    }
    if let Some(progress) = req.progress {
        if !(0..=100).contains(&progress) {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Progress must be between 0 and 100"}))));
        }
    }
    if let (Some(start), Some(end)) = (&req.planned_start_date, &req.planned_end_date) {
        if start > end {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "planned_end_date must be on or after planned_start_date"}))));
        }
    }
    if let (Some(start), Some(end)) = (&req.actual_start_date, &req.actual_end_date) {
        if start > end {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "actual_end_date must be on or after actual_start_date"}))));
        }
    }
    if let Some(parent_id) = req.parent_task_id {
        validate_parent_task(&pool, req.project_id, None, parent_id).await?;
    }

    let now = crate::db::now_string();
    let task_id = crate::db::new_id();
    let stmt = SeaQuery::insert()
        .into_table("tasks")
        .columns([
            "id", "project_id", "title", "description", "task_type", "task_category", "status",
            "planned_start_date", "planned_end_date", "actual_start_date", "actual_end_date",
            "progress", "author_id", "assignee_id", "parent_task_id", "created_at", "updated_at"
        ])
        .values_panic([
            task_id.into(),
            req.project_id.into(),
            req.title.into(),
            req.description.unwrap_or_default().into(),
            req.task_type.into(),
            req.task_category.into(),
            req.status.unwrap_or_else(|| "New".to_string()).into(),
            req.planned_start_date.into(),
            req.planned_end_date.into(),
            req.actual_start_date.into(),
            req.actual_end_date.into(),
            req.progress.unwrap_or(0).into(),
            user.id.into(),
            req.assignee_id.into(),
            req.parent_task_id.into(),
            now.clone().into(),
            now.into()
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "id": task_id.to_string() })))
}

/// Build the joined SELECT used to fetch a full task row with project/user display info.
fn task_select_stmt(id: i64) -> SelectStatement {
    SeaQuery::select()
        .expr(Expr::col(("t", Asterisk)))
        .expr_as(Expr::col(("p", "name")), "project_name")
        .expr_as(Expr::col(("p", "identifier")), "project_identifier")
        .expr_as(Expr::col(("u", "firstname")), "assignee_firstname")
        .expr_as(Expr::col(("u", "lastname")), "assignee_lastname")
        .expr_as(Expr::col(("u", "login")), "assignee_login")
        .from_as("tasks", "t")
        .join_as(JoinType::Join, "projects", "p", Expr::col(("p", "id")).equals(("t", "project_id")))
        .join_as(JoinType::LeftJoin, "users", "u", Expr::col(("u", "id")).equals(("t", "assignee_id")))
        .and_where(Expr::col(("t", "id")).eq(id))
        .to_owned()
}

/// Fetch a full task row (with joined project/user info) by id.
async fn fetch_task_by_id(pool: &Arc<AnyPool>, id: i64) -> Result<Option<sqlx::any::AnyRow>, sqlx::Error> {
    let stmt = task_select_stmt(id);
    crate::db::fetch_optional(pool, &stmt).await
}

/// Serialize a task row (from `task_select_stmt`) into the API response object.
fn task_row_to_json(t: &sqlx::any::AnyRow) -> Value {
    let firstname: Option<String> = t.get("assignee_firstname");
    let lastname: Option<String> = t.get("assignee_lastname");
    let login: Option<String> = t.get("assignee_login");
    let assignee_name = display_name(firstname.as_deref(), lastname.as_deref(), login.as_deref().unwrap_or(""));

    json!({
        "id": t.get::<i64, _>("id").to_string(),
        "project_id": t.get::<i64, _>("project_id").to_string(),
        "title": t.get::<String, _>("title"),
        "description": t.get::<Option<String>, _>("description"),
        "task_type": t.get::<Option<String>, _>("task_type"),
        "task_category": t.get::<Option<String>, _>("task_category"),
        "status": t.get::<Option<String>, _>("status"),
        "planned_start_date": t.get::<Option<String>, _>("planned_start_date"),
        "planned_end_date": t.get::<Option<String>, _>("planned_end_date"),
        "actual_start_date": t.get::<Option<String>, _>("actual_start_date"),
        "actual_end_date": t.get::<Option<String>, _>("actual_end_date"),
        "progress": t.get::<i64, _>("progress"),
        "author_id": t.get::<i64, _>("author_id").to_string(),
        "assignee_id": t.get::<Option<i64>, _>("assignee_id").map(|v| v.to_string()),
        "parent_task_id": t.get::<Option<i64>, _>("parent_task_id").map(|v| v.to_string()),
        "assignee_name": assignee_name,
        "project_name": t.get::<String, _>("project_name"),
        "project_identifier": t.get::<String, _>("project_identifier"),
        "created_at": t.get::<String, _>("created_at"),
        "updated_at": t.get::<String, _>("updated_at")
    })
}

async fn get_task_by_id(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("tasks")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let task_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Task not found"}))))?;
    
    let project_id: i64 = task_info.get("project_id");
    check_project_access(&pool, &user, &project_id.to_string()).await?;

    let task = fetch_task_by_id(&pool, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(t) = task {
        Ok(Json(json!({ "success": true, "data": task_row_to_json(&t) })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Task not found"}))))
    }
}

async fn update_task(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<UpdateTaskRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("tasks")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let task_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Task not found"}))))?;

    let project_id: i64 = task_info.get("project_id");
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    // Validation: title must be non-blank after trim, progress must be 0..=100,
    // planned_start_date must be on or before planned_end_date.
    if let Some(title) = &req.title {
        if title.trim().is_empty() {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Title is required"}))));
        }
    }
    if let Some(progress) = req.progress {
        if !(0..=100).contains(&progress) {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Progress must be between 0 and 100"}))));
        }
    }
    if let (Some(Some(start)), Some(Some(end))) = (&req.planned_start_date, &req.planned_end_date) {
        if start > end {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "planned_end_date must be on or after planned_start_date"}))));
        }
    }
    if let (Some(Some(start)), Some(Some(end))) = (&req.actual_start_date, &req.actual_end_date) {
        if start > end {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "actual_end_date must be on or after actual_start_date"}))));
        }
    }
    if let Some(Some(parent_id)) = req.parent_task_id {
        validate_parent_task(&pool, project_id, Some(id), parent_id).await?;
    }

    let mut update_stmt = SeaQuery::update();
    update_stmt.table("tasks")
        .value("updated_at", crate::db::now_string());

    if let Some(title) = req.title { update_stmt.value("title", title); }
    match req.description {
        Some(None) => { update_stmt.value("description", None::<String>); }
        Some(Some(v)) => { update_stmt.value("description", v); }
        None => {}
    }
    if let Some(task_type) = req.task_type { update_stmt.value("task_type", task_type); }
    if let Some(task_category) = req.task_category { update_stmt.value("task_category", task_category); }
    if let Some(status) = req.status { update_stmt.value("status", status); }
    match req.planned_start_date {
        Some(None) => { update_stmt.value("planned_start_date", None::<String>); }
        Some(Some(v)) => { update_stmt.value("planned_start_date", v); }
        None => {}
    }
    match req.planned_end_date {
        Some(None) => { update_stmt.value("planned_end_date", None::<String>); }
        Some(Some(v)) => { update_stmt.value("planned_end_date", v); }
        None => {}
    }
    match req.actual_start_date {
        Some(None) => { update_stmt.value("actual_start_date", None::<String>); }
        Some(Some(v)) => { update_stmt.value("actual_start_date", v); }
        None => {}
    }
    match req.actual_end_date {
        Some(None) => { update_stmt.value("actual_end_date", None::<String>); }
        Some(Some(v)) => { update_stmt.value("actual_end_date", v); }
        None => {}
    }
    if let Some(progress) = req.progress { update_stmt.value("progress", progress); }
    match req.assignee_id {
        Some(None) => { update_stmt.value("assignee_id", None::<i64>); }
        Some(Some(v)) => { update_stmt.value("assignee_id", v); }
        None => {}
    }
    match req.parent_task_id {
        Some(None) => { update_stmt.value("parent_task_id", None::<i64>); }
        Some(Some(v)) => { update_stmt.value("parent_task_id", v); }
        None => {}
    }

    let stmt = update_stmt
        .and_where(Expr::col("id").eq(id))
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Return the updated task with the same shape as `get_task_by_id`.
    let task = fetch_task_by_id(&pool, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(t) = task {
        Ok(Json(json!({ "success": true, "data": task_row_to_json(&t) })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Task not found"}))))
    }
}

/// Bulk update multiple tasks (assignee, progress, planned dates, status/type/category).
///
/// Mirrors `update_task` field semantics: `Some(None)` clears to SQL NULL,
/// `Some(Some(v))` sets the value, `None` leaves the column unchanged.
async fn bulk_update_tasks(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<BulkUpdateTasksRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if req.task_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "task_ids is required"}))));
    }

    // Validation: progress must be 0..=100, planned dates must be in order.
    if let Some(progress) = req.progress {
        if !(0..=100).contains(&progress) {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Progress must be between 0 and 100"}))));
        }
    }
    if let (Some(Some(start)), Some(Some(end))) = (&req.planned_start_date, &req.planned_end_date) {
        if start > end {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "planned_end_date must be on or after planned_start_date"}))));
        }
    }

    let mut updated = 0usize;

    for id in req.task_ids {
        let stmt = SeaQuery::select()
            .column("project_id")
            .from("tasks")
            .and_where(Expr::col("id").eq(id))
            .to_owned();
        let task_info = crate::db::fetch_optional(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let project_id: i64 = match task_info {
            Some(info) => info.get("project_id"),
            None => return Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Task not found"})))),
        };

        require_project_member(&pool, &user, project_id).await?;

        if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
            return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
        }

        let mut update_stmt = SeaQuery::update();
        update_stmt.table("tasks")
            .value("updated_at", crate::db::now_string());

        match req.assignee_id {
            Some(None) => { update_stmt.value("assignee_id", None::<i64>); }
            Some(Some(v)) => { update_stmt.value("assignee_id", v); }
            None => {}
        }
        if let Some(progress) = req.progress { update_stmt.value("progress", progress); }
        match &req.planned_start_date {
            Some(None) => { update_stmt.value("planned_start_date", None::<String>); }
            Some(Some(v)) => { update_stmt.value("planned_start_date", v.as_str()); }
            None => {}
        }
        match &req.planned_end_date {
            Some(None) => { update_stmt.value("planned_end_date", None::<String>); }
            Some(Some(v)) => { update_stmt.value("planned_end_date", v.as_str()); }
            None => {}
        }
        if let Some(status) = &req.status { update_stmt.value("status", status.as_str()); }
        if let Some(task_type) = &req.task_type { update_stmt.value("task_type", task_type.as_str()); }
        if let Some(task_category) = &req.task_category { update_stmt.value("task_category", task_category.as_str()); }

        let stmt = update_stmt
            .and_where(Expr::col("id").eq(id))
            .to_owned();

        crate::db::execute(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        updated += 1;
    }

    Ok(Json(json!({ "success": true, "data": { "updated": updated } })))
}

async fn delete_task(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let stmt = SeaQuery::select()
        .columns(["project_id", "author_id"])
        .from("tasks")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let task_info = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Task not found"}))))?;

    let project_id: i64 = task_info.get("project_id");
    let author_id: i64 = task_info.get("author_id");

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    if user.id != author_id && user.role != "admin" {
        let stmt = SeaQuery::select()
            .column("role")
            .from("project_members")
            .and_where(Expr::col("project_id").eq(project_id))
            .and_where(Expr::col("user_id").eq(user.id))
            .to_owned();
        let role: Option<String> = crate::db::fetch_scalar_optional(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        match role {
            Some(r) if r == "manager" => (),
            _ => return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "권한이 없습니다."})))),
        }
    }

    // 하위 일감은 함께 지우지 않고 최상위로 승격시킨다.
    // (구버전 DB는 ALTER 로 컬럼만 추가되어 self FK 가 없으므로 명시적으로 처리한다.)
    let promote_stmt = SeaQuery::update()
        .table("tasks")
        .value("parent_task_id", None::<i64>)
        .and_where(Expr::col("parent_task_id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &promote_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::delete()
        .from_table("tasks")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}
