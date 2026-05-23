use axum::{
    extract::{Extension, Path, Query},
    response::Json,
    http::StatusCode,
    routing::{get, post, put, delete, patch},
    Router,
};
use std::sync::Arc;
use std::collections::HashMap;
use serde_json::{json, Value};
use sqlx::AnyPool;
use uuid::Uuid;
use crate::models::{User, RegisterRequest, UpdateUserRequest, UpdatePasswordRequest};
use crate::auth::AuthUser;
use sqlx::Row;
use sea_query::{Asterisk, Expr, ExprTrait, Func, JoinType, Order, Query as SeaQuery, SelectStatement};

/// 사용자 조회의 공통 뼈대. 조직·부서 이름을 함께 가져옵니다.
///
/// 조직은 사용자에 직접 지정된 값이 우선이고, 없으면 소속 부서의 조직을 따릅니다.
fn user_select_base() -> SelectStatement {
    SeaQuery::select()
        .from_as("users", "u")
        .join_as(
            JoinType::LeftJoin,
            "departments",
            "d",
            Expr::col(("d", "id")).equals(("u", "department_id")),
        )
        .join_as(
            JoinType::LeftJoin,
            "organizations",
            "o",
            Expr::col(("o", "id")).eq(Func::coalesce([
                Expr::col(("u", "organization_id")),
                Expr::col(("d", "organization_id")),
            ])),
        )
        .expr_as(Expr::col(("o", "name")), "organization_name")
        .expr_as(Expr::col(("d", "name")), "department_name")
        .to_owned()
}

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/users", get(get_users))
            .route("/users/:id", get(get_user_by_id))
            .route("/users", post(create_user))
            .route("/users/:id", put(update_user))
            .route("/users/:id/password", post(update_user_password))
            .route("/users/:id", delete(delete_user))
            .route("/users/:id/activity", get(get_user_activity))
            .route("/users/bulk/department", patch(bulk_update_department)),
    )
}

#[utoipa::path(
    get,
    path = "/users",
    responses(
        (status = 200, description = "List users", body = Vec<User>)
    ),
    security(("bearerAuth" = []))
)]
async fn get_users(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_admin = user.role == "admin";

    let mut stmt = user_select_base();
    stmt.columns([
        ("u", "id"),
        ("u", "uuid"),
        ("u", "login"),
        ("u", "email"),
        ("u", "firstname"),
        ("u", "lastname"),
        ("u", "role"),
        ("u", "is_active"),
        ("u", "organization_id"),
        ("u", "department_id"),
        ("u", "created_at"),
        ("u", "updated_at"),
    ])
    .order_by(("u", "created_at"), Order::Desc);

    if let Some(q) = params.get("q").filter(|s| !s.is_empty()) {
        let pattern = format!("%{}%", q);
        stmt.and_where(
            Expr::col(("u", "login"))
                .like(pattern.clone())
                .or(Expr::col(("u", "email")).like(pattern.clone()))
                .or(Expr::col(("u", "firstname")).like(pattern.clone()))
                .or(Expr::col(("u", "lastname")).like(pattern.clone())),
        );
    }

    // Optional pagination: ?limit=<n>&page=<n> (page is 1-based).
    if let Some(limit) = params.get("limit").and_then(|v| v.parse::<u64>().ok()).filter(|n| *n > 0) {
        stmt.limit(limit);
        let page = params.get("page").and_then(|v| v.parse::<u64>().ok()).filter(|n| *n > 0).unwrap_or(1);
        if page > 1 {
            stmt.offset((page - 1) * limit);
        }
    }

    let users = crate::db::fetch_all_as::<User, _>(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if is_admin {
        let sanitized: Vec<Value> = users.into_iter().map(|u| {
            json!({
                "id": u.id.to_string(),
                "uuid": u.uuid,
                "login": u.login,
                "email": u.email,
                "firstname": u.firstname,
                "lastname": u.lastname,
                "role": u.role,
                "is_active": u.is_active,
                "organization_id": u.organization_id.map(|v| v.to_string()),
                "department_id": u.department_id.map(|v| v.to_string()),
                "organization_name": u.organization_name,
                "department_name": u.department_name,
                "created_at": u.created_at,
                "updated_at": u.updated_at,
            })
        }).collect();
        Ok(Json(json!({ "success": true, "data": sanitized })))
    } else {
        let sanitized: Vec<Value> = users.into_iter().map(|u| {
            json!({
                "id": u.id.to_string(),
                "login": u.login,
                "firstname": u.firstname,
                "lastname": u.lastname,
                "is_active": u.is_active,
                // Hide email and role for non-admins
            })
        }).collect();
        Ok(Json(json!({ "success": true, "data": sanitized })))
    }
}

#[utoipa::path(
    get,
    path = "/users/{id}",
    params(
        ("id" = i64, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "Get user by ID", body = User),
        (status = 404, description = "User not found")
    ),
    security(("bearerAuth" = []))
)]
async fn get_user_by_id(
    Path(id_str): Path<String>,
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    let mut stmt = user_select_base();
    stmt.expr(Expr::col(("u", Asterisk))).and_where(Expr::col(("u", "id")).eq(id));

    let user = crate::db::fetch_optional(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(u) = user {
        Ok(Json(json!({
            "success": true,
            "data": {
                "id": u.get::<i64, _>("id").to_string(),
                "uuid": u.get::<String, _>("uuid"),
                "login": u.get::<String, _>("login"),
                "email": u.get::<String, _>("email"),
                "firstname": u.get::<String, _>("firstname"),
                "lastname": u.get::<String, _>("lastname"),
                "role": u.get::<String, _>("role"),
                "is_active": u.get::<i64, _>("is_active"),
                "organization_id": u.get::<Option<i64>, _>("organization_id").map(|v| v.to_string()),
                "department_id": u.get::<Option<i64>, _>("department_id").map(|v| v.to_string()),
                "organization_name": u.get::<Option<String>, _>("organization_name"),
                "department_name": u.get::<Option<String>, _>("department_name"),
                "created_at": u.get::<String, _>("created_at"),
                "updated_at": u.get::<String, _>("updated_at"),
            }
        })))
    } else {
        Err((StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "User not found"}))))
    }
}

