//! 멀티 DB 데이터 접근 계층.
//!
//! # 구조
//!
//! | 모듈 | 역할 |
//! |------|------|
//! | [`kind`] | `database_url` 스킴으로 연결 대상 DBMS 판별 |
//! | [`dialect`] | SeaQuery 문장을 방언별 SQL 로 직렬화 + DDL 헬퍼 |
//! | [`bind`] | SeaQuery 파라미터를 sqlx `Any` 바인딩으로 연결하고 실행 |
//! | [`schema`] | 스키마 마이그레이션 (전부 SeaQuery DDL) |
//! | [`seed`] | 초기 데이터 시딩 및 데이터 마이그레이션 |
//! | [`pool`] | 커넥션 풀 생성, 엔진별 보조 질의 |
//!
//! # 신규 쿼리 작성 방법
//!
//! ```ignore
//! use sea_query::{Expr, Query};
//!
//! let stmt = Query::select()
//!     .columns(["id", "login"])
//!     .from("users")
//!     .and_where(Expr::col("is_active").eq(1))
//!     .to_owned();
//!
//! let rows = crate::db::fetch_all_as::<User, _>(&pool, &stmt).await?;
//! ```
//!
//! 방언 차이(플레이스홀더 `$1` vs `?`, 식별자 인용, 자동증가 기본키 등)는
//! SeaQuery 와 [`dialect`] 가 처리하므로 호출부에서 신경 쓸 필요가 없습니다.

mod bind;
mod dialect;
mod id;
mod kind;
mod pool;
mod schema;
mod seed;

pub use bind::{
    execute, execute_ignore, execute_schema, execute_schema_ignore, fetch_all, fetch_all_as,
    fetch_optional, fetch_optional_as, fetch_scalar, fetch_scalar_optional, to_query,
    to_query_scalar,
};
pub use dialect::{auto_pk, build_query, build_schema, key_string};
pub use id::new_id;
pub use kind::{get_kind, kind_from_url, DbKind};
pub use pool::init_pool;
pub use schema::run_migrations;
pub use seed::{migrate_existing_groups, now_string, seed_data};
