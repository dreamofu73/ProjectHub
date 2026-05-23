//! SeaQuery 문장을 런타임에 결정된 방언으로 직렬화합니다.
//!
//! 방언 분기는 이 모듈 한 곳으로 모읍니다. 호출부는 어떤 DBMS 에 연결되어 있는지
//! 알 필요 없이 SeaQuery 문장만 조립하면 됩니다.

use sea_query::{
    ColumnDef, MysqlQueryBuilder, PostgresQueryBuilder, QueryStatementWriter,
    SchemaStatementBuilder, SqliteQueryBuilder, Values,
};

use super::DbKind;

/// SELECT/INSERT/UPDATE/DELETE 문을 `(SQL, 파라미터)` 로 직렬화합니다.
///
/// 플레이스홀더는 방언에 맞게 생성됩니다 (Postgres `$1`, MySQL·SQLite `?`).
pub fn build_query<S: QueryStatementWriter>(stmt: &S, kind: DbKind) -> (String, Values) {
    match kind {
        DbKind::Postgres => stmt.build(PostgresQueryBuilder),
        DbKind::MySql | DbKind::MariaDb => stmt.build(MysqlQueryBuilder),
        DbKind::Sqlite => stmt.build(SqliteQueryBuilder),
    }
}

/// CREATE TABLE / CREATE INDEX / ALTER TABLE 등 스키마 문을 SQL 문자열로 직렬화합니다.
pub fn build_schema<S: SchemaStatementBuilder>(stmt: &S, kind: DbKind) -> String {
    match kind {
        DbKind::Postgres => stmt.build(PostgresQueryBuilder),
        DbKind::MySql | DbKind::MariaDb => stmt.build(MysqlQueryBuilder),
        DbKind::Sqlite => stmt.build(SqliteQueryBuilder),
    }
}

/// 기본키 컬럼 정의.
///
/// ID 는 애플리케이션에서 Sonyflake 63비트 정수로 생성하므로 DB 자동 증가를 쓰지 않고,
/// INSERT 시 명시적으로 값을 넣습니다([`super::new_id`]).
///
/// SQLite 는 `INTEGER PRIMARY KEY` 가 rowid 별칭이라 저장·조회가 가장 효율적이므로
/// SQLite 에서만 `integer` 를, 나머지 엔진에서는 `bigint` 를 씁니다. SQLite 의 `INTEGER`
/// 는 내부적으로 64비트라 Sonyflake 값 범위 손실이 없습니다.
pub fn auto_pk(name: &str, kind: DbKind) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    if kind == DbKind::Sqlite {
        col.integer();
    } else {
        col.big_integer();
    }
    col.not_null().primary_key();
    col
}

/// 인덱스(PK·UNIQUE)에 쓰이는 문자열 컬럼 정의.
///
/// MySQL·MariaDB 는 길이가 지정되지 않은 `TEXT` 컬럼을 키에 사용할 수 없습니다
/// (ERROR 1170: BLOB/TEXT column used in key specification without a key length).
/// 모든 엔진에서 `varchar(255)` 로 통일해 스키마가 갈라지지 않게 합니다.
pub fn key_string(name: &str) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    col.string_len(255);
    col
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_query::{Expr, ExprTrait, Query, Table};

    #[test]
    fn builds_dialect_specific_placeholders() {
        let stmt = Query::select()
            .column("id")
            .from("users")
            .and_where(Expr::col("login").eq("admin"))
            .to_owned();

        let (pg, _) = build_query(&stmt, DbKind::Postgres);
        assert!(pg.contains("$1"), "Postgres 는 번호 플레이스홀더를 써야 합니다: {pg}");

        let (my, _) = build_query(&stmt, DbKind::MySql);
        assert!(my.contains('?'), "MySQL 은 ? 플레이스홀더를 써야 합니다: {my}");

        let (maria, _) = build_query(&stmt, DbKind::MariaDb);
        assert_eq!(my, maria, "MariaDB 는 MySQL 과 동일한 SQL 을 생성해야 합니다");

        let (lite, _) = build_query(&stmt, DbKind::Sqlite);
        assert!(lite.contains('?'), "SQLite 는 ? 플레이스홀더를 써야 합니다: {lite}");
    }

    #[test]
    fn auto_pk_uses_integer_only_on_sqlite() {
        let ddl = |kind: DbKind| {
            build_schema(
                &Table::create()
                    .table("t")
                    .if_not_exists()
                    .col(auto_pk("id", kind))
                    .to_owned(),
                kind,
            )
        };

        // SQLite 는 AUTOINCREMENT 가 INTEGER 기본키에만 허용된다.
        let lite = ddl(DbKind::Sqlite);
        assert!(lite.contains("integer"), "{lite}");
        assert!(!lite.contains("bigint"), "{lite}");

        assert!(ddl(DbKind::MySql).contains("bigint"));
        assert!(ddl(DbKind::Postgres).contains("bigint"));
        assert_eq!(ddl(DbKind::MySql), ddl(DbKind::MariaDb));
    }

    /// 중복 무시 INSERT 는 방언마다 구문이 다릅니다.
    /// PostgreSQL·SQLite 는 `ON CONFLICT DO NOTHING`, MySQL·MariaDB 는
    /// `ON DUPLICATE KEY UPDATE` 를 써야 하며, `ON CONFLICT` 는 문법 오류입니다.
    #[test]
    fn insert_ignore_uses_dialect_specific_upsert() {
        use sea_query::OnConflict;

        let stmt = Query::insert()
            .into_table("chat_room_members")
            .columns(["room_id", "user_id"])
            .values_panic([1i64.into(), 2i64.into()])
            .on_conflict(OnConflict::columns(["room_id", "user_id"]).do_nothing().to_owned())
            .to_owned();

        let (pg, _) = build_query(&stmt, DbKind::Postgres);
        assert!(pg.contains("ON CONFLICT"), "{pg}");
        assert!(pg.contains("DO NOTHING"), "{pg}");

        let (lite, _) = build_query(&stmt, DbKind::Sqlite);
        assert!(lite.contains("ON CONFLICT"), "{lite}");

        let (my, _) = build_query(&stmt, DbKind::MySql);
        assert!(!my.contains("ON CONFLICT"), "MySQL 은 ON CONFLICT 를 지원하지 않습니다: {my}");
        assert!(my.contains("ON DUPLICATE KEY"), "{my}");

        let (maria, _) = build_query(&stmt, DbKind::MariaDb);
        assert_eq!(my, maria);
    }

    #[test]
    fn key_string_is_bounded_for_mysql_indexes() {
        let ddl = build_schema(
            &Table::create()
                .table("t")
                .if_not_exists()
                .col(key_string("id").not_null().primary_key())
                .to_owned(),
            DbKind::MySql,
        );
        assert!(ddl.contains("varchar(255)"), "{ddl}");
    }
}
