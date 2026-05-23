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
use sea_query::{Expr, ExprTrait, JoinType, Order, Query as SeaQuery};
use crate::auth::AuthUser;
use crate::routes::utils::{check_project_access, is_project_archived, require_project_member};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/projects/:project_id/custom-fields", get(list_custom_fields).post(create_custom_field))
            .route("/projects/:project_id/custom-fields/:field_id", put(update_custom_field).delete(delete_custom_field))
            .route("/issues/:issue_id/custom-values", get(get_issue_custom_values).put(save_custom_values)),
    )
}

// ---------------------------------------------------------------------------
// List custom fields for a project
// ---------------------------------------------------------------------------

async fn list_custom_fields(
    Path(project_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = crate::serde_utils::parse_path_id(&project_id_str)?;
    check_project_access(&pool, &user, &project_id.to_string()).await?;

    let stmt = SeaQuery::select()
        .columns(["id", "project_id", "field_name", "field_type", "is_required", "sort_order", "options", "created_at"])
        .from("issue_custom_fields")
        .and_where(Expr::col("project_id").eq(project_id))
        .order_by("sort_order", Order::Asc)
        .to_owned();

    let rows = crate::db::fetch_all(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let fields: Vec<Value> = rows.iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "project_id": r.get::<i64, _>("project_id").to_string(),
            "field_name": r.get::<String, _>("field_name"),
            "field_type": r.get::<String, _>("field_type"),
            "is_required": r.get::<i64, _>("is_required"),
            "sort_order": r.get::<i64, _>("sort_order"),
            "options": r.get::<Option<String>, _>("options"),
            "created_at": r.get::<String, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": fields })))
}

// ---------------------------------------------------------------------------
// Create a custom field
// ---------------------------------------------------------------------------

async fn create_custom_field(
    Path(project_id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = crate::serde_utils::parse_path_id(&project_id_str)?;
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let field_name = req.get("field_name").and_then(|v| v.as_str()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "field_name is required"})))
    })?;
    let field_type = req.get("field_type").and_then(|v| v.as_str()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "field_type is required"})))
    })?;

    match field_type {
        "integer" | "float" | "string" | "text" | "date" | "time" | "boolean" => {}
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Invalid field_type. Must be one of: integer, float, string, text, date, time, boolean"})))),
    }

    let is_required = req.get("is_required").and_then(|v| v.as_i64()).unwrap_or(0);
    let sort_order = req.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0);
    let options = req.get("options").map(|v| {
        if v.is_null() { None } else { v.as_str().map(|s| s.to_string()) }
    }).flatten();

    let now = crate::db::now_string();
    let field_id = crate::db::new_id();

    let stmt = SeaQuery::insert()
        .into_table("issue_custom_fields")
        .columns(["id", "project_id", "field_name", "field_type", "is_required", "sort_order", "options", "created_at"])
        .values_panic([
            field_id.into(),
            project_id.into(),
            field_name.into(),
            field_type.into(),
            is_required.into(),
            sort_order.into(),
            options.into(),
            now.into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "id": field_id.to_string() })))
}

// ---------------------------------------------------------------------------
// Update a custom field
// ---------------------------------------------------------------------------

