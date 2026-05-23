/**
 * ProjectHub API Types
 * Matches backend API response structures
 */

// ─── Base Response Types ────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
}

// ─── Auth Types ────────────────────────────────────────────────────────

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  login: string;
  password: string;
  firstname: string;
  lastname: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface User {
  id: number | string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'user' | 'overseer';
  is_active: number;
  created_at: string;
  updated_at: string;
  department_id?: number;
  organization_name?: string;
}

// ─── Project Types ─────────────────────────────────────────────────────

export interface Project {
  id: number | string;
  name: string;
  identifier: string;
  description?: string;
  status: 'active' | 'archived' | 'closed';
  created_at: string;
  updated_at: string;
  open_issues_count?: number;
  closed_issues_count?: number;
  member_count?: number;
}

export interface CreateProjectRequest {
  name: string;
  identifier: string;
  description?: string;
  status?: 'active' | 'archived' | 'closed';
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'archived' | 'closed';
}

export interface ProjectMember {
  id: number | string;
  user_id: number | string;
  project_id: number | string;
  role: 'member' | 'manager' | 'viewer';
  user?: User;
  created_at: string;
}

export interface AddProjectMemberRequest {
  user_id: number | string;
  role?: 'member' | 'manager' | 'viewer';
}

// ─── Issue Types ───────────────────────────────────────────────────────

export interface Issue {
  id: number | string;
  project_id: number | string;
  tracker: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  author_id?: number | string;
  author_name?: string;
  author_login?: string;
  assigned_to_id?: number | string;
  assigned_name?: string;
  assigned_login?: string;
  due_date?: string;
  done_ratio: number;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  project_name?: string;
  project_identifier?: string;
  task_type?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  custom_values?: CustomFieldValue[];
}

export interface CreateIssueRequest {
  project_id: number | string;
  subject: string;
  description?: string;
  status?: string;
  priority?: string;
  tracker?: string;
  assigned_to_id?: number | string;
  due_date?: string;
  task_type?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  custom_fields?: CustomFieldValueInput[];
}

export interface UpdateIssueRequest {
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  tracker?: string;
  assigned_to_id?: number | string;
  due_date?: string;
  done_ratio?: number;
  task_type?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  custom_fields?: CustomFieldValueInput[];
}

// ─── Custom Field Types ────────────────────────────────────────────────

// Backend allowlist (issue_custom_fields.rs): integer, float, string, text, date, time, boolean.
export type CustomFieldType = 'integer' | 'float' | 'string' | 'text' | 'date' | 'time' | 'boolean';

export interface CustomField {
  id: number | string;
  project_id: number | string;
  field_name: string;
  field_type: CustomFieldType;
  is_required: number;
  sort_order: number;
  options?: string; // JSON string for select-like options
  created_at: string;
  updated_at: string;
}

export interface CreateCustomFieldRequest {
  field_name: string;
  field_type: CustomFieldType;
  is_required?: number;
  sort_order?: number;
  options?: string;
}

export interface UpdateCustomFieldRequest {
  field_name?: string;
  field_type?: CustomFieldType;
  is_required?: number;
  sort_order?: number;
  options?: string;
}

export interface CustomFieldValue {
  field_id: number | string;
  field_name: string;
  field_type: string;
  value: string;
}

export interface CustomFieldValueInput {
  field_id: number | string;
  value: string;
}

export interface SaveCustomValuesRequest {
  values: CustomFieldValueInput[];
}

// ─── Milestone Types ───────────────────────────────────────────────────

// Authoritative field is `name` (backend milestones.rs DB column + list response).
// `subject` is kept as an optional legacy alias so the shared setup.ts factory still compiles;
// the backend accepts either `name` or `subject` on input.
export interface Milestone {
  id: number | string;
  project_id: number | string;
  name: string;
  subject?: string;
  status: 'open' | 'closed';
  due_date?: string;
  created_at: string;
  updated_at: string;
  issues_count?: number;
  open_issues_count?: number;
  closed_issues_count?: number;
}

export interface CreateMilestoneRequest {
  project_id: number | string;
  name?: string;
  subject?: string;
  status?: 'open' | 'closed';
  due_date?: string;
}

export interface UpdateMilestoneRequest {
  name?: string;
  subject?: string;
  status?: 'open' | 'closed';
  due_date?: string;
}

// ─── Wiki Types ────────────────────────────────────────────────────────

export interface WikiPage {
  id: number | string;
  project_id: number | string;
  title: string;
  content: string;
  parent_id?: number | string;
  author_id: number | string;
  author_name?: string;
  created_at: string;
  updated_at: string;
  version?: number;
}

export interface CreateWikiPageRequest {
  project_id: number | string;
  title: string;
  content: string;
  parent_id?: number | string;
}

export interface UpdateWikiPageRequest {
  title?: string;
  content?: string;
  parent_id?: number | string;
}

export interface WikiVersion {
  id: number | string;
  wiki_page_id: number | string;
  title: string;
  content: string;
  author_id: number | string;
  author_name?: string;
  created_at: string;
  version: number;
}

// ─── Post Types ────────────────────────────────────────────────────────

export interface Post {
  id: number | string;
  project_id: number | string;
  author_id: number | string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  attachments?: Attachment[];
  author_name?: string;
  author_login?: string;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  category: string;
  project_id: number | string;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  category?: string;
}

