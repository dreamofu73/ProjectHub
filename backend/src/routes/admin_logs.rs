use axum::{
    extract::{Extension, Path, Query},
    http::StatusCode,
    response::Json,
    routing::{get, put},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::models::AppConfig;
use crate::log_level::LogLevelControl;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/admin/logs/files", get(list_log_files))
            .route("/admin/logs/files/:filename", get(get_log_file))
            .route("/admin/logs/search", get(search_logs))
            .route("/admin/logs/tail", get(tail_log))
            .route("/admin/logs/config", get(get_log_config))
            .route("/admin/logs/config", put(update_log_config))
            .route("/admin/logs/level", get(get_log_level))
            .route("/admin/logs/level", put(set_log_level)),
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Validate that a filename is a safe log file name.
fn is_safe_log_filename(name: &str) -> bool {
    if name == "pms.log" {
        return true;
    }
    if let Some(suffix) = name.strip_prefix("pms.log.") {
        return !suffix.is_empty() && suffix.chars().all(|c| c.is_ascii_digit());
    }
    false
}

fn rfc3339(t: std::time::SystemTime) -> String {
    let dt: chrono::DateTime<chrono::Utc> = t.into();
    dt.to_rfc3339()
}

fn file_size(path: &std::path::Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

// ---------------------------------------------------------------------------
// GET /admin/logs/files — list log files
// ---------------------------------------------------------------------------

async fn list_log_files(
    user: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    let log_dir = std::path::Path::new("./logs");
    let mut files: Vec<Value> = Vec::new();

    if log_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(log_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };
                if !is_safe_log_filename(&name) {
                    continue;
                }
                let meta = match std::fs::metadata(&path) {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let modified = meta
                    .modified()
                    .map(rfc3339)
                    .unwrap_or_default();
                files.push(json!({
                    "name": name,
                    "size": meta.len(),
                    "modified": modified,
                }));
            }
        }
    }

    // Sort by modified descending
    files.sort_by(|a, b| {
        let a_ts = a["modified"].as_str().unwrap_or("");
        let b_ts = b["modified"].as_str().unwrap_or("");
        b_ts.cmp(a_ts)
    });

    Ok(Json(json!({ "success": true, "data": files })))
}

// ---------------------------------------------------------------------------
// GET /admin/logs/files/:filename — get file content
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct GetFileParams {
    lines: Option<i64>,
}

async fn get_log_file(
    user: AuthUser,
    Path(filename): Path<String>,
    Query(params): Query<GetFileParams>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    if !is_safe_log_filename(&filename) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"success": false, "error": "유효하지 않은 로그 파일 이름입니다."})),
        ));
    }

    let path = std::path::Path::new("./logs").join(&filename);
    if !path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"success": false, "error": "파일을 찾을 수 없습니다."})),
        ));
    }

    let content = match std::fs::read(&path).map(|b| String::from_utf8_lossy(&b).into_owned()) {
        Ok(c) => c,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"success": false, "error": format!("파일 읽기 오류: {e}")})),
            ));
        }
    };

    let total_lines = content.lines().count() as i64;

    let display_content = if params.lines.unwrap_or(0) > 0 {
        let take = params.lines.unwrap_or(0).min(total_lines) as usize;
        content.lines().rev().take(take).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n")
    } else {
        content
    };

    Ok(Json(json!({
        "success": true,
        "data": {
            "name": filename,
            "content": display_content,
            "total_lines": total_lines,
        }
    })))
}

// ---------------------------------------------------------------------------
// GET /admin/logs/search — search log files
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SearchParams {
    q: String,
    file: Option<String>,
}

async fn search_logs(
    user: AuthUser,
    Query(params): Query<SearchParams>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    if params.q.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"success": false, "error": "검색어를 입력하세요."})),
        ));
    }

    let query_lower = params.q.to_lowercase();
    let log_dir = std::path::Path::new("./logs");
    let mut results: Vec<Value> = Vec::new();

    if !log_dir.exists() {
        return Ok(Json(json!({ "success": true, "data": results })));
    }

    // Collect files to search
    let mut files: Vec<String> = Vec::new();
    if let Some(ref fname) = params.file {
        if is_safe_log_filename(fname) {
            files.push(fname.clone());
        }
    } else if let Ok(entries) = std::fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if is_safe_log_filename(name) {
                    files.push(name.to_string());
                }
            }
        }
        // Most recent first
        files.sort_by(|a, b| {
            let a_path = log_dir.join(a);
            let b_path = log_dir.join(b);
            let a_m = std::fs::metadata(&a_path).ok().and_then(|m| m.modified().ok());
            let b_m = std::fs::metadata(&b_path).ok().and_then(|m| m.modified().ok());
            b_m.cmp(&a_m)
        });
    }

    'outer: for fname in &files {
        let path = log_dir.join(fname);
        let content = match std::fs::read(&path).map(|b| String::from_utf8_lossy(&b).into_owned()) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for (line_no, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&query_lower) {
                results.push(json!({
                    "file": fname,
                    "line": (line_no + 1) as i64,
                    "content": line,
                }));
                if results.len() >= 500 {
                    break 'outer;
                }
            }
        }
    }

    Ok(Json(json!({ "success": true, "data": results })))
}

