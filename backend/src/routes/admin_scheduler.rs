use axum::{
    extract::Extension,
    http::StatusCode,
    response::Json,
    routing::{get, put, post},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::scheduler::{resolve_task_id, SchedulerHandle};

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/admin/scheduler", get(get_status))
            .route("/admin/scheduler", put(update_scheduler))
            .route("/admin/scheduler/run", post(run_task)),
    )
}

// ---------------------------------------------------------------------------
// GET /admin/scheduler — 모든 작업 상태 조회
// ---------------------------------------------------------------------------

async fn get_status(
    user: AuthUser,
    Extension(scheduler): Extension<Arc<SchedulerHandle>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    let status = scheduler.status().await;
    Ok(Json(json!({ "success": true, "data": status })))
}

// ---------------------------------------------------------------------------
// PUT /admin/scheduler — 작업별 제어
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SchedulerUpdatePayload {
    /// Task ID (string like "reserved_send" or numeric index like "0").
    task_id: String,
    #[serde(default)]
    running: Option<bool>,
    /// Cron expression in "초 분 시 일 월" format.
    #[serde(default)]
    cron_expression: Option<String>,
}

async fn update_scheduler(
    user: AuthUser,
    Extension(scheduler): Extension<Arc<SchedulerHandle>>,
    Json(payload): Json<SchedulerUpdatePayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    let task_idx = match resolve_task_id(&payload.task_id) {
        Ok(idx) => idx,
        Err(e) => return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": e})))),
    };

    if let Some(running) = payload.running {
        if let Err(e) = scheduler.set_task_running(task_idx, running).await {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"success": false, "error": e})),
            ));
        }
    }

    if let Some(ref cron) = payload.cron_expression {
        if let Err(e) = scheduler.set_task_cron(task_idx, cron).await {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"success": false, "error": e})),
            ));
        }
    }

    let status = scheduler.status().await;
    Ok(Json(json!({ "success": true, "data": status })))
}

// ---------------------------------------------------------------------------
// POST /admin/scheduler/run — 강제 실행
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SchedulerRunPayload {
    task_id: String,
}

async fn run_task(
    user: AuthUser,
    Extension(scheduler): Extension<Arc<SchedulerHandle>>,
    Json(payload): Json<SchedulerRunPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    let task_idx = match resolve_task_id(&payload.task_id) {
        Ok(idx) => idx,
        Err(e) => return Err((StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": e})))),
    };

    if let Err(e) = scheduler.run_task(task_idx).await {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"success": false, "error": e})),
        ));
    }

    let status = scheduler.status().await;
    Ok(Json(json!({ "success": true, "data": status })))
}
