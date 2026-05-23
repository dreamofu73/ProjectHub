use std::sync::Arc;
use tokio::sync::RwLock;
use tracing_subscriber::reload;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::Registry;

/// Controls the runtime log level via tracing-subscriber's reload mechanism.
/// Shared across the app via axum Extension.
#[derive(Clone)]
pub struct LogLevelControl {
    handle: reload::Handle<EnvFilter, Registry>,
    current: Arc<RwLock<String>>,
}

impl LogLevelControl {
    pub fn new(handle: reload::Handle<EnvFilter, Registry>) -> Self {
        Self {
            handle,
            current: Arc::new(RwLock::new("INFO".to_string())),
        }
    }

    /// Get the current log level.
    pub async fn get(&self) -> String {
        self.current.read().await.clone()
    }

    /// Set a new log level at runtime.
    /// Rebuilds EnvFilter from RUST_LOG env var (preserving it) and overrides with the new level.
    /// Valid levels: ERROR, WARN, INFO, DEBUG, TRACE.
    pub async fn set(&self, level: &str) -> Result<(), String> {
        let level = level.to_uppercase();
        match level.as_str() {
            "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE" => {}
            _ => return Err(format!("Invalid log level: {level}")),
        }

        let new_filter = EnvFilter::from_default_env()
            .add_directive(
                level.as_str().parse::<tracing_subscriber::filter::Directive>()
                    .map_err(|e| format!("Invalid directive: {e}"))?,
            );

        self.handle.reload(new_filter).map_err(|e| format!("Reload failed: {e}"))?;

        *self.current.write().await = level.clone();
        Ok(())
    }
}