async fn update_custom_field(
    Path((project_id_str, field_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = crate::serde_utils::parse_path_id(&project_id_str)?;
    let field_id = crate::serde_utils::parse_path_id(&field_id_str)?;
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    // Verify field exists and belongs to this project
    let stmt = SeaQuery::select()
        .columns(["id"])
        .from("issue_custom_fields")
        .and_where(Expr::col("id").eq(field_id))
        .and_where(Expr::col("project_id").eq(project_id))
        .to_owned();

    let _field = crate::db::fetch_optional(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Custom field not found"}))))?;

    let mut update_stmt = SeaQuery::update();
    update_stmt.table("issue_custom_fields");

    if let Some(field_name) = req.get("field_name").and_then(|v| v.as_str()) {
        update_stmt.value("field_name", field_name);
    }
    if let Some(field_type) = req.get("field_type").and_then(|v| v.as_str()) {
        match field_type {
            "integer" | "float" | "string" | "text" | "date" | "time" | "boolean" => {}
            _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Invalid field_type. Must be one of: integer, float, string, text, date, time, boolean"})))),
        }
        update_stmt.value("field_type", field_type);
    }
    if let Some(is_required) = req.get("is_required").and_then(|v| v.as_i64()) {
        update_stmt.value("is_required", is_required);
    }
    if let Some(sort_order) = req.get("sort_order").and_then(|v| v.as_i64()) {
        update_stmt.value("sort_order", sort_order);
    }
    if req.get("options").is_some() {
        let options = req.get("options").map(|v| {
            if v.is_null() { None } else { v.as_str().map(|s| s.to_string()) }
        }).flatten();
        update_stmt.value("options", options);
    }

    update_stmt.and_where(Expr::col("id").eq(field_id));
    update_stmt.and_where(Expr::col("project_id").eq(project_id));

    crate::db::execute(&pool, &update_stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

// ---------------------------------------------------------------------------
// Delete a custom field
// ---------------------------------------------------------------------------

async fn delete_custom_field(
    Path((project_id_str, field_id_str)): Path<(String, String)>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let project_id = crate::serde_utils::parse_path_id(&project_id_str)?;
    let field_id = crate::serde_utils::parse_path_id(&field_id_str)?;
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    // Verify field exists and belongs to this project
    let stmt = SeaQuery::select()
        .columns(["id"])
        .from("issue_custom_fields")
        .and_where(Expr::col("id").eq(field_id))
        .and_where(Expr::col("project_id").eq(project_id))
        .to_owned();

    crate::db::fetch_optional(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Custom field not found"}))))?;

    let stmt = SeaQuery::delete()
        .from_table("issue_custom_fields")
        .and_where(Expr::col("id").eq(field_id))
        .and_where(Expr::col("project_id").eq(project_id))
        .to_owned();

    crate::db::execute(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

// ---------------------------------------------------------------------------
// Get custom values for an issue
// ---------------------------------------------------------------------------

async fn get_issue_custom_values(
    Path(issue_id): Path<i64>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Get project_id for permission check
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("issues")
        .and_where(Expr::col("id").eq(issue_id))
        .to_owned();

    let issue_info = crate::db::fetch_optional(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;

    let project_id: i64 = issue_info.get(0);
    check_project_access(&pool, &user, &project_id.to_string()).await?;

    let stmt = SeaQuery::select()
        .expr_as(Expr::col(("v", "field_id")), "field_id")
        .expr_as(Expr::col(("f", "field_name")), "field_name")
        .expr_as(Expr::col(("f", "field_type")), "field_type")
        .expr_as(Expr::col(("v", "value")), "value")
        .from_as("issue_custom_field_values", "v")
        .join_as(JoinType::InnerJoin, "issue_custom_fields", "f",
            Expr::col(("f", "id")).equals(("v", "field_id")))
        .and_where(Expr::col(("v", "issue_id")).eq(issue_id))
        .to_owned();

    let rows = crate::db::fetch_all(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let values: Vec<Value> = rows.iter().map(|r| {
        json!({
            "field_id": r.get::<i64, _>("field_id").to_string(),
            "field_name": r.get::<String, _>("field_name"),
            "field_type": r.get::<String, _>("field_type"),
            "value": r.get::<Option<String>, _>("value"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": values })))
}

// ---------------------------------------------------------------------------
// Validation helper for custom field values
// ---------------------------------------------------------------------------

fn validate_custom_value(value: &str, field_type: &str) -> Result<(), String> {
    if value.is_empty() {
        return Ok(());
    }
    match field_type {
        "integer" => value.parse::<i64>().map(|_| ()).map_err(|_| format!("'{value}' is not a valid integer")),
        "float" => value.parse::<f64>().map(|_| ()).map_err(|_| format!("'{value}' is not a valid float")),
        "boolean" => {
            if ["true", "false", "1", "0", "yes", "no"].contains(&value.to_lowercase().as_str()) {
                Ok(())
            } else {
                Err(format!("'{value}' is not a valid boolean"))
            }
        }
        "date" => {
            // Accept YYYY-MM-DD format
            if value.len() == 10
                && value.chars().nth(4) == Some('-')
                && value.chars().nth(7) == Some('-')
                && value.chars().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
            {
                Ok(())
            } else {
                Err(format!("'{value}' is not a valid date (expected YYYY-MM-DD)"))
            }
        }
        "time" => {
            // Accept HH:MM or HH:MM:SS
            let parts: Vec<&str> = value.split(':').collect();
            if (parts.len() == 2 || parts.len() == 3)
                && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
            {
                Ok(())
            } else {
                Err(format!("'{value}' is not a valid time (expected HH:MM or HH:MM:SS)"))
            }
        }
        // string and text: any non-empty value is valid
        _ => Ok(()),
    }
}

// ---------------------------------------------------------------------------
// Save custom values for an issue (batch upsert)
// ---------------------------------------------------------------------------

async fn save_custom_values(
    Path(issue_id): Path<i64>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(req): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Get project_id for permission check
    let stmt = SeaQuery::select()
        .column("project_id")
        .from("issues")
        .and_where(Expr::col("id").eq(issue_id))
        .to_owned();

    let issue_info = crate::db::fetch_optional(&pool, &stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Issue not found"}))))?;

    let project_id: i64 = issue_info.get(0);
    require_project_member(&pool, &user, project_id).await?;

    if is_project_archived(&pool, project_id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))? {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "보관된 프로젝트는 수정할 수 없습니다."}))));
    }

    let values = req.get("values").and_then(|v| v.as_array()).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "values array is required"})))
    })?;

    // Fetch field definitions for validation
    let field_ids: Vec<i64> = values.iter()
        .filter_map(|v| v.get("field_id").and_then(crate::serde_utils::value_to_opt_i64))
        .collect();

    if !field_ids.is_empty() {
        let stmt = SeaQuery::select()
            .columns(["id", "field_type", "is_required"])
            .from("issue_custom_fields")
            .and_where(Expr::col("project_id").eq(project_id))
            .and_where(Expr::col("id").is_in(field_ids.clone()))
            .to_owned();

        let field_rows = crate::db::fetch_all(&pool, &stmt).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        let field_map: std::collections::HashMap<i64, (String, bool)> = field_rows.iter()
            .map(|r| {
                let id: i64 = r.get("id");
                let ft: String = r.get("field_type");
                let req: i64 = r.get("is_required");
                (id, (ft, req != 0))
            })
            .collect();

        for val in values.iter() {
            let fid = val.get("field_id").and_then(crate::serde_utils::value_to_opt_i64).ok_or_else(|| {
                (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Each value must have a field_id"})))
            })?;

            if let Some((field_type, is_required)) = field_map.get(&fid) {
                let value_str = val.get("value").and_then(|v| v.as_str()).unwrap_or("");

                if *is_required && value_str.is_empty() {
                    return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": format!("Field {fid} is required")}))));
                }

                if !value_str.is_empty() {
                    if let Err(e) = validate_custom_value(value_str, field_type) {
                        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": e}))));
                    }
                }
            }
        }
    }

    // Delete existing values for this issue
    let delete_stmt = SeaQuery::delete()
        .from_table("issue_custom_field_values")
        .and_where(Expr::col("issue_id").eq(issue_id))
        .to_owned();

    crate::db::execute(&pool, &delete_stmt).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Batch insert new values (single statement)
    if !values.is_empty() {
        let mut insert_stmt = SeaQuery::insert();
        insert_stmt.into_table("issue_custom_field_values");
        insert_stmt.columns(["id", "issue_id", "field_id", "value"]);

        for val in values.iter() {
            let field_id = val.get("field_id").and_then(crate::serde_utils::value_to_opt_i64).ok_or_else(|| {
                (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Each value must have a field_id"})))
            })?;
            let value = val.get("value").map(|v| {
                if v.is_null() { None } else { v.as_str().map(|s| s.to_string()) }
            }).flatten();

            let id = crate::db::new_id();
            insert_stmt.values_panic([
                id.into(),
                issue_id.into(),
                field_id.into(),
                value.into(),
            ]);
        }

        crate::db::execute(&pool, &insert_stmt).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
    }

    Ok(Json(json!({ "success": true })))
}
