//! 연결 대상 DBMS 판별.

use sqlx::AnyPool;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DbKind {
    Postgres,
    MySql,
    /// MariaDB. SQL 방언은 MySQL과 동일하게 취급하며 URL 스킴(`mariadb://`)으로 구분합니다.
    MariaDb,
    Sqlite,
}

impl DbKind {
    /// MySQL 계열(MySQL·MariaDB) 여부. 두 엔진은 SQL 방언이 동일합니다.
    pub fn is_mysql_family(self) -> bool {
        matches!(self, DbKind::MySql | DbKind::MariaDb)
    }
}

/// 연결된 풀의 `database_url` 스킴으로 DBMS 종류를 판별합니다.
pub fn get_kind(pool: &AnyPool) -> DbKind {
    let options = pool.connect_options();
    let url = options.database_url.as_str();
    kind_from_url(url)
}

/// URL 스킴으로부터 [`DbKind`] 를 판별합니다.
/// - `postgres://`, `postgresql://` → Postgres
/// - `mariadb://` → MariaDb
/// - `mysql://` → MySql (MariaDB 서버를 `mysql://` 로 연결해도 방언이 같아 정상 동작합니다)
/// - 그 외 → Sqlite
pub fn kind_from_url(url: &str) -> DbKind {
    if url.starts_with("postgres") {
        DbKind::Postgres
    } else if url.starts_with("mariadb") {
        DbKind::MariaDb
    } else if url.starts_with("mysql") {
        DbKind::MySql
    } else {
        DbKind::Sqlite
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_mariadb_scheme() {
        assert_eq!(
            kind_from_url("mariadb://pms_user:pms_password@localhost:3306/pms_db"),
            DbKind::MariaDb
        );
    }

    #[test]
    fn detects_other_schemes() {
        assert_eq!(kind_from_url("mysql://u:p@localhost:3306/db"), DbKind::MySql);
        assert_eq!(kind_from_url("postgres://u:p@localhost:5432/db"), DbKind::Postgres);
        assert_eq!(kind_from_url("postgresql://u:p@localhost:5432/db"), DbKind::Postgres);
        assert_eq!(kind_from_url("sqlite://./data/project-hub.db"), DbKind::Sqlite);
    }

    #[test]
    fn mysql_family_covers_mariadb() {
        assert!(DbKind::MySql.is_mysql_family());
        assert!(DbKind::MariaDb.is_mysql_family());
        assert!(!DbKind::Postgres.is_mysql_family());
        assert!(!DbKind::Sqlite.is_mysql_family());
    }
}
