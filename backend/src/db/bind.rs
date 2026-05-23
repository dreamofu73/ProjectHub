//! SeaQuery 파라미터(`sea_query::Values`)를 sqlx `Any` 드라이버 바인딩으로 옮기는 브리지.
//!
//! `sea-query-binder` 는 sqlx 0.8 및 드라이버별 전용 풀(`PgPool` 등)만 지원합니다.
//! 이 프로젝트는 sqlx 0.9 + `AnyPool` 로 단일 바이너리에서 여러 DBMS 를 다루므로
//! 바인딩 계층을 직접 구현합니다.
//!
//! sqlx 의 `Any` 드라이버가 인코딩할 수 있는 타입은
//! `bool / i16 / i32 / i64 / f32 / f64 / String / Vec<u8>` 뿐이므로,
//! 그보다 좁거나 부호 없는 SeaQuery 값은 손실 없이 확장해 바인딩합니다.

use sea_query::{QueryStatementWriter, SchemaStatementBuilder, Value as SeaValue, Values};
use sqlx::any::{AnyArguments, AnyQueryResult, AnyRow};
use sqlx::{Any, AnyPool, FromRow};

use super::{build_query, build_schema, get_kind};

type AnyQuery<'q> = sqlx::query::Query<'q, Any, AnyArguments>;
type AnyQueryAs<'q, T> = sqlx::query::QueryAs<'q, Any, T, AnyArguments>;
type AnyQueryScalar<'q, T> = sqlx::query::QueryScalar<'q, Any, T, AnyArguments>;

/// SeaQuery 값들을 sqlx 쿼리에 순서대로 바인딩합니다.
///
/// `Query` / `QueryAs` / `QueryScalar` 는 공통 트레이트를 공유하지 않으므로
/// 매크로로 세 타입 모두를 커버합니다. 호출 함수는 `Result<_, sqlx::Error>` 를 반환해야 합니다.
macro_rules! bind_values {
    ($query:expr, $values:expr) => {{
        let mut q = $query;
        for value in $values {
            q = match value {
                SeaValue::Bool(v) => q.bind(v),
                SeaValue::TinyInt(v) => q.bind(v.map(i32::from)),
                SeaValue::SmallInt(v) => q.bind(v),
                SeaValue::Int(v) => q.bind(v),
                SeaValue::BigInt(v) => q.bind(v),
                SeaValue::TinyUnsigned(v) => q.bind(v.map(i32::from)),
                SeaValue::SmallUnsigned(v) => q.bind(v.map(i32::from)),
                SeaValue::Unsigned(v) => q.bind(v.map(i64::from)),
                SeaValue::BigUnsigned(v) => q.bind(v.map(|n| n as i64)),
                SeaValue::Float(v) => q.bind(v),
                SeaValue::Double(v) => q.bind(v),
                SeaValue::String(v) => q.bind(v.map(|s| s.to_string())),
                SeaValue::Char(v) => q.bind(v.map(|c| c.to_string())),
                SeaValue::Bytes(v) => q.bind(v.map(|b| b.to_vec())),
                other => {
                    return Err(sqlx::Error::Protocol(format!(
                        "sqlx Any 드라이버가 지원하지 않는 SeaQuery 파라미터 타입입니다: {other:?}"
                    )))
                }
            };
        }
        q
    }};
}

fn prepare<S: QueryStatementWriter>(pool: &AnyPool, stmt: &S) -> (String, Values) {
    build_query(stmt, get_kind(pool))
}

/// SeaQuery 문장을 바인딩까지 끝난 sqlx 쿼리로 변환합니다.
///
/// 풀이 아닌 임의의 executor(트랜잭션 등)에서 실행해야 할 때 사용합니다.
/// 반환값에 `.execute(&mut *tx)` 등을 이어서 호출하십시오.
pub fn to_query<S: QueryStatementWriter>(
    stmt: &S,
    kind: super::DbKind,
) -> Result<AnyQuery<'static>, sqlx::Error> {
    let (sql, values) = build_query(stmt, kind);
    Ok(bind_values!(sqlx::query(sqlx::AssertSqlSafe(sql)), values))
}

/// [`to_query`] 의 스칼라 조회 버전.
pub fn to_query_scalar<T, S: QueryStatementWriter>(
    stmt: &S,
    kind: super::DbKind,
) -> Result<AnyQueryScalar<'static, T>, sqlx::Error>
where
    (T,): for<'r> FromRow<'r, AnyRow>,
{
    let (sql, values) = build_query(stmt, kind);
    Ok(bind_values!(sqlx::query_scalar(sqlx::AssertSqlSafe(sql)), values))
}

