//! SeaQuery 로 생성되는 스키마가 라우트가 실제로 사용하는 테이블·컬럼을 모두 갖추는지 검증합니다.
//!
//! `TEST_DATABASE_URL` 을 지정하면 PostgreSQL/MySQL/MariaDB 에서도 동일하게 실행됩니다.

mod common;

use sea_query::Query;

/// 라우트 코드가 참조하는 전체 테이블 목록.
const EXPECTED_TABLES: &[&str] = &[
    "organizations",
    "departments",
    "users",
    "projects",
    "project_members",
    "milestones",
    "tasks",
    "issues",
    "comments",
    "posts",
    "post_comments",
    "wiki_pages",
    "wiki_page_versions",
    "wiki_comments",
    "memos",
    "memo_folders",
    "memo_folder_mappings",
    "chat_rooms",
    "messages",
    "chat_room_members",
    "notifications",
    "user_groups",
    "user_group_members",
    "group_resource_shares",
    "address_book_groups",
    "address_book_members",
    "attachments",
    "activity_logs",
];

#[tokio::test]
async fn migrations_create_every_referenced_table() {
    let pool = common::setup_db().await;

    for table in EXPECTED_TABLES {
        let sql = format!("SELECT COUNT(*) FROM {table}");
        sqlx::query_scalar::<_, i64>(sqlx::AssertSqlSafe(sql))
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|e| panic!("테이블 `{table}` 을 조회할 수 없습니다: {e}"));
    }
}

/// 조인에 쓰이지만 누락되기 쉬운 컬럼들을 개별 검증합니다.
#[tokio::test]
async fn migrations_create_join_columns() {
    let pool = common::setup_db().await;

    let checks = [
        ("issues", "milestone_id"),
        ("users", "organization_id"),
        ("users", "department_id"),
        ("attachments", "memo_id"),
        ("memos", "expires_at"),
        ("user_groups", "owner_id"),
        ("user_group_members", "invited_by"),
        ("wiki_pages", "uuid"),
        ("activity_logs", "subject_title"),
    ];

    for (table, column) in checks {
        let sql = format!("SELECT {column} FROM {table} WHERE 1 = 0");
        sqlx::query(sqlx::AssertSqlSafe(sql))
            .fetch_all(&pool)
            .await
            .unwrap_or_else(|e| panic!("`{table}.{column}` 컬럼이 없습니다: {e}"));
    }
}

/// 채팅 메시지 저장 경로가 실제로 동작하는지 확인합니다.
/// (`messages` 테이블 누락으로 인한 500 회귀 방지)
#[tokio::test]
async fn messages_can_be_inserted() {
    let pool = common::setup_db().await;
    let (user_id, _) = common::create_user(&pool, "chat_writer", "user").await;

    let room_stmt = Query::insert()
        .into_table(sea_query::Alias::new("chat_rooms"))
        .columns([
            sea_query::Alias::new("name"),
            sea_query::Alias::new("created_at"),
        ])
        .values_panic([
            "general".into(),
            backend::db::now_string().into(),
        ])
        .to_owned();
    backend::db::execute(&pool, &room_stmt).await.expect("채팅방 생성 실패");
    let room_id = backend::db::last_inserted_id(&pool).await;

    let message_stmt = Query::insert()
        .into_table(sea_query::Alias::new("messages"))
        .columns([
            sea_query::Alias::new("room_id"),
            sea_query::Alias::new("author_id"),
            sea_query::Alias::new("content"),
            sea_query::Alias::new("created_at"),
        ])
        .values_panic([
            room_id.into(),
            user_id.into(),
            "hello".into(),
            backend::db::now_string().into(),
        ])
        .to_owned();
    backend::db::execute(&pool, &message_stmt).await.expect("메시지 저장 실패");

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages")
        .fetch_one(&pool)
        .await
        .expect("메시지 조회 실패");
    assert_eq!(count, 1);
}