#[utoipa::path(
    post,
    path = "/users",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "User created successfully"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearerAuth" = []))
)]
async fn create_user(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(user_data): axum::Json<RegisterRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "사용자 생성은 관리자만 가능합니다."}))));
    }
    let login = user_data.login;
    let email = user_data.email;
    let password = user_data.password;
    let firstname = user_data.firstname.unwrap_or_default();
    let lastname = user_data.lastname.unwrap_or_default();
    let role = user_data.role.unwrap_or_else(|| "user".to_string());
    let organization_id = user_data.organization_id;
    let department_id = user_data.department_id;

    let uuid = Uuid::new_v4().to_string();
    let password_hash = crate::auth::hash_password(&password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": format!("password hash failed: {}", e)}))))?;

    let now = crate::db::now_string();
    let stmt = SeaQuery::insert()
        .into_table("users")
        .columns([
            "id",
            "uuid",
            "login",
            "email",
            "password_hash",
            "firstname",
            "lastname",
            "role",
            "organization_id",
            "department_id",
            "created_at",
            "updated_at",
        ])
        .values_panic([
            crate::db::new_id().into(),
            uuid.into(),
            login.into(),
            email.into(),
            password_hash.into(),
            firstname.into(),
            lastname.into(),
            role.into(),
            organization_id.into(),
            department_id.into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    put,
    path = "/users/{id}",
    params(
        ("id" = i64, Path, description = "User ID")
    ),
    request_body = UpdateUserRequest,
    responses(
        (status = 200, description = "User updated successfully"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearerAuth" = []))
)]
async fn update_user(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(user_data): axum::Json<UpdateUserRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" && user.id != id {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "본인 또는 관리자만 수정 가능합니다."}))));
    }
    let email = user_data.email;
    let firstname = user_data.firstname;
    let lastname = user_data.lastname;
    let role = user_data.role;
    let is_active = user_data.is_active;
    let organization_id = user_data.organization_id;
    let department_id = user_data.department_id;

    // 값이 주어진 필드만 갱신합니다. (기존 COALESCE(?, col) 과 동일한 동작)
    let mut stmt = SeaQuery::update();
    stmt.table("users").value("updated_at", crate::db::now_string());

    if let Some(v) = email {
        stmt.value("email", v);
    }
    if let Some(v) = firstname {
        stmt.value("firstname", v);
    }
    if let Some(v) = lastname {
        stmt.value("lastname", v);
    }
    if let Some(v) = role {
        stmt.value("role", v);
    }
    if let Some(v) = is_active {
        stmt.value("is_active", v);
    }
    if let Some(v) = organization_id {
        stmt.value("organization_id", v);
    }
    if let Some(v) = department_id {
        stmt.value("department_id", v);
    }
    stmt.and_where(Expr::col("id").eq(id));

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    patch,
    path = "/users/bulk/department",
    request_body = BulkDepartmentRequest,
    responses(
        (status = 200, description = "Bulk update department successfully"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearerAuth" = []))
)]
async fn bulk_update_department(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(body): axum::Json<crate::models::BulkDepartmentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "관리자만 가능합니다."}))));
    }

    if body.user_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "user_ids is required"}))));
    }

    let mut success_count = 0i64;
    for uid in &body.user_ids {
        if *uid == 1 { continue; } // Skip super admin
    let stmt = SeaQuery::update()
        .table("users")
        .value("department_id", body.department_id)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(*uid))
        .to_owned();
    let result = crate::db::execute(&pool, &stmt).await;

        if let Ok(r) = result {
            success_count += r.rows_affected() as i64;
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "updated_count": success_count
        }
    })))
}

