//! Background scheduler with per-task cron-based scheduling.
//!
//! Three tasks run independently:
//! - `reserved_send`  — 예약 발송 처리
//! - `expiry_warning` — 보관 만료 알림
//! - `auto_delete`    — 자동 삭제
//!
//! Each task has its own cron expression (초 분 시 일 월), start/stop state,
//! and execution statistics.

use chrono::{Datelike, Timelike};
use serde::Serialize;
use sqlx::{Row, AnyPool};
use sea_query::{Expr, ExprTrait, Query as SeaQuery};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Static task registry
// ---------------------------------------------------------------------------

/// Static task identifier constants.
pub const TASK_RESERVED_SEND: usize = 0;
pub const TASK_EXPIRY_WARNING: usize = 1;
pub const TASK_AUTO_DELETE: usize = 2;
pub const TASK_LOG_CLEANUP: usize = 3;
pub const TASK_COUNT: usize = 4;

static TASK_DEFS: [TaskDef; TASK_COUNT] = [
    TaskDef { id: "reserved_send",   name: "예약 발송 처리",  default_cron: "*/30 * * * *" },
    TaskDef { id: "expiry_warning",  name: "보관 만료 알림",  default_cron: "0 */1 * * *" },
    TaskDef { id: "auto_delete",     name: "자동 삭제",      default_cron: "0 */1 * * *" },
    TaskDef { id: "log_cleanup",     name: "로그 파일 정리",  default_cron: "0 0 3 * *" },
];

struct TaskDef {
    id: &'static str,
    name: &'static str,
    default_cron: &'static str,
}

/// Resolve a task identifier (string ID or numeric index) to a `usize` index.
/// Accepts both `"reserved_send"` and `"0"`.
pub fn resolve_task_id(raw: &str) -> Result<usize, String> {
    // Try numeric first
    if let Ok(idx) = raw.parse::<usize>() {
        if idx < TASK_COUNT {
            return Ok(idx);
        }
        return Err(format!("task_id는 0~{} 사이여야 합니다.", TASK_COUNT - 1));
    }
    // Try string ID lookup
    for (i, def) in TASK_DEFS.iter().enumerate() {
        if def.id == raw {
            return Ok(i);
        }
    }
    Err(format!(
        "Unknown task_id '{}'. Valid IDs: {}",
        raw,
        TASK_DEFS.iter().map(|d| d.id).collect::<Vec<_>>().join(", ")
    ))
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Serializable snapshot of a single task's status.
#[derive(Debug, Clone, Serialize)]
pub struct TaskStatus {
    pub id: &'static str,
    pub name: &'static str,
    pub running: bool,
    /// Whether the task is currently executing its work.
    pub processing: bool,
    pub cron_expression: String,
    pub last_run: Option<String>,
    pub last_run_affected: Option<i64>,
    pub total_processed: i64,
}

/// Serializable snapshot of the full scheduler.
#[derive(Debug, Clone, Serialize)]
pub struct SchedulerStatus {
    pub tasks: Vec<TaskStatus>,
}

/// Controllable handle (cheap to clone — shares `Arc` internally).
#[derive(Clone)]
pub struct SchedulerHandle {
    state: Arc<Mutex<SchedulerState>>,
}

struct SchedulerState {
    tasks: Vec<TaskState>,
    pool: AnyPool,
}

struct TaskState {
    running: bool,
    processing: bool,
    cron_expression: String,
    last_run: Option<String>,
    last_run_affected: Option<i64>,
    total_processed: i64,
}

impl SchedulerHandle {
    /// Snapshot the full scheduler status.
    pub async fn status(&self) -> SchedulerStatus {
        let s = self.state.lock().await;
        let tasks = s
            .tasks
            .iter()
            .enumerate()
            .map(|(i, ts)| TaskStatus {
                id: TASK_DEFS[i].id,
                name: TASK_DEFS[i].name,
                running: ts.running,
                processing: ts.processing,
                cron_expression: ts.cron_expression.clone(),
                last_run: ts.last_run.clone(),
                last_run_affected: ts.last_run_affected,
                total_processed: ts.total_processed,
            })
            .collect();
        SchedulerStatus { tasks }
    }

    /// Start / stop a specific task by index.
    pub async fn set_task_running(&self, idx: usize, running: bool) -> Result<(), &'static str> {
        if idx >= TASK_COUNT {
            return Err("invalid task index");
        }
        self.state.lock().await.tasks[idx].running = running;
        Ok(())
    }

    /// Update a task's cron expression.
    pub async fn set_task_cron(
        &self,
        idx: usize,
        expression: &str,
    ) -> Result<(), &'static str> {
        if idx >= TASK_COUNT {
            return Err("invalid task index");
        }
        if !CronExpr::validate(expression) {
            return Err("invalid cron expression — use format: 초 분 시 일 월");
        }
        self.state.lock().await.tasks[idx].cron_expression = expression.to_string();
        Ok(())
    }

    /// Manually trigger a task to run immediately.
    pub async fn run_task(&self, idx: usize) -> Result<(), &'static str> {
        if idx >= TASK_COUNT {
            return Err("invalid task index");
        }
        
        let now_rfc = chrono::Utc::now().to_rfc3339();

        // Mark as processing before execution
        self.state.lock().await.tasks[idx].processing = true;
        let task_name = TASK_DEFS[idx].name;
        let start = std::time::Instant::now();
        tracing::debug!("[스케줄러] {task_name} 강제 실행 시작");

        match idx {
            TASK_RESERVED_SEND => {
                process_reserved_send(&self.state, &now_rfc).await;
            }
            TASK_EXPIRY_WARNING => {
                process_expiry_warnings(&self.state, &now_rfc).await;
            }
            TASK_AUTO_DELETE => {
                process_auto_delete(&self.state, &now_rfc).await;
            }
            TASK_LOG_CLEANUP => {
                process_log_cleanup(&self.state).await;
            }
            _ => {}
        }

        let elapsed = start.elapsed();
        tracing::debug!("[스케줄러] {task_name} 강제 실행 종료 ({}ms)", elapsed.as_millis());
        self.state.lock().await.tasks[idx].processing = false;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Cron expression (5-field: 초 분 시 일 월)
