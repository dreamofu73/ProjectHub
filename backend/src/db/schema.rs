//! 스키마 마이그레이션.
//!
//! 모든 DDL 은 SeaQuery 로 조립되어 연결된 엔진의 방언으로 직렬화됩니다.
//! 방언별 차이(자동증가 기본키, 인덱스용 문자열 길이, 식별자 인용 등)는
//! [`super::dialect`] 헬퍼와 SeaQuery 가 처리하므로 이 파일에는 원시 SQL 이 없습니다.
//!
//! 마이그레이션은 **idempotent** 합니다. 테이블은 `IF NOT EXISTS` 로 만들고,
//! 구버전 DB 를 따라잡기 위한 `ADD COLUMN` 은 실패를 무시합니다
//! (SQLite·MySQL 은 `ADD COLUMN IF NOT EXISTS` 를 지원하지 않습니다).

use sea_query::{
    ColumnDef, ForeignKey, ForeignKeyAction, ForeignKeyCreateStatement, Index, IndexCreateStatement,
    Table,
};
use sqlx::AnyPool;

use super::{auto_pk, execute_schema, execute_schema_ignore, get_kind, key_string, DbKind};

/// 전체 스키마를 생성/갱신합니다.
pub async fn run_migrations(pool: &AnyPool) {
    let kind = get_kind(pool);

    create_organization_tables(pool, kind).await;
    create_user_tables(pool, kind).await;
    create_project_tables(pool, kind).await;
    create_issue_tables(pool, kind).await;
    create_issue_custom_field_tables(pool, kind).await;
    create_board_tables(pool, kind).await;
    create_wiki_tables(pool, kind).await;
    create_messaging_tables(pool, kind).await;
    create_group_tables(pool, kind).await;
    create_attachment_tables(pool, kind).await;
    create_activity_tables(pool, kind).await;

    apply_legacy_upgrades(pool).await;
    create_indexes(pool).await;

    super::seed::backfill_wiki_uuids(pool).await;
    super::seed::seed_default_organization(pool).await;
    super::seed::migrate_existing_groups(pool).await;
}

// ---------------------------------------------------------------------------
// 실행 헬퍼
// ---------------------------------------------------------------------------

/// 필수 테이블을 생성합니다. 실패하면 잘못된 스키마로 기동하지 않도록 중단합니다.
async fn create_table(pool: &AnyPool, stmt: sea_query::TableCreateStatement, what: &str) {
    if let Err(e) = execute_schema(pool, &stmt).await {
        panic!("Failed to create {what} table: {e}");
    }
}

/// 구버전 DB 를 따라잡기 위한 컬럼 추가. 이미 존재하면 무시합니다.
async fn add_column(pool: &AnyPool, table: &str, col: ColumnDef) {
    execute_schema_ignore(
        pool,
        &Table::alter().table(table.to_string()).add_column(col).to_owned(),
    )
    .await;
}

/// 인덱스 생성. 이미 존재하면 무시합니다.
async fn create_index(pool: &AnyPool, stmt: IndexCreateStatement) {
    execute_schema_ignore(pool, &stmt).await;
}

/// `TEXT NOT NULL` 컬럼.
fn text_nn(name: &str) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    col.text().not_null();
    col
}

/// `TEXT` (nullable) 컬럼.
fn text(name: &str) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    col.text();
    col
}

/// `BIGINT NOT NULL DEFAULT <default>` 컬럼. 불리언 플래그는 0/1 로 저장합니다.
fn int_nn(name: &str, default: i64) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    col.big_integer().not_null().default(default);
    col
}

/// `BIGINT` (nullable) 컬럼. 외래키 참조 컬럼에 사용합니다.
fn int_null(name: &str) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    col.big_integer();
    col
}

/// `BIGINT NOT NULL` 컬럼.
fn int_required(name: &str) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    col.big_integer().not_null();
    col
}

/// 외래키 정의. 이름은 엔진 전역에서 유일해야 하므로 `fk_<자식테이블>_<컬럼>` 규칙을 씁니다.
fn fk(
    child: &str,
    column: &str,
    parent: &str,
    parent_col: &str,
    on_delete: ForeignKeyAction,
) -> ForeignKeyCreateStatement {
    ForeignKey::create()
        .name(format!("fk_{child}_{column}"))
        .from(child.to_string(), column.to_string())
        .to(parent.to_string(), parent_col.to_string())
        .on_delete(on_delete)
        .to_owned()
}