// ─── Comment Types ─────────────────────────────────────────────────────

export interface Comment {
  id: number | string;
  content: string;
  author_id: number | string;
  author_name?: string;
  author_login?: string;
  created_at: string;
  updated_at?: string;
  attachments?: Attachment[];
}

export interface CreateCommentRequest {
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}

// ─── Group Types ───────────────────────────────────────────────────────

export interface Group {
  id: number | string;
  name: string;
  owner_id: number | string;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface CreateGroupRequest {
  name: string;
}

export interface UpdateGroupRequest {
  name: string;
}

export interface GroupMember {
  id: number | string;
  group_id: number | string;
  user_id: number | string;
  role: 'member' | 'admin';
  user?: User;
  created_at: string;
}

export interface AddGroupMemberRequest {
  user_id: number | string;
  role?: 'member' | 'admin';
}

export interface UpdateGroupMemberRequest {
  role: 'member' | 'admin';
}

export interface GroupShare {
  id: number | string;
  group_id: number | string;
  resource_type: 'project' | 'wiki' | 'issue' | 'post';
  resource_id: number | string;
  permission: 'read' | 'write' | 'admin';
  created_at: string;
}

export interface CreateGroupShareRequest {
  resource_type: 'project' | 'wiki' | 'issue' | 'post';
  resource_id: number | string;
  permission: 'read' | 'write' | 'admin';
}

// ─── Address Book Types ────────────────────────────────────────────────

export interface AddressBookGroup {
  id: number | string;
  user_id: number | string;
  name: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressBookGroupRequest {
  name: string;
}

export interface UpdateAddressBookGroupRequest {
  name: string;
}

export interface AddressBookMember {
  id: number | string;
  group_id: number | string;
  user_id: number | string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  created_at: string;
}

export interface AddAddressBookMembersRequest {
  user_ids: (number | string)[];
}

// ─── Task Types ────────────────────────────────────────────────────────

export interface Task {
  id: number | string;
  project_id: number | string;
  title: string;
  description?: string;
  task_type: string;
  task_category: string;
  status: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  progress: number;
  author_id: number | string;
  author_name?: string;
  assignee_id?: number | string;
  assignee_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  project_id: number | string;
  title: string;
  description?: string;
  task_type: string;
  task_category: string;
  status: string;
  planned_start_date?: string;
  planned_end_date?: string;
  progress?: number;
  assignee_id?: number | string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  task_type?: string;
  task_category?: string;
  status?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  progress?: number;
  assignee_id?: number | string;
}

// ─── Memo Types ────────────────────────────────────────────────────────

export interface Memo {
  id: string;
  sender_id: number | string;
  receiver_id: number | string;
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

export interface CreateMemoRequest {
  receiver_id: number | string;
  title: string;
  content: string;
}

export interface UpdateMemoRequest {
  title?: string;
  content?: string;
  is_read?: number;
  is_archived?: number;
  is_spam?: number;
  folder_id?: string;
}

// ─── Notification Types ────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: number | string;
  type: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: number | string;
  is_read: number;
  created_at: string;
}

// ─── Search Types ──────────────────────────────────────────────────────

export interface SearchResult {
  type: 'issue' | 'wiki' | 'post' | 'user' | 'project';
  id: number | string;
  title: string;
  description?: string;
  project_id?: number | string;
  project_name?: string;
  created_at: string;
  updated_at: string;
}

// ─── Admin Types ───────────────────────────────────────────────────────

export interface OrganizationSettings {
  name: string;
  domain: string;
  description?: string;
  logo_url?: string;
  default_language?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
}

export interface Department {
  id: number | string;
  name: string;
  parent_id?: number | string;
  parent_name?: string;
  description?: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDepartmentRequest {
  name: string;
  parent_id?: number | string | null;
  description?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  parent_id?: number | string | null;
  description?: string;
}

export interface DepartmentMember {
  id: number | string;
  department_id: number | string;
  user_id: number | string;
  role: 'member' | 'manager';
  user?: User;
  created_at: string;
}

// ─── Attachment Types ──────────────────────────────────────────────────

export interface Attachment {
  id: number | string;
  filename: string;
  disk_filename?: string;
  filesize: number;
  content_type?: string;
  description?: string;
  author_id?: number | string;
  author_login?: string;
  author_name?: string;
  issue_id?: number | string;
  wiki_page_id?: number | string;
  post_id?: number | string;
  comment_id?: number | string;
  memo_id?: string;
  created_at: string;
}

// ─── Dashboard Types ───────────────────────────────────────────────────

export interface DashboardStats {
  projects_count: number;
  issues_count: number;
  open_issues_count: number;
  closed_issues_count: number;
  tasks_count: number;
  posts_count: number;
  wiki_pages_count: number;
  members_count: number;
  recent_activity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  user_id: number | string;
  user_name?: string;
  project_id?: number | string;
  project_name?: string;
  created_at: string;
}

// ─── Gantt Chart Types ─────────────────────────────────────────────────

export interface GanttIssue {
  id: number | string;
  subject: string;
  status: string;
  priority: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  done_ratio: number;
  assignee_name?: string;
  assignee_id?: number | string;
}