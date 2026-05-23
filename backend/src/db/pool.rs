//! 커넥션 풀 생성과 엔진별 보조 질의.

use sqlx::{any::AnyPoolOptions, AnyPool};
use std::env;

const MAX_CONNECTIONS: u32 = 5;

/// `database_url` 로 커넥션 풀을 만듭니다. 환경변수 `DATABASE_URL` 이 있으면 우선합니다.
pub async fn init_pool(database_url: &str) -> AnyPool {
    sqlx::any::install_default_drivers();
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| database_url.to_string());
    let database_url = normalize_url(&database_url);

    if let Some(path) = sqlite_file_path(&database_url) {
        if let Some(parent) = std::path::Path::new(path).parent() {
            if !parent.exists() {
                let _ = std::fs::create_dir_all(parent);
            }
        }
    }

    AnyPoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect(&database_url)
        .await
        .expect("Failed to create pool")
}

/// SQLite 파일 URL 에 `mode=rwc` 를 붙여 파일이 없으면 생성되도록 합니다.
fn normalize_url(database_url: &str) -> String {
    if !database_url.starts_with("sqlite:") || database_url.contains("mode=") {
        return database_url.to_string();
    }
    let separator = if database_url.contains('?') { '&' } else { '?' };
    format!("{database_url}{separator}mode=rwc")
}

/// `sqlite://<path>?<query>` 에서 파일 경로만 뽑아냅니다.
fn sqlite_file_path(database_url: &str) -> Option<&str> {
    database_url
        .strip_prefix("sqlite://")
        .and_then(|rest| rest.split('?').next())
        .filter(|path| !path.is_empty())
}

/// INSERT 후 삽입된 행의 id 를 반환합니다.
///


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appends_rwc_mode_to_sqlite_urls() {
        assert_eq!(normalize_url("sqlite://./data/pms.db"), "sqlite://./data/pms.db?mode=rwc");
        assert_eq!(
            normalize_url("sqlite://./data/pms.db?cache=shared"),
            "sqlite://./data/pms.db?cache=shared&mode=rwc"
        );
    }

    #[test]
    fn leaves_existing_mode_and_other_engines_untouched() {
        assert_eq!(normalize_url("sqlite://./x.db?mode=ro"), "sqlite://./x.db?mode=ro");
        let pg = "postgres://u:p@localhost:5432/db";
        assert_eq!(normalize_url(pg), pg);
    }

    #[test]
    fn extracts_sqlite_file_path() {
        assert_eq!(sqlite_file_path("sqlite://./data/pms.db?mode=rwc"), Some("./data/pms.db"));
        assert_eq!(sqlite_file_path("postgres://u:p@h/db"), None);
        assert_eq!(sqlite_file_path("sqlite://?mode=rwc"), None);
    }
}