// ---------------------------------------------------------------------------
// 조직 / 부서
// ---------------------------------------------------------------------------

async fn create_organization_tables(pool: &AnyPool, kind: DbKind) {
    create_table(
        pool,
        Table::create()
            .table("organizations")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(text_nn("name"))
            .col(text_nn("domain"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .to_owned(),
        "organizations",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("departments")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_nn("organization_id", 1))
            .col(text_nn("name"))
            .col(int_null("parent_id"))
            .col(text_nn("description"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "departments",
                "parent_id",
                "departments",
                "id",
                ForeignKeyAction::SetNull,
            ))
            .to_owned(),
        "departments",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 사용자
// ---------------------------------------------------------------------------

async fn create_user_tables(pool: &AnyPool, kind: DbKind) {
    create_table(
        pool,
        Table::create()
            .table("users")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(text_nn("uuid"))
            .col(text_nn("login"))
            .col(text_nn("email"))
            .col(text_nn("password_hash"))
            .col(text_nn("firstname"))
            .col(text_nn("lastname"))
            .col(text_nn("role"))
            .col(int_nn("is_active", 1))
            .col(int_null("organization_id"))
            .col(int_null("department_id"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "users",
                "organization_id",
                "organizations",
                "id",
                ForeignKeyAction::SetNull,
            ))
            .foreign_key(&mut fk(
                "users",
                "department_id",
                "departments",
                "id",
                ForeignKeyAction::SetNull,
            ))
            .to_owned(),
        "users",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 프로젝트 / 업무
// ---------------------------------------------------------------------------

async fn create_project_tables(pool: &AnyPool, kind: DbKind) {
    let mut identifier = key_string("identifier");
    identifier.not_null().unique_key();

    create_table(
        pool,
        Table::create()
            .table("projects")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(identifier)
            .col(text_nn("name"))
            .col(text_nn("description"))
            .col(text_nn("homepage"))
            .col(int_nn("is_public", 1))
            .col(text_nn("status"))
            .col(json_list("task_types"))
            .col(json_list("issue_types"))
            .col(json_list("statuses"))
            .col(json_list("task_categories"))
            .col(json_list("task_statuses"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .to_owned(),
        "projects",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("project_members")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("project_id"))
            .col(int_required("user_id"))
            .col(text_nn("role"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "project_members",
                "project_id",
                "projects",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "project_members",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Restrict,
            ))
            .to_owned(),
        "project_members",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("milestones")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("project_id"))
            .col(text_nn("name"))
            .col(text_nn("description"))
            .col(text("due_date"))
            .col(text_nn("status"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "milestones",
                "project_id",
                "projects",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "milestones",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("tasks")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("project_id"))
            .col(text_nn("title"))
            .col(text("description"))
            .col(text("task_type"))
            .col(text("task_category"))
            .col(text("status"))
            .col(text("planned_start_date"))
            .col(text("planned_end_date"))
            .col(text("actual_start_date"))
            .col(text("actual_end_date"))
            .col(int_nn("progress", 0))
            .col(int_required("author_id"))
            .col(int_null("assignee_id"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "tasks",
                "project_id",
                "projects",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk("tasks", "author_id", "users", "id", ForeignKeyAction::Restrict))
            .foreign_key(&mut fk(
                "tasks",
                "assignee_id",
                "users",
                "id",
                ForeignKeyAction::SetNull,
            ))
            .to_owned(),
        "tasks",
    )
    .await;
}

/// JSON 배열 문자열을 담는 `TEXT NOT NULL DEFAULT '[]'` 컬럼.
fn json_list(name: &str) -> ColumnDef {
    let mut col = ColumnDef::new(name.to_string());
    col.text().not_null().default("[]");
    col
}

// ---------------------------------------------------------------------------
// 이슈
// ---------------------------------------------------------------------------

async fn create_issue_tables(pool: &AnyPool, kind: DbKind) {
    create_table(
        pool,
        Table::create()
            .table("issues")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("project_id"))
            .col(text_nn("tracker"))
            .col(text_nn("subject"))
            .col(text_nn("description"))
            .col(text_nn("status"))
            .col(text_nn("priority"))
            .col(int_required("author_id"))
            .col(int_null("assigned_to_id"))
            .col(int_null("milestone_id"))
            .col(text("due_date"))
            .col(int_nn("done_ratio", 0))
            .col(text("task_type"))
            .col(text("planned_start_date"))
            .col(text("actual_start_date"))
            .col(text("actual_end_date"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "issues",
                "project_id",
                "projects",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk("issues", "author_id", "users", "id", ForeignKeyAction::Restrict))
            .foreign_key(&mut fk(
                "issues",
                "assigned_to_id",
                "users",
                "id",
                ForeignKeyAction::SetNull,
            ))
            .foreign_key(&mut fk(
                "issues",
                "milestone_id",
                "milestones",
                "id",
                ForeignKeyAction::SetNull,
            ))
            .to_owned(),
        "issues",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("comments")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("issue_id"))
            .col(int_required("author_id"))
            .col(text_nn("content"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk("comments", "issue_id", "issues", "id", ForeignKeyAction::Cascade))
            .foreign_key(&mut fk("comments", "author_id", "users", "id", ForeignKeyAction::Restrict))
            .to_owned(),
        "comments",
    )
        .await;
}

// ---------------------------------------------------------------------------
// 이슈 커스텀 필드
// ---------------------------------------------------------------------------

async fn create_issue_custom_field_tables(pool: &AnyPool, kind: DbKind) {
    create_table(
        pool,
        Table::create()
            .table("issue_custom_fields")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("project_id"))
            .col(text_nn("field_name"))
            .col(text_nn("field_type"))
            .col(int_nn("is_required", 0))
            .col(int_nn("sort_order", 0))
            .col(text("options"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "issue_custom_fields",
                "project_id",
                "projects",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "issue_custom_fields",
    )
    .await;

    let mut uq_icfv = Index::create();
    uq_icfv
        .unique()
        .name("uq_icfv_issue_field")
        .table("issue_custom_field_values")
        .col("issue_id")
        .col("field_id");

    create_table(
        pool,
        Table::create()
            .table("issue_custom_field_values")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("issue_id"))
            .col(int_required("field_id"))
            .col(text("value"))
            .foreign_key(&mut fk(
                "issue_custom_field_values",
                "issue_id",
                "issues",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "issue_custom_field_values",
                "field_id",
                "issue_custom_fields",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .index(&mut uq_icfv)
            .to_owned(),
        "issue_custom_field_values",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 게시판
// ---------------------------------------------------------------------------

async fn create_board_tables(pool: &AnyPool, kind: DbKind) {
    create_table(
        pool,
        Table::create()
            .table("posts")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_null("project_id"))
            .col(int_required("author_id"))
            .col(text_nn("title"))
            .col(text("content"))
            .col(text_nn("category"))
            .col(text("popup_start_date"))
            .col(text("popup_end_date"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .to_owned(),
        "posts",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("post_comments")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("post_id"))
            .col(int_required("author_id"))
            .col(text_nn("content"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "post_comments",
                "post_id",
                "posts",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "post_comments",
                "author_id",
                "users",
                "id",
                ForeignKeyAction::Restrict,
            ))
            .to_owned(),
        "post_comments",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 위키
// ---------------------------------------------------------------------------

async fn create_wiki_tables(pool: &AnyPool, kind: DbKind) {
    let mut slug = key_string("slug");
    slug.not_null().unique_key();

    create_table(
        pool,
        Table::create()
            .table("wiki_pages")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_null("project_id"))
            .col(int_null("parent_id"))
            .col(text_nn("title"))
            .col(slug)
            .col(key_string("uuid"))
            .col(text_nn("content"))
            .col(int_required("author_id"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "wiki_pages",
                "project_id",
                "projects",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "wiki_pages",
                "parent_id",
                "wiki_pages",
                "id",
                ForeignKeyAction::SetNull,
            ))
            .foreign_key(&mut fk(
                "wiki_pages",
                "author_id",
                "users",
                "id",
                ForeignKeyAction::Restrict,
            ))
            .to_owned(),
        "wiki_pages",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("wiki_page_versions")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("wiki_page_id"))
            .col(text_nn("title"))
            .col(text_nn("content"))
            .col(int_required("author_id"))
            .col(int_required("version"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "wiki_page_versions",
                "wiki_page_id",
                "wiki_pages",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "wiki_page_versions",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("wiki_comments")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("wiki_page_id"))
            .col(int_required("author_id"))
            .col(text_nn("content"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "wiki_comments",
                "wiki_page_id",
                "wiki_pages",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "wiki_comments",
                "author_id",
                "users",
                "id",
                ForeignKeyAction::Restrict,
            ))
            .to_owned(),
        "wiki_comments",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 쪽지 / 채팅 / 알림
// ---------------------------------------------------------------------------

async fn create_messaging_tables(pool: &AnyPool, kind: DbKind) {
    let mut memo_id = key_string("id");
    memo_id.not_null().primary_key();

    create_table(
        pool,
        Table::create()
            .table("memos")
            .if_not_exists()
            .col(memo_id)
            .col(int_required("sender_id"))
            .col(int_required("receiver_id"))
            .col(text_nn("title"))
            .col(text_nn("content"))
            .col(int_nn("is_read", 0))
            .col(int_nn("sender_deleted", 0))
            .col(int_nn("receiver_deleted", 0))
            .col(int_nn("is_archived", 0))
            .col(int_nn("is_spam", 0))
            .col(int_nn("sender_in_trash", 0))
            .col(int_nn("receiver_in_trash", 0))
            .col(int_nn("is_sent", 1))
            .col(int_nn("expiry_notified", 0))
            .col(text("reserved_at"))
            .col(text("expires_at"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk("memos", "sender_id", "users", "id", ForeignKeyAction::Restrict))
            .foreign_key(&mut fk("memos", "receiver_id", "users", "id", ForeignKeyAction::Restrict))
            .to_owned(),
        "memos",
    )
    .await;

    let mut folder_id = key_string("id");
    folder_id.not_null().primary_key();

    create_table(
        pool,
        Table::create()
            .table("memo_folders")
            .if_not_exists()
            .col(folder_id)
            .col(int_required("user_id"))
            .col(text_nn("name"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "memo_folders",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "memo_folders",
    )
    .await;

    let mut mapping_memo_id = key_string("memo_id");
    mapping_memo_id.not_null();
    let mut mapping_folder_id = key_string("folder_id");
    mapping_folder_id.not_null();

    create_table(
        pool,
        Table::create()
            .table("memo_folder_mappings")
            .if_not_exists()
            .col(mapping_memo_id)
            .col(int_required("user_id"))
            .col(mapping_folder_id)
            .primary_key(Index::create().col("memo_id").col("user_id"))
            .foreign_key(&mut fk(
                "memo_folder_mappings",
                "folder_id",
                "memo_folders",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "memo_folder_mappings",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("chat_rooms")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(text_nn("name"))
            .col(text_nn("created_at"))
            .to_owned(),
        "chat_rooms",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("messages")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("room_id"))
            .col(int_required("author_id"))
            .col(text_nn("content"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "messages",
                "room_id",
                "chat_rooms",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk("messages", "author_id", "users", "id", ForeignKeyAction::Cascade))
            .to_owned(),
        "messages",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("chat_room_members")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("room_id"))
            .col(int_required("user_id"))
            .col(text_nn("joined_at"))
            .foreign_key(&mut fk(
                "chat_room_members",
                "room_id",
                "chat_rooms",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "chat_room_members",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "chat_room_members",
    )
    .await;

    let mut notification_id = key_string("id");
    notification_id.not_null().primary_key();

    create_table(
        pool,
        Table::create()
            .table("notifications")
            .if_not_exists()
            .col(notification_id)
            .col(int_required("user_id"))
            // `type` 은 여러 엔진에서 예약어지만 SeaQuery 가 식별자를 인용하므로 안전합니다.
            .col(text_nn("type"))
            .col(text_nn("title"))
            .col(text_nn("message"))
            .col(text("link"))
            .col(int_nn("is_read", 0))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "notifications",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "notifications",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 사용자 그룹 / 주소록
// ---------------------------------------------------------------------------

async fn create_group_tables(pool: &AnyPool, kind: DbKind) {
    let mut description = ColumnDef::new("description");
    description.text().not_null().default("");
    let mut updated_at = ColumnDef::new("updated_at");
    updated_at.text().not_null().default("");

    create_table(
        pool,
        Table::create()
            .table("user_groups")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(text_nn("name"))
            .col(int_required("user_id"))
            .col(description)
            .col(int_nn("is_shared", 0))
            .col(int_null("owner_id"))
            .col(text_nn("created_at"))
            .col(updated_at)
            .foreign_key(&mut fk("user_groups", "user_id", "users", "id", ForeignKeyAction::Cascade))
            .to_owned(),
        "user_groups",
    )
    .await;

    let mut role = ColumnDef::new("role");
    role.text().not_null().default("member");

    create_table(
        pool,
        Table::create()
            .table("user_group_members")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("group_id"))
            .col(int_required("user_id"))
            .col(role)
            .col(text("joined_at"))
            .col(int_null("invited_by"))
            .foreign_key(&mut fk(
                "user_group_members",
                "group_id",
                "user_groups",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "user_group_members",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "user_group_members",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("group_resource_shares")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("group_id"))
            .col(text_nn("resource_type"))
            .col(int_required("resource_id"))
            .col(text_nn("permission_level"))
            .col(int_required("shared_by"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "group_resource_shares",
                "group_id",
                "user_groups",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "group_resource_shares",
                "shared_by",
                "users",
                "id",
                ForeignKeyAction::Restrict,
            ))
            .to_owned(),
        "group_resource_shares",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("address_book_groups")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("user_id"))
            .col(text_nn("name"))
            .col(text_nn("created_at"))
            .col(text_nn("updated_at"))
            .foreign_key(&mut fk(
                "address_book_groups",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "address_book_groups",
    )
    .await;

    create_table(
        pool,
        Table::create()
            .table("address_book_members")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(int_required("group_id"))
            .col(int_required("user_id"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "address_book_members",
                "group_id",
                "address_book_groups",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "address_book_members",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "address_book_members",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 첨부파일
// ---------------------------------------------------------------------------

async fn create_attachment_tables(pool: &AnyPool, kind: DbKind) {
    create_table(
        pool,
        Table::create()
            .table("attachments")
            .if_not_exists()
            .col(auto_pk("id", kind))
            .col(text_nn("filename"))
            .col(text_nn("disk_filename"))
            .col(int_nn("filesize", 0))
            .col(text_nn("content_type"))
            .col(text_nn("description"))
            .col(int_required("author_id"))
            .col(int_null("issue_id"))
            .col(int_null("wiki_page_id"))
            .col(int_null("post_id"))
            .col(int_null("comment_id"))
            .col(key_string("memo_id"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "attachments",
                "author_id",
                "users",
                "id",
                ForeignKeyAction::Restrict,
            ))
            .to_owned(),
        "attachments",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 활동 로그
// ---------------------------------------------------------------------------

async fn create_activity_tables(pool: &AnyPool, kind: DbKind) {
    create_table(
        pool,
        Table::create()
            .table("activity_logs")
            .if_not_exists()
            .col(auto_pk("id", kind))
            // 전역 활동(프로젝트에 속하지 않는 활동)은 project_id 가 NULL 입니다.
            .col(int_null("project_id"))
            .col(int_required("user_id"))
            .col(text_nn("action_type"))
            .col(text_nn("subject_type"))
            .col(int_null("subject_id"))
            .col(text_nn("subject_title"))
            .col(text_nn("created_at"))
            .foreign_key(&mut fk(
                "activity_logs",
                "project_id",
                "projects",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .foreign_key(&mut fk(
                "activity_logs",
                "user_id",
                "users",
                "id",
                ForeignKeyAction::Cascade,
            ))
            .to_owned(),
        "activity_logs",
    )
    .await;
}

// ---------------------------------------------------------------------------
// 구버전 DB 업그레이드
// ---------------------------------------------------------------------------

/// SeaQuery 도입 이전 스키마로 만들어진 DB 를 현재 정의까지 끌어올립니다.
///
/// 현재 정의는 모두 `CREATE TABLE` 안에 포함되어 있으므로 새 DB 에서는 전부 실패하고
/// 무시됩니다. 이미 컬럼이 있는 경우의 오류도 정상 경로입니다.
async fn apply_legacy_upgrades(pool: &AnyPool) {
    add_column(pool, "users", int_null("organization_id")).await;
    add_column(pool, "users", int_null("department_id")).await;

    for column in ["task_types", "issue_types", "statuses", "task_categories", "task_statuses"] {
        add_column(pool, "projects", json_list(column)).await;
    }

    for (column, default) in [
        ("is_archived", 0),
        ("is_spam", 0),
        ("sender_in_trash", 0),
        ("receiver_in_trash", 0),
        ("is_sent", 1),
        ("expiry_notified", 0),
    ] {
        add_column(pool, "memos", int_nn(column, default)).await;
    }
    add_column(pool, "memos", text("reserved_at")).await;
    add_column(pool, "memos", text("expires_at")).await;

    add_column(pool, "attachments", key_string("memo_id")).await;

    let mut description = ColumnDef::new("description");
    description.text().not_null().default("");
    add_column(pool, "user_groups", description).await;
    add_column(pool, "user_groups", int_nn("is_shared", 0)).await;
    add_column(pool, "user_groups", int_null("owner_id")).await;
    let mut updated_at = ColumnDef::new("updated_at");
    updated_at.text().not_null().default("");
    add_column(pool, "user_groups", updated_at).await;

    let mut role = ColumnDef::new("role");
    role.text().not_null().default("member");
    add_column(pool, "user_group_members", role).await;
    add_column(pool, "user_group_members", text("joined_at")).await;
    add_column(pool, "user_group_members", int_null("invited_by")).await;

    add_column(pool, "issues", int_null("assigned_to_id")).await;
    add_column(pool, "issues", int_null("milestone_id")).await;
    add_column(pool, "issues", text("due_date")).await;
    add_column(pool, "issues", int_nn("done_ratio", 0)).await;
    add_column(pool, "issues", text("task_type")).await;
    add_column(pool, "issues", text("planned_start_date")).await;
    add_column(pool, "issues", text("actual_start_date")).await;
    add_column(pool, "issues", text("actual_end_date")).await;

    add_column(pool, "wiki_pages", key_string("uuid")).await;
}

// ---------------------------------------------------------------------------
// 인덱스
// ---------------------------------------------------------------------------

async fn create_indexes(pool: &AnyPool) {
    let index = |name: &str, table: &str, columns: &[&str]| {
        let mut stmt = Index::create();
        stmt.if_not_exists().name(name.to_string()).table(table.to_string());
        for column in columns {
            stmt.col(column.to_string());
        }
        stmt.to_owned()
    };

    create_index(pool, index("idx_departments_org", "departments", &["organization_id"])).await;
    create_index(pool, index("idx_memos_scheduler", "memos", &["is_sent", "reserved_at"])).await;
    create_index(
        pool,
        index(
            "idx_memos_expiry",
            "memos",
            &["is_read", "is_archived", "expires_at", "expiry_notified"],
        ),
    )
    .await;
    create_index(pool, index("idx_group_members_group_id", "user_group_members", &["group_id"]))
        .await;
    create_index(pool, index("idx_group_members_user_id", "user_group_members", &["user_id"])).await;
    create_index(pool, index("idx_group_owner_id", "user_groups", &["owner_id"])).await;
    create_index(pool, index("idx_grs_group_id", "group_resource_shares", &["group_id"])).await;
    create_index(
        pool,
        index("idx_grs_resource", "group_resource_shares", &["resource_type", "resource_id"]),
    )
    .await;
    create_index(
        pool,
        index("idx_wiki_versions_page", "wiki_page_versions", &["wiki_page_id", "version"]),
    )
    .await;
    create_index(pool, index("idx_notifications_user", "notifications", &["user_id", "is_read"]))
        .await;
    create_index(pool, index("idx_messages_room", "messages", &["room_id", "created_at"])).await;
    create_index(pool, index("idx_milestones_project", "milestones", &["project_id", "status"]))
        .await;
    create_index(pool, index("idx_issues_milestone", "issues", &["milestone_id"])).await;
    create_index(pool, index("idx_activity_logs_recent", "activity_logs", &["created_at"])).await;
    create_index(pool, index("idx_activity_logs_user", "activity_logs", &["user_id"])).await;
    create_index(pool, index("idx_icf_project", "issue_custom_fields", &["project_id"])).await;
    create_index(pool, index("idx_icfv_issue", "issue_custom_field_values", &["issue_id"])).await;
    create_index(pool, index("idx_icfv_field", "issue_custom_field_values", &["field_id"])).await;

    let unique_index = |name: &str, table: &str, columns: &[&str]| {
        let mut stmt = Index::create();
        stmt.if_not_exists().unique().name(name.to_string()).table(table.to_string());
        for column in columns {
            stmt.col(column.to_string());
        }
        stmt.to_owned()
    };

    create_index(pool, unique_index("idx_wiki_pages_uuid", "wiki_pages", &["uuid"])).await;
    create_index(
        pool,
        unique_index("uq_user_group_members", "user_group_members", &["group_id", "user_id"]),
    )
    .await;
    create_index(
        pool,
        unique_index(
            "uq_group_resource_shares",
            "group_resource_shares",
            &["group_id", "resource_type", "resource_id"],
        ),
    )
    .await;
    create_index(
        pool,
        unique_index("uq_address_book_members", "address_book_members", &["group_id", "user_id"]),
    )
    .await;
    create_index(
        pool,
        unique_index("uq_icfv_issue_field", "issue_custom_field_values", &["issue_id", "field_id"]),
    )
    .await;
}