/// INSERT/UPDATE/DELETE 문을 실행합니다.
pub async fn execute<S: QueryStatementWriter>(
    pool: &AnyPool,
    stmt: &S,
) -> Result<AnyQueryResult, sqlx::Error> {
    let (sql, values) = prepare(pool, stmt);
    let query: AnyQuery<'_> = bind_values!(sqlx::query(sqlx::AssertSqlSafe(sql)), values);
    query.execute(pool).await
}

/// 실행하되 오류를 무시합니다. 이미 적용된 idempotent 마이그레이션 등에 사용합니다.
pub async fn execute_ignore<S: QueryStatementWriter>(pool: &AnyPool, stmt: &S) {
    let _ = execute(pool, stmt).await;
}

/// 모든 행을 원시 `AnyRow` 로 조회합니다.
pub async fn fetch_all<S: QueryStatementWriter>(
    pool: &AnyPool,
    stmt: &S,
) -> Result<Vec<AnyRow>, sqlx::Error> {
    let (sql, values) = prepare(pool, stmt);
    let query: AnyQuery<'_> = bind_values!(sqlx::query(sqlx::AssertSqlSafe(sql)), values);
    query.fetch_all(pool).await
}

/// 첫 행을 원시 `AnyRow` 로 조회합니다. 행이 없으면 `None`.
pub async fn fetch_optional<S: QueryStatementWriter>(
    pool: &AnyPool,
    stmt: &S,
) -> Result<Option<AnyRow>, sqlx::Error> {
    let (sql, values) = prepare(pool, stmt);
    let query: AnyQuery<'_> = bind_values!(sqlx::query(sqlx::AssertSqlSafe(sql)), values);
    query.fetch_optional(pool).await
}

/// 모든 행을 `T` 로 매핑해 조회합니다.
pub async fn fetch_all_as<T, S>(pool: &AnyPool, stmt: &S) -> Result<Vec<T>, sqlx::Error>
where
    S: QueryStatementWriter,
    T: Send + Unpin + for<'r> FromRow<'r, AnyRow>,
{
    let (sql, values) = prepare(pool, stmt);
    let query: AnyQueryAs<'_, T> = bind_values!(sqlx::query_as(sqlx::AssertSqlSafe(sql)), values);
    query.fetch_all(pool).await
}

/// 첫 행을 `T` 로 매핑해 조회합니다. 행이 없으면 `None`.
pub async fn fetch_optional_as<T, S>(pool: &AnyPool, stmt: &S) -> Result<Option<T>, sqlx::Error>
where
    S: QueryStatementWriter,
    T: Send + Unpin + for<'r> FromRow<'r, AnyRow>,
{
    let (sql, values) = prepare(pool, stmt);
    let query: AnyQueryAs<'_, T> = bind_values!(sqlx::query_as(sqlx::AssertSqlSafe(sql)), values);
    query.fetch_optional(pool).await
}

/// 단일 컬럼 스칼라 값을 조회합니다 (`COUNT(*)` 등).
pub async fn fetch_scalar<T, S>(pool: &AnyPool, stmt: &S) -> Result<T, sqlx::Error>
where
    S: QueryStatementWriter,
    T: Send + Unpin,
    (T,): for<'r> FromRow<'r, AnyRow>,
{
    let (sql, values) = prepare(pool, stmt);
    let query: AnyQueryScalar<'_, T> =
        bind_values!(sqlx::query_scalar(sqlx::AssertSqlSafe(sql)), values);
    query.fetch_one(pool).await
}

/// 단일 컬럼 스칼라 값을 조회합니다. 행이 없으면 `None`.
pub async fn fetch_scalar_optional<T, S>(pool: &AnyPool, stmt: &S) -> Result<Option<T>, sqlx::Error>
where
    S: QueryStatementWriter,
    T: Send + Unpin,
    (T,): for<'r> FromRow<'r, AnyRow>,
{
    let (sql, values) = prepare(pool, stmt);
    let query: AnyQueryScalar<'_, T> =
        bind_values!(sqlx::query_scalar(sqlx::AssertSqlSafe(sql)), values);
    query.fetch_optional(pool).await
}

/// CREATE TABLE / CREATE INDEX / ALTER TABLE 등 스키마 문을 실행합니다.
pub async fn execute_schema<S: SchemaStatementBuilder>(
    pool: &AnyPool,
    stmt: &S,
) -> Result<AnyQueryResult, sqlx::Error> {
    let sql = build_schema(stmt, get_kind(pool));
    sqlx::query(sqlx::AssertSqlSafe(sql)).execute(pool).await
}

/// 스키마 문을 실행하되 오류를 무시합니다.
///
/// `ADD COLUMN` / `CREATE INDEX` 처럼 엔진에 따라 `IF NOT EXISTS` 를 지원하지 않아
/// "이미 존재함" 오류가 나는 idempotent 마이그레이션에 사용합니다.
pub async fn execute_schema_ignore<S: SchemaStatementBuilder>(pool: &AnyPool, stmt: &S) {
    let _ = execute_schema(pool, stmt).await;
}
