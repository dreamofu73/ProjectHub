export interface User {
  id: string;
  uuid: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface UserInfo {
  id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
}

export interface UserData {
  id: string;
  login: string;
  firstname: string;
  lastname: string;
}

export interface Project {
  id: string;
  identifier: string;
  name: string;
  description?: string;
  homepage?: string;
  is_public: number;
  status: string;
  created_at: string;
  updated_at: string;
  task_types?: string | null;
  issue_types?: string | null;
  statuses?: string | null;
  task_categories?: string | null;
  task_statuses?: string | null;
}

export interface TaskDependency {
  id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  task_type: string;
  task_category: string;
  status: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  progress: number;
  author_id: string;
  assignee_id: string | null;
  /** 상위 일감 ID. 최상위 일감이면 null. */
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
  /** 프론트엔드 연동용 확장 필드 */
  is_critical?: boolean;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  /** `name`의 별칭. 백엔드가 두 형태를 모두 내려준다. */
  subject?: string;
  description: string | null;
  status: string;
  due_date: string | null;
  issue_count?: number;
  closed_issue_count?: number;
}

export interface Attachment {
  id: string;
  filename: string;
  disk_filename?: string;
  filesize: number;
  content_type: string | null;
  description?: string;
  author_id?: string;
  author_login?: string;
  author_name?: string;
  issue_id?: string | null;
  wiki_page_id?: string | null;
  post_id?: string | null;
  comment_id?: string | null;
  memo_id?: string | null;
  created_at: string;
}

export interface Issue {
  id: string;
  project_id: string;
  tracker: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  author_id?: string;
  author_name?: string;
  author_login?: string;
  assigned_to_id: string | null;
  assigned_name: string | null;
  assigned_login: string | null;
  due_date: string | null;
  done_ratio: number;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  project_name?: string;
  project_identifier?: string;
  task_type?: string | null;
  planned_start_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
}

export interface Comment {
  id: string;
  issue_id: string;
  author_id?: string;
  author_name: string | null;
  author_login: string | null;
  content: string;
  created_at: string;
  updated_at?: string;
  attachments?: Attachment[];
}

export interface Memo {
  id: string;
  sender_id: string;
  receiver_id: string;
  title: string;
  content: string;
  created_at: string;
  is_read: number;
  is_sent?: number;
  is_archived: number;
  is_spam: number;
  sender_login?: string;
  sender_firstname?: string;
  sender_lastname?: string;
  receiver_login?: string;
  receiver_firstname?: string;
  receiver_lastname?: string;
  attachments?: Attachment[];
  folder_id?: string;
  reserved_at?: string;
  expires_at?: string;
}

export interface CustomFolder {
  id: string;
  user_id?: string;
  name: string;
  created_at?: string;
}

export type FolderType = 'received' | 'personal' | 'group' | 'self' | 'sent' | 'archived' | 'spam' | 'trash' | string;

export interface ChatRoom {
  id: string;
  name: string;
  created_at: string;
  unread_count?: number;
}

export interface ChatRoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  author_name: string;
  author_login: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
}

export interface UserGroup {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface UserGroupMember {
  id: string;
  user_id: string;
  group_id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumn {
  id: string;
  label: string;
  color: string;
  bgColor: string;
}

export interface WikiComment {
  id: string;
  wiki_page_id: string;
  author_id: string;
  author_login: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface WikiPage {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  content: string;
  author_id: string;
  is_locked?: number;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_login?: string;
  parent_id?: string | null;
}

export interface CreateWikiPageRequest {
  project_id: string | null;
  title: string;
  content: string;
  parent_id?: string | null;
}

export interface UpdateWikiPageRequest {
  title: string;
  content: string;
  parent_id?: string | null;
}

export interface Post {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  author_name: string;
  category: string;
  created_at: string;
  content: string;
  comment_count?: number;
  attachments?: Attachment[];
  popup_start_date?: string | null;
  popup_end_date?: string | null;
  /** 공지 상단 고정 여부 */
  is_pinned?: boolean;
  /** 상세 조회 수 */
  view_count?: number;
  /** 목록 응답에 포함되는 첨부 개수 */
  attachment_count?: number;
  /** 목록 응답에 포함되는 첨부 총 용량(바이트) */
  attachment_total_size?: number;
}

/** 게시글 상세의 이전/다음 글 네비게이션 (`GET /api/posts/:id/adjacent`) */
export interface AdjacentPosts {
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: number;
  is_sent?: number;
  created_at: string;
}

export interface Member {
  id?: string;
  user_id: string;
  login: string;
  email?: string;
  firstname: string;
  lastname: string;
  role?: string;
  created_at?: string;
}

export interface DashboardActivity {
  id: string;
  created_at: string;
  user_name?: string | null;
  user_login: string;
  project_name?: string | null;
  project_identifier?: string | null;
  subject_title: string;
  action_type: 'created' | 'updated' | 'deleted' | 'commented' | 'posted' | 'invited' | string;
}

export interface ProjectSummary {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  open_issues: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_login: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export type GroupRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ResourceType = 'project' | 'issue' | 'wiki_page' | 'board' | 'memo' | 'attachment';
export type PermissionLevel = 'read' | 'write' | 'admin';

export interface Group {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  user_id: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
  my_role?: GroupRole;
  owner_name?: string;
}

export interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  role: GroupRole;
  joined_at: string;
  invited_by?: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
}

export interface GroupResourceShare {
  id: string;
  group_id: string;
  resource_type: ResourceType;
  resource_id: string;
  permission_level: PermissionLevel;
  shared_by: string;
  created_at: string;
}

export interface CreateGroupPayload { name: string; description?: string; }
export interface AddMembersPayload { user_ids: string[]; role: 'admin' | 'member' | 'viewer'; }
export interface CreateSharePayload { resource_type: ResourceType; resource_id: string; permission_level: PermissionLevel; }

// ---------------------------------------------------------------------------
// Log Management
// ---------------------------------------------------------------------------
export interface LogFileInfo {
  name: string;
  size: number;
  modified: string;
}

export interface LogFileContent {
  name: string;
  content: string;
  total_lines: number;
}

export interface LogSearchResult {
  file: string;
  line: number;
  content: string;
}

export interface LogTailResult {
  content: string;
  new_offset: number;
  file_size: number;
}

export interface LogConfig {
  max_size_mb: number;
  max_files: number;
  retention_days: number;
}