// ---------------------------------------------------------------------------
// GET /admin/logs/tail — polling tail endpoint
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct TailParams {
    offset: Option<u64>,
}

async fn tail_log(
    user: AuthUser,
    Query(params): Query<TailParams>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    let offset = params.offset.unwrap_or(0);
    let path = std::path::Path::new("./logs/pms.log");

    let file_size = file_size(path);
    if file_size == 0 {
        return Ok(Json(json!({
            "success": true,
            "data": {
                "content": "",
                "new_offset": 0,
                "file_size": 0,
            }
        })));
    }

    // If offset is beyond file size, it means the file was rotated
    let read_offset = if offset > file_size { 0 } else { offset };

    if read_offset == file_size {
        return Ok(Json(json!({
            "success": true,
            "data": {
                "content": "",
                "new_offset": file_size,
                "file_size": file_size,
            }
        })));
    }

    let content = match std::fs::File::open(path) {
        Ok(mut file) => {
            use std::io::{Read, Seek, SeekFrom};
            if file.seek(SeekFrom::Start(read_offset)).is_ok() {
                let mut buffer = Vec::new();
                if file.read_to_end(&mut buffer).is_ok() {
                    String::from_utf8_lossy(&buffer).into_owned()
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        }
        Err(_) => String::new(),
    };

    Ok(Json(json!({
        "success": true,
        "data": {
            "content": content,
            "new_offset": file_size,
            "file_size": file_size,
        }
    })))
}

// ---------------------------------------------------------------------------
// GET /admin/logs/config — get log config
// ---------------------------------------------------------------------------

async fn get_log_config(
    user: AuthUser,
    Extension(config): Extension<Arc<AppConfig>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "max_size_mb": config.log_max_size_mb,
            "max_files": config.log_max_files,
            "retention_days": config.log_retention_days,
        }
    })))
}

// ---------------------------------------------------------------------------
// PUT /admin/logs/config — update log config
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct LogConfigPayload {
    max_size_mb: Option<u64>,
    max_files: Option<usize>,
    retention_days: Option<u64>,
}

async fn update_log_config(
    user: AuthUser,
    Json(payload): Json<LogConfigPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    // Read current config.toml
    let config_str = match std::fs::read("config.toml").map(|b| String::from_utf8_lossy(&b).into_owned()) {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"success": false, "error": format!("설정 파일 읽기 오류: {e}")})),
            ));
        }
    };

    let mut toml_val: toml::Value = match toml::from_str(&config_str) {
        Ok(v) => v,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"success": false, "error": format!("설정 파일 파싱 오류: {e}")})),
            ));
        }
    };

    // Update fields under [default]
    if let Some(table) = toml_val.get_mut("default").and_then(|v| v.as_table_mut()) {
        if let Some(v) = payload.max_size_mb {
            table.insert("log_max_size_mb".to_string(), toml::Value::Integer(v as i64));
        }
        if let Some(v) = payload.max_files {
            table.insert("log_max_files".to_string(), toml::Value::Integer(v as i64));
        }
        if let Some(v) = payload.retention_days {
            table.insert("log_retention_days".to_string(), toml::Value::Integer(v as i64));
        }
    }

    // Write back
    let new_config_str = match toml::to_string_pretty(&toml_val) {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"success": false, "error": format!("설정 파일 직렬화 오류: {e}")})),
            ));
        }
    };

    if let Err(e) = std::fs::write("config.toml", new_config_str) {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"success": false, "error": format!("설정 파일 쓰기 오류: {e}")})),
        ));
    }

    // Return updated values (read from what we set + defaults from current config)
    let default_table = toml_val.get("default").and_then(|v| v.as_table());
    let get_int = |key: &str, def: i64| -> i64 {
        default_table
            .and_then(|t| t.get(key))
            .and_then(|v| v.as_integer())
            .unwrap_or(def)
    };

    Ok(Json(json!({
        "success": true,
        "data": {
            "max_size_mb": get_int("log_max_size_mb", 10),
            "max_files": get_int("log_max_files", 5),
            "retention_days": get_int("log_retention_days", 30),
        }
    })))
}

// ---------------------------------------------------------------------------
// GET /admin/logs/level — get current log level
// ---------------------------------------------------------------------------

async fn get_log_level(
    user: AuthUser,
    Extension(ctrl): Extension<Arc<LogLevelControl>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    let level = ctrl.get().await;
    Ok(Json(json!({ "success": true, "data": { "level": level } })))
}

// ---------------------------------------------------------------------------
// PUT /admin/logs/level — set log level at runtime
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SetLevelPayload {
    level: String,
}

async fn set_log_level(
    user: AuthUser,
    Extension(ctrl): Extension<Arc<LogLevelControl>>,
    Json(payload): Json<SetLevelPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"success": false, "error": "관리자만 가능합니다."})),
        ));
    }

    ctrl.set(&payload.level).await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"success": false, "error": e})),
        )
    })?;

    let level = ctrl.get().await;
    tracing::info!(target: "backend::admin", "Log level changed to {level}");
    Ok(Json(json!({ "success": true, "data": { "level": level } })))
}
