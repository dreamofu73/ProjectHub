//! 초기 데이터 시딩과 데이터 마이그레이션.
//!
//! 모든 문장은 SeaQuery 로 조립합니다. 상관 서브쿼리처럼 방언 차이가 큰 구문은
//! 조회 후 Rust 쪽에서 분기해, 어떤 엔진에서도 동일하게 동작하도록 했습니다.

use sea_query::{Expr, ExprTrait, Func, Query};
use sqlx::{AnyPool, Row};
use uuid::Uuid;

use super::{execute, execute_ignore, fetch_all, fetch_scalar, fetch_scalar_optional, new_id};
/// 타임스탬프 문자열. 스키마상 `created_at`/`updated_at` 이 TEXT 이므로
/// 엔진의 `NOW()` 대신 애플리케이션에서 생성해 모든 엔진에서 동일한 형식을 씁니다.
/// 형식은 기존 데이터(SQLite `datetime('now')`, MySQL `NOW()`)와 동일한 UTC `%Y-%m-%d %H:%M:%S` 입니다.
pub fn now_string() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

/// 조직이 하나도 없으면 기본 조직을 만듭니다.
pub async fn seed_default_organization(pool: &AnyPool) {
    let count: i64 = fetch_scalar(
        pool,
        &Query::select().expr(Func::count(Expr::col("id"))).from("organizations").to_owned(),
    )
    .await
    .unwrap_or(0);

    if count > 0 {
        return;
    }

    let now = now_string();
    execute_ignore(
        pool,
        &Query::insert()
            .into_table("organizations")
            .columns(["id", "name", "domain", "created_at", "updated_at"])
            .values_panic([
                new_id().into(),
                "기본 조직".into(),
                "".into(),
                now.clone().into(),
                now.into(),
            ])
            .to_owned(),
    )
    .await;
}

/// `uuid` 가 비어 있는 위키 문서에 UUID 를 채웁니다.
pub async fn backfill_wiki_uuids(pool: &AnyPool) {
    let rows = fetch_all(
        pool,
        &Query::select()
            .column("id")
            .from("wiki_pages")
            .and_where(Expr::col("uuid").is_null())
            .to_owned(),
    )
    .await
    .unwrap_or_default();

    for row in rows {
        let Ok(id) = row.try_get::<i64, _>(0) else { continue };
        execute_ignore(
            pool,
            &Query::update()
                .table("wiki_pages")
                .value("uuid", Uuid::new_v4().to_string())
                .and_where(Expr::col("id").eq(id))
                .to_owned(),
        )
        .await;
    }
}

/// 사용자가 하나도 없으면 설정의 관리자 계정을 생성합니다.
pub async fn seed_data(pool: &AnyPool, config: &crate::models::AppConfig) {
    let count: i64 = fetch_scalar(
        pool,
        &Query::select().expr(Func::count(Expr::col("id"))).from("users").to_owned(),
    )
    .await
    .unwrap_or(0);

    if count > 0 {
        return;
    }

    let admin_username = config.admin_username.as_deref().unwrap_or("admin");
    let admin_password = config.admin_password.as_deref().unwrap_or("admin");
    let password_hash = crate::auth::hash_password(admin_password)
        .expect("Failed to hash admin password for seed data");
    let now = now_string();

    execute(
        pool,
        &Query::insert()
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
                "is_active",
                "created_at",
                "updated_at",
            ])
            .values_panic([
                new_id().into(),
                Uuid::new_v4().to_string().into(),
                admin_username.into(),
                format!("{admin_username}@localhost").into(),
                password_hash.into(),
                "Admin".into(),
                "".into(),
                "admin".into(),
                1i64.into(),
                now.clone().into(),
                now.into(),
            ])
            .to_owned(),
    )
    .await
    .expect("Failed to seed admin user");

    println!("✔ Created default admin user: {admin_username}");
}

/// 구버전 사용자 그룹 데이터를 현재 스키마(소유자·역할·초대자)에 맞게 보정합니다.
pub async fn migrate_existing_groups(pool: &AnyPool) {
    // 1) 소유자 미지정 그룹은 생성자를 소유자로 승격
    execute_ignore(
        pool,
        &Query::update()
            .table("user_groups")
            .value("owner_id", Expr::col("user_id"))
            .and_where(Expr::col("owner_id").is_null())
            .to_owned(),
    )
    .await;

    // 2) 그룹별 소유자 멤버십·역할·초대자 보정
    //    상관 서브쿼리는 엔진별 지원 편차가 크므로 그룹 단위로 나눠 처리합니다.
    let groups = fetch_all(
        pool,
        &Query::select().columns(["id", "owner_id", "user_id"]).from("user_groups").to_owned(),
    )
    .await
    .unwrap_or_default();

    for row in groups {
        let Ok(group_id) = row.try_get::<i64, _>("id") else { continue };
        let owner_id = row
            .try_get::<Option<i64>, _>("owner_id")
            .ok()
            .flatten()
            .or_else(|| row.try_get::<Option<i64>, _>("user_id").ok().flatten());
        let Some(owner_id) = owner_id else { continue };

        ensure_owner_membership(pool, group_id, owner_id).await;

        execute_ignore(
            pool,
            &Query::update()
                .table("user_group_members")
                .value("invited_by", owner_id)
                .and_where(Expr::col("group_id").eq(group_id))
                .and_where(Expr::col("invited_by").is_null())
                .to_owned(),
        )
        .await;
    }

    // 3) 남은 기본값 보정
    execute_ignore(
        pool,
        &Query::update()
            .table("user_group_members")
            .value("role", "member")
            .and_where(Expr::col("role").is_null())
            .to_owned(),
    )
    .await;

    execute_ignore(
        pool,
        &Query::update()
            .table("user_group_members")
            .value("joined_at", now_string())
            .and_where(Expr::col("joined_at").is_null())
            .to_owned(),
    )
    .await;
}

/// 소유자가 그룹 멤버로 등록되어 있는지 확인하고, 없으면 `owner` 역할로 추가합니다.
async fn ensure_owner_membership(pool: &AnyPool, group_id: i64, owner_id: i64) {
    let existing: Option<i64> = fetch_scalar_optional(
        pool,
        &Query::select()
            .column("id")
            .from("user_group_members")
            .and_where(Expr::col("group_id").eq(group_id))
            .and_where(Expr::col("user_id").eq(owner_id))
            .limit(1)
            .to_owned(),
    )
    .await
    .unwrap_or(None);

    if existing.is_some() {
        // 이미 멤버라면 역할이 비어 있을 때만 소유자로 지정합니다.
        execute_ignore(
            pool,
            &Query::update()
                .table("user_group_members")
                .value("role", "owner")
                .and_where(Expr::col("group_id").eq(group_id))
                .and_where(Expr::col("user_id").eq(owner_id))
                .and_where(Expr::col("role").is_null())
                .to_owned(),
        )
        .await;
        return;
    }

    execute_ignore(
        pool,
        &Query::insert()
            .into_table("user_group_members")
            .columns(["id", "group_id", "user_id", "role", "joined_at", "invited_by"])
            .values_panic([
                new_id().into(),
                group_id.into(),
                owner_id.into(),
                "owner".into(),
                now_string().into(),
                owner_id.into(),
            ])
            .to_owned(),
    )
    .await;
}