// ---------------------------------------------------------------------------

struct CronExpr {
    second: String,
    minute: String,
    hour: String,
    day: String,
    month: String,
}

impl CronExpr {
    fn parse(expr: &str) -> Option<Self> {
        let parts: Vec<&str> = expr.split_whitespace().collect();
        if parts.len() != 5 {
            return None;
        }
        Some(CronExpr {
            second: parts[0].to_string(),
            minute: parts[1].to_string(),
            hour: parts[2].to_string(),
            day: parts[3].to_string(),
            month: parts[4].to_string(),
        })
    }

    /// Validate without allocating a full struct (used during API validation).
    fn validate(expr: &str) -> bool {
        Self::parse(expr).is_some()
            && expr
                .split_whitespace()
                .all(|f| f == "*" || f.starts_with("*/") || f.parse::<i32>().is_ok())
    }

    fn matches(&self, dt: &chrono::DateTime<chrono::Utc>) -> bool {
        fn matches_field(value: i32, pattern: &str) -> bool {
            if pattern == "*" {
                return true;
            }
            if let Some(n) = pattern.strip_prefix("*/") {
                if let Ok(step) = n.parse::<i32>() {
                    return step > 0 && value % step == 0;
                }
            }
            if let Ok(n) = pattern.parse::<i32>() {
                return value == n;
            }
            false
        }

        matches_field(dt.second() as i32, &self.second)
            && matches_field(dt.minute() as i32, &self.minute)
            && matches_field(dt.hour() as i32, &self.hour)
            && matches_field(dt.day() as i32, &self.day)
            && matches_field(dt.month() as i32, &self.month)
    }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/// Launch the background scheduler and return a handle.
///
/// Three tasks run independently on their own cron schedules.
pub fn start(pool: AnyPool) -> SchedulerHandle {
    let state = Arc::new(Mutex::new(SchedulerState {
        tasks: TASK_DEFS
            .iter()
            .map(|def| TaskState {
                running: true,
                processing: false,
                cron_expression: def.default_cron.to_string(),
                last_run: None,
                last_run_affected: None,
                total_processed: 0,
            })
            .collect(),
        pool,
    }));

    let handle = SchedulerHandle {
        state: state.clone(),
    };

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let now = chrono::Utc::now();

            // Snapshot which tasks should run this tick.
            let schedule: Vec<(bool, String)> = {
                let s = state.lock().await;
                s.tasks
                    .iter()
                    .map(|t| (t.running, t.cron_expression.clone()))
                    .collect()
            };

            for (idx, (running, cron_expr)) in schedule.into_iter().enumerate() {
                if !running {
                    continue;
                }

                let Some(cron) = CronExpr::parse(&cron_expr) else {
                    continue;
                };

                if !cron.matches(&now) {
                    continue;
                }

                let now_rfc = now.to_rfc3339();

                // Mark as processing before execution
                state.lock().await.tasks[idx].processing = true;
                let task_name = TASK_DEFS[idx].name;
                let start = std::time::Instant::now();
                tracing::debug!("[스케줄러] {task_name} 처리 시작");

                match idx {
                    TASK_RESERVED_SEND => {
                        process_reserved_send(&state, &now_rfc).await;
                    }
                    TASK_EXPIRY_WARNING => {
                        process_expiry_warnings(&state, &now_rfc).await;
                    }
                    TASK_AUTO_DELETE => {
                        process_auto_delete(&state, &now_rfc).await;
                    }
                    TASK_LOG_CLEANUP => {
                        process_log_cleanup(&state).await;
                    }
                    _ => {}
                }

                let elapsed = start.elapsed();
                tracing::debug!("[스케줄러] {task_name} 처리 종료 ({}ms)", elapsed.as_millis());
                state.lock().await.tasks[idx].processing = false;
            }
        }
    });

    handle
}