#[utoipa::path(
    post,
    path = "/users/{id}/password",
    params(
        ("id" = i64, Path, description = "User ID")
    ),
    request_body = UpdatePasswordRequest,
    responses(
        (status = 200, description = "Password updated successfully"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearerAuth" = []))
)]
async fn update_user_password(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(data): axum::Json<UpdatePasswordRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" && user.id != id {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "본인 또는 관리자만 비밀번호를 변경할 수 있습니다."}))));
    }
    let password = data.password;
    let password_hash = crate::auth::hash_password(&password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": format!("password hash failed: {}", e)}))))?;

    let stmt = SeaQuery::update()
        .table("users")
        .value("password_hash", password_hash)
        .value("updated_at", crate::db::now_string())
        .and_where(Expr::col("id").eq(id))
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    delete,
    path = "/users/{id}",
    params(
        ("id" = i64, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User deleted successfully"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearerAuth" = []))
)]
async fn delete_user(
    Path(id_str): Path<String>,
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(json!({"success": false, "error": "사용자 삭제는 관리자만 가능합니다."}))));
    }
    let stmt = SeaQuery::delete()
        .from_table("users")
        .and_where(Expr::col("id").eq(id))
        .to_owned();

    crate::db::execute(&pool, &stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true })))
}

#[utoipa::path(
    get,
    path = "/users/{id}/activity",
    params(
        ("id" = i64, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "Get user activity")
    ),
    security(("bearerAuth" = []))
)]
async fn get_user_activity(
    Path(id_str): Path<String>,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // 사용자별 활동 집계. 모든 질의는 SeaQuery 로 조립해 엔진별 방언을 자동 처리합니다.
    let count_where = |table: &'static str, column: &'static str| {
        SeaQuery::select()
            .expr(Func::count(Expr::col("id")))
            .from(table)
            .and_where(Expr::col(column).eq(id))
            .to_owned()
    };

    let assigned_issues: i64 = crate::db::fetch_scalar(&pool, &count_where("issues", "assigned_to_id"))
        .await
        .unwrap_or(0);

    let created_issues: i64 = crate::db::fetch_scalar(&pool, &count_where("issues", "author_id"))
        .await
        .unwrap_or(0);

    let projects_count: i64 =
        crate::db::fetch_scalar(&pool, &count_where("project_members", "user_id"))
            .await
            .unwrap_or(0);

    let last_activity: Option<String> = crate::db::fetch_scalar_optional(
        &pool,
        &SeaQuery::select()
            .column("created_at")
            .from("activity_logs")
            .and_where(Expr::col("user_id").eq(id))
            .order_by("created_at", Order::Desc)
            .limit(1)
            .to_owned(),
    )
    .await
    .unwrap_or(None);

    Ok(Json(json!({
        "success": true,
        "data": {
            "assigned_issues": assigned_issues,
            "created_issues": created_issues,
            "projects_count": projects_count,
            "last_activity": last_activity
        }
    })))
}
