use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use toml;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateProjectRequest {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub is_public: Option<bool>,
    pub task_types: Option<String>,
    pub issue_types: Option<String>,
    pub statuses: Option<String>,
    pub task_categories: Option<String>,
    pub task_statuses: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub status: Option<String>,
    pub is_public: Option<bool>,
    pub task_types: Option<String>,
    pub issue_types: Option<String>,
    pub statuses: Option<String>,
    pub task_categories: Option<String>,
    pub task_statuses: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateIssueRequest {
    #[serde(deserialize_with = "crate::serde_utils::string_or_number")]
    pub project_id: i64,
    pub subject: String,
    pub tracker: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub task_type: Option<String>,
    pub planned_start_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub actual_end_date: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateIssueRequest {
    pub subject: Option<String>,
    pub description: Option<String>,
    pub tracker: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string_or_number")]
    pub assigned_to_id: Option<Option<i64>>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub done_ratio: Option<i64>,
    pub due_date: Option<String>,
    pub task_type: Option<String>,
    pub planned_start_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub actual_end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct Project {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub is_public: i64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub task_types: Option<String>,
    pub issue_types: Option<String>,
    pub statuses: Option<String>,
    pub task_categories: Option<String>,
    pub task_statuses: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct Issue {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub project_id: i64,
    pub tracker: String,
    pub subject: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub author_id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub assigned_to_id: Option<i64>,
    pub due_date: Option<String>,
    pub done_ratio: i64,
    pub created_at: String,
    pub updated_at: String,
    pub task_type: Option<String>,
    pub planned_start_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub actual_end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct Task {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub task_type: Option<String>,
    pub task_category: Option<String>,
    pub status: Option<String>,
    pub planned_start_date: Option<String>,
    pub planned_end_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub actual_end_date: Option<String>,
    pub progress: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub author_id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub assignee_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct TaskRow {
    pub title: String,
    pub description: Option<String>,
    pub task_type: Option<String>,
    pub task_category: Option<String>,
    pub status: Option<String>,
    pub planned_start_date: Option<String>,
    pub planned_end_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub actual_end_date: Option<String>,
    pub progress: Option<i64>,
    pub assignee_login: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateTaskRequest {
    #[serde(deserialize_with = "crate::serde_utils::string_or_number")]
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub task_type: Option<String>,
    pub task_category: Option<String>,
    pub status: Option<String>,
    pub planned_start_date: Option<String>,
    pub planned_end_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub actual_end_date: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub progress: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub assignee_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string")]
    pub description: Option<Option<String>>,
    pub task_type: Option<String>,
    pub task_category: Option<String>,
    pub status: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string")]
    pub planned_start_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string")]
    pub planned_end_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string")]
    pub actual_start_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string")]
    pub actual_end_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub progress: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string_or_number")]
    pub assignee_id: Option<Option<i64>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct BulkUpdateTasksRequest {
    #[serde(default, deserialize_with = "crate::serde_utils::vec_string_or_number")]
    pub task_ids: Vec<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string_or_number")]
    pub assignee_id: Option<Option<i64>>,
    pub progress: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string")]
    pub planned_start_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string")]
    pub planned_end_date: Option<Option<String>>,
    pub status: Option<String>,
    pub task_type: Option<String>,
    pub task_category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct User {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    pub uuid: String,
    pub login: String,
    pub email: String,
    pub firstname: String,
    pub lastname: String,
    pub role: String,
    pub is_active: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub organization_id: Option<i64>,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub department_id: Option<i64>,
    pub organization_name: Option<String>,
    pub department_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct Post {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub project_id: Option<i64>,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub author_id: i64,
    pub title: String,
    pub content: Option<String>,
    pub category: String,
    pub popup_start_date: Option<String>,
    pub popup_end_date: Option<String>,
    /// 공지 상단 고정 여부.
    pub is_pinned: bool,
    /// 상세 조회 수.
    pub view_count: i64,
    pub created_at: String,
    pub updated_at: String,
}


#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreatePostRequest {
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub project_id: Option<i64>,
    pub title: String,
    pub content: Option<String>,
    pub category: String,
    pub popup_start_date: Option<String>,
    pub popup_end_date: Option<String>,
    /// 공지 상단 고정 여부 (관리자 전용, 미지정 시 false).
    pub is_pinned: Option<bool>,
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdatePostRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub category: Option<String>,
    pub popup_start_date: Option<String>,
    pub popup_end_date: Option<String>,
    /// 공지 상단 고정 여부 (관리자 전용, 미지정 시 변경하지 않음).
    pub is_pinned: Option<bool>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub project_id: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreatePostCommentRequest {
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdatePostCommentRequest {
    pub content: String,
}

/// 이슈 댓글 생성 요청 (`POST /comments`).
///
/// 대상 이슈를 경로로 받지 않는 엔드포인트이므로 본문에 `issue_id` 가 필요합니다.
/// 경로 기반 엔드포인트는 [`CreateIssueCommentRequest`] 를 사용하십시오.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateCommentRequest {
    #[serde(deserialize_with = "crate::serde_utils::string_or_number")]
    pub issue_id: i64,
    pub content: String,
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}

/// 이슈 댓글 생성 요청 (`POST /issues/{id}/comments`).
///
/// 대상 이슈는 URL 경로로 지정하므로 본문에는 넣지 않습니다.
/// (본문에 `issue_id` 를 필수로 두면 경로만 쓰는 클라이언트가 422 를 받습니다.)
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateIssueCommentRequest {
    pub content: String,
    /// 첨부는 댓글 생성 후 별도 업로드로 연결하므로 현재 핸들러에서는 사용하지 않습니다.
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateIssueCommentRequest {
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ChatRoom {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct ChatRoomMember {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub room_id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub user_id: i64,
    pub joined_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct UserGroup {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub user_id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub owner_id: Option<i64>,
    pub is_shared: Option<i64>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct GroupMember {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub group_id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub user_id: i64,
    pub role: Option<String>,
    pub joined_at: Option<String>,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub invited_by: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct GroupResourceShare {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub group_id: i64,
    pub resource_type: String,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub resource_id: i64,
    pub permission_level: String,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub shared_by: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct Organization {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    pub name: String,
    pub domain: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct Department {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub organization_id: i64,
    pub name: String,
    #[serde(serialize_with = "crate::serde_utils::serialize_opt_i64_as_string")]
    pub parent_id: Option<i64>,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct AddressBookGroup {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub user_id: i64,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct AddressBookMember {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub group_id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub user_id: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
#[allow(dead_code)]
pub struct AddressBookMemberWithUser {
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub group_id: i64,
    #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
    pub user_id: i64,
    pub login: String,
    pub email: String,
    pub firstname: String,
    pub lastname: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct AppConfig {
    pub port: u16,
    pub allowed_extensions: Vec<String>,
    pub jwt_secret: String,
    pub database_url: String,
    pub upload_dir: String,
    pub admin_username: Option<String>,
    pub admin_password: Option<String>,
    pub log_max_size_mb: u64,
    pub log_max_files: usize,
    pub log_retention_days: u64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub login: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub login: String,
    pub email: String,
    pub password: String,
    pub firstname: Option<String>,
    pub lastname: Option<String>,
    pub role: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub organization_id: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub department_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateUserRequest {
    pub email: Option<String>,
    pub firstname: Option<String>,
    pub lastname: Option<String>,
    pub role: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub is_active: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub organization_id: Option<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub department_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateProfileRequest {
    pub email: Option<String>,
    pub firstname: Option<String>,
    pub lastname: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdatePasswordRequest {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateProfileImageRequest {
    pub image: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct BulkDepartmentRequest {
    #[serde(deserialize_with = "crate::serde_utils::vec_string_or_number")]
    pub user_ids: Vec<i64>,
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub department_id: Option<i64>,
}

impl AppConfig {
    /// 강한 임의 JWT 시크릿을 생성합니다 (최소 32바이트).
    fn generate_jwt_secret() -> String {
        use uuid::Uuid;
        format!("{}{}", Uuid::new_v4(), Uuid::new_v4()).replace('-', "")
    }

    pub fn load(config_file: &str) -> Self {
        let config_path = std::path::Path::new(config_file);
        let config_path_display = config_path
            .canonicalize()
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default().join(config_path));
            
        if !config_path.exists() {
            let jwt_secret = Self::generate_jwt_secret();
            let default_config = format!(
                r#"[default]
port = 8000
allowed_extensions = ["png", "jpg", "jpeg", "gif", "pdf", "zip", "txt", "docx", "xlsx", "bin"]
jwt_secret = "{jwt_secret}"
database_url = "postgres://postgres:postgres@localhost:5432/project_hub"
upload_dir = "./data/files"
admin_username = "admin"
admin_password = "admin_password_change_me"
log_max_size_mb = 10
log_max_files = 5
log_retention_days = 30

[default.limits]
file = "100MiB"
form = "110MiB"
data-form = "110MiB"
"#
            );
            
            if let Err(e) = std::fs::write(config_path, &default_config) {
                eprintln!(
                    "[ERROR] 설정 파일 생성 실패. 절대 경로: {}\n에러: {}",
                    config_path_display.display(),
                    e
                );
            } else {
                println!(
                    "[INFO] 설정 파일이 존재하지 않아 초기 설정 파일을 생성했습니다.\n생성된 파일 경로: {}",
                    config_path_display.display()
                );
                println!("설정 파일을 확인하고 필요한 값을 수정한 후 서버를 다시 실행해 주세요.");
            }
            
            println!("프로그램을 종료하려면 Enter 키를 누르세요...");
            let mut input = String::new();
            let _ = std::io::stdin().read_line(&mut input);
            std::process::exit(1);
        }

        let config_str = std::fs::read_to_string(config_path).unwrap_or_else(|e| {
            panic!("설정 파일({})을 읽을 수 없습니다: {}", config_file, e);
        });
        let toml_val: toml::Value = toml::from_str(&config_str).unwrap_or(toml::Value::Table(Default::default()));
        let default_table = toml_val.get("default").and_then(|v| v.as_table());

        let get_str = |key: &str, def: &str| -> String {
            default_table
                .and_then(|t| t.get(key))
                .and_then(|v| v.as_str())
                .unwrap_or(def)
                .to_string()
        };

        let port = default_table
            .and_then(|t| t.get("port"))
            .and_then(|v| v.as_integer())
            .unwrap_or(8000) as u16;

        let allowed_extensions: Vec<String> = default_table
            .and_then(|t| t.get("allowed_extensions"))
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_else(|| vec![
                "png".to_string(), "jpg".to_string(), "jpeg".to_string(),
                "gif".to_string(), "pdf".to_string(), "zip".to_string(),
                "txt".to_string(), "docx".to_string(), "xlsx".to_string(),
                "bin".to_string()
            ]);

        Self {
            port,
            allowed_extensions,
            jwt_secret: get_str("jwt_secret", "default-secret"),
            database_url: get_str("database_url", "postgres://postgres:postgres@localhost:5432/project_hub"),
            upload_dir: get_str("upload_dir", "./data/files"),
            admin_username: default_table.and_then(|t| t.get("admin_username").and_then(|v| v.as_str().map(|s| s.to_string()))),
            admin_password: default_table.and_then(|t| t.get("admin_password").and_then(|v| v.as_str().map(|s| s.to_string()))),
            log_max_size_mb: default_table.and_then(|t| t.get("log_max_size_mb").and_then(|v| v.as_integer())).unwrap_or(10) as u64,
            log_max_files: default_table.and_then(|t| t.get("log_max_files").and_then(|v| v.as_integer())).unwrap_or(5) as usize,
            log_retention_days: default_table.and_then(|t| t.get("log_retention_days").and_then(|v| v.as_integer())).unwrap_or(30) as u64,
        }
    }
}


