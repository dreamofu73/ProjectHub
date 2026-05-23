use axum::{
    extract::Extension,
    response::Json,
    http::StatusCode,
    routing::{post},
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Expr, ExprTrait, Query as SeaQuery};
use uuid::Uuid;
use crate::models::{RegisterRequest, LoginRequest};

pub fn router() -> crate::routes::PublicRoutes {
    crate::routes::PublicRoutes::from_router(
        Router::new()
            .route("/auth/register", post(register))
            .route("/auth/login", post(login)),
    )
}

#[utoipa::path(
    post,
    path = "/auth/register",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "User registered successfully"),
        (status = 400, description = "Bad request"),
        (status = 409, description = "User already exists")
    )
)]
async fn register(
    Extension(pool): Extension<Arc<AnyPool>>,
    axum::Json(user_data): axum::Json<RegisterRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let login = user_data.login;
    let email = user_data.email;
    let password = user_data.password;
    let firstname = user_data.firstname.unwrap_or_default();
    let lastname = user_data.lastname.unwrap_or_default();

    let existing_stmt = SeaQuery::select()
        .column("id")
        .from("users")
        .and_where(Expr::col("login").eq(login.clone()).or(Expr::col("email").eq(email.clone())))
        .to_owned();

    let existing = crate::db::fetch_optional(&pool, &existing_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if existing.is_some() {
        return Err((StatusCode::CONFLICT, Json(json!({"success": false, "error": "User already exists"}))));
    }

    let uuid = Uuid::new_v4().to_string();
    let password_hash = crate::auth::hash_password(&password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": format!("password hash failed: {}", e)}))))?;

    let now = crate::db::now_string();
    let insert_stmt = SeaQuery::insert()
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
            "created_at",
            "updated_at",
        ])
        .values_panic([
            crate::db::new_id().into(),
            uuid.clone().into(),
            login.into(),
            email.into(),
            password_hash.into(),
            firstname.into(),
            lastname.into(),
            "user".into(),
            now.clone().into(),
            now.into(),
        ])
        .to_owned();

    crate::db::execute(&pool, &insert_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    Ok(Json(json!({ "success": true, "uuid": uuid })))
}

#[utoipa::path(
    post,
    path = "/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "User logged in successfully"),
        (status = 401, description = "Invalid credentials")
    )
)]
async fn login(
    Extension(pool): Extension<Arc<AnyPool>>,
    Extension(config): Extension<Arc<crate::models::AppConfig>>,
    axum::Json(credentials): axum::Json<LoginRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let identifier = credentials.login;
    let password = credentials.password;

    // 사용자는 login 또는 email 어느 쪽이든 입력할 수 있으므로 동일 값을 두 컬럼 모두에 매칭한다.
    let user_stmt = SeaQuery::select()
        .columns(["id", "login", "role", "password_hash"])
        .from("users")
        .and_where(
            Expr::col("login")
                .eq(identifier.clone())
                .or(Expr::col("email").eq(identifier.clone())),
        )
        .to_owned();

    let user = crate::db::fetch_optional(&pool, &user_stmt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

    if let Some(u) = user {
        let id = u.get::<i64, _>("id");
        let role = u.get::<String, _>("role");
        let stored: String = u.get("password_hash");

        let mut authenticated = false;
        if crate::auth::is_hashed(&stored) {
            authenticated = crate::auth::verify_password(&password, &stored);
        } else if stored == password {
            authenticated = true;
            if let Ok(new_hash) = crate::auth::hash_password(&password) {
                let rehash_stmt = SeaQuery::update()
                    .table("users")
                    .value("password_hash", new_hash)
                    .and_where(Expr::col("id").eq(id))
                    .to_owned();
                crate::db::execute_ignore(&pool, &rehash_stmt).await;
            }
        }

        if authenticated {
            let token = crate::auth::create_jwt(id, &role, &config.jwt_secret).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;
            return Ok(Json(json!({
                "success": true,
                "token": token,
                "user": {
                    "id": id.to_string(),
                    "login": u.get::<String, _>("login"),
                    "role": role
                }
            })));
        }
        Err((StatusCode::UNAUTHORIZED, Json(json!({"success": false, "error": "Invalid credentials"}))))
    } else {
        if let (Some(admin_user), Some(admin_pass)) = (&config.admin_username, &config.admin_password) {
            if identifier == *admin_user && password == *admin_pass {
                let token = match crate::auth::create_jwt(1, "admin", &config.jwt_secret) {
                    Ok(t) => t,
                    Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))                    
                };
                return Ok(Json(json!({
                    "success": true,
                    "token": token,
                    "user": { "id": "1", "login": admin_user, "role": "admin" }
                })));
            }
        }
        Err((StatusCode::UNAUTHORIZED, Json(json!({"success": false, "error": "Invalid credentials"}))))
    }
}