// ---------------------------------------------------------------------------
// Task implementations
// ---------------------------------------------------------------------------

/// 예약 발송: reserved_at 이전인 미발송 쪽지를 발송 처리
async fn process_reserved_send(state: &Arc<Mutex<SchedulerState>>, now: &str) {
    let pool = state.lock().await.pool.clone();
    let stmt = SeaQuery::update()
        .table("memos")
        .value("is_sent", 1i64)
        .value("created_at", now)
        .and_where(Expr::col("is_sent").eq(0i64))
        .and_where(Expr::col("reserved_at").lte(now))
        .to_owned();
    let res = crate::db::execute(&pool, &stmt).await;

    match res {
        Ok(result) => {
            let count = result.rows_affected() as i64;
            let mut s = state.lock().await;
            let t = &mut s.tasks[TASK_RESERVED_SEND];
            t.last_run = Some(now.to_string());
            t.last_run_affected = Some(count);
            t.total_processed += count;
            if count > 0 {
                tracing::info!("[스케줄러] 예약 발송 완료: {count}건");
            }
        }
        Err(e) => {
            tracing::error!("[스케줄러] 예약 발송 에러: {e}");
        }
    }
}

/// 보관 만료 3일 전 알림 생성
async fn process_expiry_warnings(state: &Arc<Mutex<SchedulerState>>, now: &str) {
    let pool = state.lock().await.pool.clone();

    let warning_time = match chrono::Utc::now().checked_add_signed(chrono::Duration::days(3)) {
        Some(t) => t.to_rfc3339(),
        None => return,
    };

    let stmt = SeaQuery::select()
        .columns(["id", "receiver_id", "title"])
        .from("memos")
        .and_where(Expr::col("is_read").eq(1i64))
        .and_where(Expr::col("is_archived").eq(0i64))
        .and_where(Expr::col("is_sent").eq(1i64))
        .and_where(Expr::col("expiry_notified").eq(0i64))
        .and_where(Expr::col("expires_at").is_not_null())
        .and_where(Expr::col("expires_at").lte(warning_time.clone()))
        .to_owned();
    let expired_memos = crate::db::fetch_all(&pool, &stmt).await;

    let rows = match expired_memos {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("[스케줄러] 만료 대기 쪽지 조회 에러: {e}");
            return;
        }
    };

    let affected = rows.len() as i64;

    for row in &rows {
        let memo_id: String = row.get("id");
        let receiver_id: i64 = row.get("receiver_id");
        let memo_title: String = row.get("title");

        let notif_id = uuid::Uuid::new_v4().to_string();
        let notif_title = "쪽지 보관 만료 임박 안내".to_string();
        let notif_msg = format!(
            "'{memo_title}' 쪽지가 3일 후 자동 삭제될 예정입니다. \
             기한을 연장하거나 보관함으로 이동해 주세요."
        );
        let notif_link = format!("/memos/{memo_id}");

        let notif_stmt = SeaQuery::insert()
            .into_table("notifications")
            .columns([
                "id", "user_id", "type", "title", "message", "link", "is_read", "created_at",
            ])
            .values_panic([
                notif_id.into(),
                receiver_id.into(),
                "memo_expiry".into(),
                notif_title.into(),
                notif_msg.into(),
                notif_link.into(),
                0i64.into(),
                now.into(),
            ])
            .to_owned();
        let notif_res = crate::db::execute(&pool, &notif_stmt).await;

        if notif_res.is_ok() {
            let mark_stmt = SeaQuery::update()
                .table("memos")
                .value("expiry_notified", 1i64)
                .and_where(Expr::col("id").eq(memo_id.clone()))
                .to_owned();
            crate::db::execute_ignore(&pool, &mark_stmt).await;
        }
    }

    let mut s = state.lock().await;
    let t = &mut s.tasks[TASK_EXPIRY_WARNING];
    t.last_run = Some((*now).to_string());
    t.last_run_affected = Some(affected);
    t.total_processed += affected;
    if affected > 0 {
        tracing::info!("[스케줄러] 만료 알림 생성 완료: {affected}건");
    }
}

