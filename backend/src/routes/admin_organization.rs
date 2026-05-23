use axum::{
    extract::{Extension, Path},
    response::Json,
    http::StatusCode,
    routing::{get, post, put, delete},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery};
use crate::auth::AuthUser;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/admin/organization/settings", get(admin_get_organization_settings))
            .route("/admin/organization/settings", put(admin_update_organization_settings))
            .route("/admin/organization/departments", get(admin_list_departments))
            .route("/admin/organization/departments", post(admin_create_department))
            .route("/admin/organization/departments/:id", get(admin_get_department))
            .route("/admin/organization/departments/:id", put(admin_update_department))
            .route("/admin/organization/departments/:id", delete(admin_delete_department))
            .route("/admin/organization/departments/:id/members", get(admin_list_department_members)),
    )
}

async fn admin_get_organization_settings(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let stmt = SeaQuery::select()
        .columns([Asterisk])
        .from("organizations")
        .order_by("id", Order::Asc)
        .limit(1)
        .to_owned();
    let org = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Organization not found"}))))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": org.get::<i64, _>("id").to_string(),
            "name": org.get::<String, _>("name"),
            "domain": org.get::<String, _>("domain"),
            "created_at": org.get::<String, _>("created_at"),
            "updated_at": org.get::<String, _>("updated_at"),
        }
    })))
}

async fn admin_update_organization_settings(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let domain = body.get("domain").and_then(|v| v.as_str()).unwrap_or("");

    let id_stmt = SeaQuery::select()
        .column("id")
        .from("organizations")
        .order_by("id", Order::Asc)
        .limit(1)
        .to_owned();
    let org_id: i64 = crate::db::fetch_scalar(&pool, &id_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::update()
        .table("organizations")
        .value("name", name)
        .value("domain", domain)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(org_id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let stmt = SeaQuery::select()
        .columns([Asterisk])
        .from("organizations")
        .order_by("id", Order::Asc)
        .limit(1)
        .to_owned();
    let org = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Organization not found"}))))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": org.get::<i64, _>("id").to_string(),
            "name": org.get::<String, _>("name"),
            "domain": org.get::<String, _>("domain"),
            "created_at": org.get::<String, _>("created_at"),
            "updated_at": org.get::<String, _>("updated_at"),
        }
    })))
}

async fn admin_list_departments(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let stmt = SeaQuery::select()
        .column(("d", Asterisk))
        .expr_as(Expr::col(("dp", "name")), "parent_name")
        .from_as("departments", "d")
        .join_as(
            JoinType::LeftJoin,
            "departments",
            "dp",
            Expr::col(("dp", "id")).eq(Expr::col(("d", "parent_id")))
        )
        .order_by(("d", "created_at"), Order::Desc)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "name": r.get::<String, _>("name"),
            "parent_id": r.get::<Option<i64>, _>("parent_id").map(|v| v.to_string()),
            "parent_name": r.get::<Option<String>, _>("parent_name"),
            "description": r.get::<String, _>("description"),
            "member_count": 0,
            "created_at": r.get::<String, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

async fn admin_create_department(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("")
        .to_string();
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Name is required"}))));
    }

    let parent_id = body
        .get("parent_id")
        .and_then(crate::serde_utils::value_to_opt_i64);
    let description = body.get("description").and_then(|v| v.as_str()).unwrap_or("");

    let department_id = crate::db::new_id();

    let stmt = SeaQuery::insert()
        .into_table("departments")
        .columns(["id", "organization_id", "name", "parent_id", "description", "created_at", "updated_at"])
        .values_panic([
            department_id.into(),
            1.into(),
            name.clone().into(),
            parent_id.into(),
            description.into(),
            crate::db::now_string().into(),
            crate::db::now_string().into(),
        ])
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let now = crate::db::now_string();

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": department_id.to_string(),
            "name": name,
            "parent_id": parent_id.map(|v| v.to_string()),
            "parent_name": null,
            "description": description,
            "member_count": 0,
            "created_at": now,
            "updated_at": now,
        }
    })))
}