/// 만료된 쪽지 자동 삭제
async fn process_auto_delete(state: &Arc<Mutex<SchedulerState>>, now: &str) {
    let pool = state.lock().await.pool.clone();

    let stmt = SeaQuery::delete()
        .from_table("memos")
        .and_where(Expr::col("is_read").eq(1i64))
        .and_where(Expr::col("is_archived").eq(0i64))
        .and_where(Expr::col("expires_at").is_not_null())
        .and_where(Expr::col("expires_at").lte(now))
        .to_owned();
    let res = crate::db::execute(&pool, &stmt).await;

    match res {
        Ok(result) => {
            let count = result.rows_affected() as i64;
            let mut s = state.lock().await;
            let t = &mut s.tasks[TASK_AUTO_DELETE];
            t.last_run = Some((*now).to_string());
            t.last_run_affected = Some(count);
            t.total_processed += count;
            if count > 0 {
                tracing::info!("[스케줄러] 만료 쪽지 삭제 완료: {count}건");
            }
        }
        Err(e) => {
            tracing::error!("[스케줄러] 만료 쪽지 삭제 에러: {e}");
        }
    }
}

/// 보관 기간이 지난 로그 파일 삭제
async fn process_log_cleanup(state: &Arc<Mutex<SchedulerState>>) {
    let config_str = match std::fs::read("config.toml").map(|b| String::from_utf8_lossy(&b).into_owned()) {
        Ok(s) => s,
        Err(_) => return,
    };

    let toml_val: toml::Value = match toml::from_str(&config_str) {
        Ok(v) => v,
        Err(_) => return,
    };

    let retention_days = toml_val
        .get("default")
        .and_then(|v| v.get("log_retention_days"))
        .and_then(|v| v.as_integer())
        .unwrap_or(30) as i64;

    let log_dir = std::path::Path::new("./logs");
    if !log_dir.exists() {
        return;
    }

    let now = chrono::Utc::now();
    let mut deleted_count = 0i64;

    let entries = match std::fs::read_dir(log_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // Only delete rotated log files: pms.log.1, pms.log.2, etc.
        if !file_name.starts_with("pms.log.") {
            continue;
        }
        let suffix = &file_name["pms.log.".len()..];
        if suffix.is_empty() || !suffix.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }

        let metadata = match std::fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        if let Ok(modified) = metadata.modified() {
            let modified_dt: chrono::DateTime<chrono::Utc> = modified.into();
            let age_days = (now - modified_dt).num_days();
            if age_days >= retention_days {
                if std::fs::remove_file(&path).is_ok() {
                    deleted_count += 1;
                    tracing::info!("[스케줄러] 오래된 로그 파일 삭제: {file_name}");
                }
            }
        }
    }

    let now_rfc = now.to_rfc3339();
    let mut s = state.lock().await;
    let t = &mut s.tasks[TASK_LOG_CLEANUP];
    t.last_run = Some(now_rfc);
    t.last_run_affected = Some(deleted_count);
    t.total_processed += deleted_count;
    if deleted_count > 0 {
        tracing::info!("[스케줄러] 로그 파일 정리 완료: {deleted_count}개 삭제");
    }
}