async fn admin_get_department(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let stmt = SeaQuery::select()
        .column(("d", Asterisk))
        .expr_as(Expr::col(("dp", "name")), "parent_name")
        .from_as("departments", "d")
        .join_as(
            JoinType::LeftJoin,
            "departments",
            "dp",
            Expr::col(("dp", "id")).eq(Expr::col(("d", "parent_id")))
        )
        .and_where(Expr::col(("d", "id")).eq(id))
        .to_owned();
    let dept = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Department not found"}))))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": dept.get::<i64, _>("id").to_string(),
            "name": dept.get::<String, _>("name"),
            "parent_id": dept.get::<Option<i64>, _>("parent_id").map(|v| v.to_string()),
            "parent_name": dept.get::<Option<String>, _>("parent_name"),
            "description": dept.get::<String, _>("description"),
            "created_at": dept.get::<String, _>("created_at"),
            "updated_at": dept.get::<String, _>("updated_at"),
        }
    })))
}

async fn admin_update_department(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let stmt = SeaQuery::select()
        .columns([Asterisk])
        .from("departments")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let dept = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Department not found"}))))?;

    let name = body.get("name").and_then(|v| v.as_str())
        .unwrap_or(&dept.get::<String, _>("name"))
        .to_string();
    let description = body.get("description").and_then(|v| v.as_str())
        .unwrap_or(&dept.get::<String, _>("description"))
        .to_string();
    let parent_id: Option<i64> = if body.get("parent_id").is_some() {
        body.get("parent_id").and_then(crate::serde_utils::value_to_opt_i64)
    } else {
        dept.get::<Option<i64>, _>("parent_id")
    };

    let stmt = SeaQuery::update()
        .table("departments")
        .value("name", name.clone())
        .value("description", description.clone())
        .value("parent_id", parent_id)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Re-fetch to return updated data
    let stmt = SeaQuery::select()
        .column(("d", Asterisk))
        .expr_as(Expr::col(("dp", "name")), "parent_name")
        .from_as("departments", "d")
        .join_as(
            JoinType::LeftJoin,
            "departments",
            "dp",
            Expr::col(("dp", "id")).eq(Expr::col(("d", "parent_id")))
        )
        .and_where(Expr::col(("d", "id")).eq(id))
        .to_owned();
    let dept = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Department not found"}))))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": dept.get::<i64, _>("id").to_string(),
            "name": dept.get::<String, _>("name"),
            "parent_id": dept.get::<Option<i64>, _>("parent_id").map(|v| v.to_string()),
            "parent_name": dept.get::<Option<String>, _>("parent_name"),
            "description": dept.get::<String, _>("description"),
            "member_count": 0,
            "created_at": dept.get::<String, _>("created_at"),
            "updated_at": dept.get::<String, _>("updated_at"),
        }
    })))
}

async fn admin_delete_department(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    // Verify department exists
    let stmt = SeaQuery::select()
        .column("id")
        .from("departments")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    let _dept = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Department not found"}))))?;

    // First, unset parent_id for child departments
    let stmt = SeaQuery::update()
        .table("departments")
        .value("parent_id", None::<i64>)
        .and_where(Expr::col("parent_id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    // Then delete the department
    let stmt = SeaQuery::delete()
        .from_table("departments")
        .and_where(Expr::col("id").eq(id))
        .to_owned();
    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

async fn admin_list_department_members(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    let stmt = SeaQuery::select()
        .columns([("u", "id"), ("u", "login"), ("u", "email"), ("u", "firstname"), ("u", "lastname"), ("u", "role"), ("u", "is_active")])
        .from_as("users", "u")
        .and_where(Expr::col(("u", "department_id")).eq(id))
        .order_by(("u", "lastname"), Order::Asc)
        .order_by(("u", "firstname"), Order::Asc)
        .to_owned();
    let rows = crate::db::fetch_all(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    let data: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id").to_string(),
            "login": r.get::<String, _>("login"),
            "email": r.get::<String, _>("email"),
            "firstname": r.get::<String, _>("firstname"),
            "lastname": r.get::<String, _>("lastname"),
            "role": r.get::<String, _>("role"),
            "is_active": r.get::<i64, _>("is_active"),
        })
    }).collect();

    Ok(Json(json!({ "success": true, "data": data })))
}
