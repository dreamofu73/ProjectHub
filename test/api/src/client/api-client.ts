/**
 * Type-safe API client for ProjectHub backend testing
 */

import type {
  // Auth
  User,
  // Projects
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  // Issues
  Issue,
  CreateIssueRequest,
  UpdateIssueRequest,
  // Custom Fields
  CustomField,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
  CustomFieldValueInput,
  SaveCustomValuesRequest,
  // Milestones
  Milestone,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
  // Wiki
  WikiPage,
  CreateWikiPageRequest,
  UpdateWikiPageRequest,
  WikiVersion,
  // Posts
  Post,
  CreatePostRequest,
  UpdatePostRequest,
  // Comments
  Comment,
  CreateCommentRequest,
  UpdateCommentRequest,
  // Groups
  Group,
  CreateGroupRequest,
  UpdateGroupRequest,
  GroupMember,
  AddGroupMemberRequest,
  UpdateGroupMemberRequest,
  GroupShare,
  CreateGroupShareRequest,
  // Address Book
  AddressBookGroup,
  CreateAddressBookGroupRequest,
  UpdateAddressBookGroupRequest,
  AddressBookMember,
  AddAddressBookMembersRequest,
  // Tasks
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  // Memos
  Memo,
  CreateMemoRequest,
  UpdateMemoRequest,
  // Notifications
  Notification,
  // Search
  SearchResult,
  // Admin
  OrganizationSettings,
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentMember,
  // Dashboard
  DashboardStats,
  // Gantt
  GanttIssue,
  // Common
  ApiResponse,
  Attachment,
} from '../types';

export interface ApiClientConfig {
  baseUrl: string;
  token?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

export class ApiClient {
  private baseUrl: string;
  private defaultToken?: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.defaultToken = config.token;
  }

  setToken(token: string) {
    this.defaultToken = token;
  }

  clearToken() {
    this.defaultToken = undefined;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, token = this.defaultToken } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseBody = await response.text();

    let data: unknown;
    try {
      data = responseBody ? JSON.parse(responseBody) : null;
    } catch {
      data = responseBody;
    }

    if (!response.ok) {
      const error = data as { error?: string; success?: boolean };
      throw new ApiError(
        response.status,
        error?.error || `HTTP ${response.status}: ${response.statusText}`,
        data
      );
    }

    return data as ApiResponse<T>;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────

  async login(login: string, password: string): Promise<ApiResponse<{ token: string; user: User }>> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: { login, password },
    });
  }

  async register(data: {
    login: string;
    password: string;
    firstname: string;
    lastname: string;
    email: string;
  }): Promise<ApiResponse<{ token: string; user: User }>> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request('/api/auth/me');
  }

  // ─── Users ────────────────────────────────────────────────────────────

  async listUsers(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<User[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    return this.request(`/api/users?${query.toString()}`);
  }

  async getUser(id: number | string): Promise<ApiResponse<User>> {
    return this.request(`/api/users/${id}`);
  }

  async createUser(data: Partial<User> & { login: string; password: string }): Promise<ApiResponse<User>> {
    return this.request('/api/users', { method: 'POST', body: data });
  }

  async updateUser(id: number | string, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.request(`/api/users/${id}`, { method: 'PUT', body: data });
  }

  async deleteUser(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/users/${id}`, { method: 'DELETE' });
  }

  // ─── Projects ─────────────────────────────────────────────────────────

  async listProjects(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<Project[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    return this.request(`/api/projects?${query.toString()}`);
  }

  async getProject(id: number | string): Promise<ApiResponse<Project>> {
    return this.request(`/api/projects/${id}`);
  }

  async createProject(data: CreateProjectRequest): Promise<ApiResponse<Project>> {
    return this.request('/api/projects', { method: 'POST', body: data });
  }

  async updateProject(id: number | string, data: UpdateProjectRequest): Promise<ApiResponse<Project>> {
    return this.request(`/api/projects/${id}`, { method: 'PUT', body: data });
  }

  async deleteProject(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/projects/${id}`, { method: 'DELETE' });
  }

  async listProjectMembers(projectId: number | string): Promise<ApiResponse<ProjectMember[]>> {
    return this.request(`/api/projects/${projectId}/members`);
  }

  async addProjectMember(projectId: number | string, userId: number | string, role?: string): Promise<ApiResponse<ProjectMember>> {
    return this.request(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: { user_id: userId, role },
    });
  }

  async updateProjectMember(projectId: number | string, userId: number | string, role: string): Promise<ApiResponse<ProjectMember>> {
    return this.request(`/api/projects/${projectId}/members/${userId}`, {
      method: 'PUT',
      body: { role },
    });
  }

  async removeProjectMember(projectId: number | string, userId: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
  }

  // ─── Issues ───────────────────────────────────────────────────────────

  async listIssues(params?: {
    project_id?: number | string;
    status?: string;
    tracker?: string;
    assigned_to_id?: number | string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Issue[]>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', String(params.project_id));
    if (params?.status) query.set('status', params.status);
    if (params?.tracker) query.set('tracker', params.tracker);
    if (params?.assigned_to_id) query.set('assigned_to_id', String(params.assigned_to_id));
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request(`/api/issues?${query.toString()}`);
  }

  async getIssue(id: number | string): Promise<ApiResponse<Issue>> {
    return this.request(`/api/issues/${id}`);
  }

  async createIssue(data: CreateIssueRequest): Promise<ApiResponse<Issue>> {
    return this.request('/api/issues', { method: 'POST', body: data });
  }

  async updateIssue(id: number | string, data: UpdateIssueRequest): Promise<ApiResponse<Issue>> {
    return this.request(`/api/issues/${id}`, { method: 'PUT', body: data });
  }

  async deleteIssue(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/issues/${id}`, { method: 'DELETE' });
  }

  // ─── Issue Custom Fields ──────────────────────────────────────────────

  async listCustomFields(projectId: number | string): Promise<ApiResponse<CustomField[]>> {
    return this.request(`/api/projects/${projectId}/custom-fields`);
  }

  async createCustomField(projectId: number | string, data: CreateCustomFieldRequest): Promise<ApiResponse<CustomField>> {
    return this.request(`/api/projects/${projectId}/custom-fields`, { method: 'POST', body: data });
  }

  async updateCustomField(projectId: number | string, fieldId: number | string, data: UpdateCustomFieldRequest): Promise<ApiResponse<CustomField>> {
    return this.request(`/api/projects/${projectId}/custom-fields/${fieldId}`, { method: 'PUT', body: data });
  }

  async deleteCustomField(projectId: number | string, fieldId: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/projects/${projectId}/custom-fields/${fieldId}`, { method: 'DELETE' });
  }

  async getCustomValues(issueId: number | string): Promise<ApiResponse<Record<string, string>>> {
    return this.request(`/api/issues/${issueId}/custom-values`);
  }

  async saveCustomValues(issueId: number | string, data: SaveCustomValuesRequest): Promise<ApiResponse<Record<string, string>>> {
    return this.request(`/api/issues/${issueId}/custom-values`, { method: 'PUT', body: data });
  }

  // ─── Milestones ───────────────────────────────────────────────────────

  async listMilestones(params?: { project_id?: number | string; status?: string }): Promise<ApiResponse<Milestone[]>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', String(params.project_id));
    if (params?.status) query.set('status', params.status);
    return this.request(`/api/milestones?${query.toString()}`);
  }

  async getMilestone(id: number | string): Promise<ApiResponse<Milestone>> {
    return this.request(`/api/milestones/${id}`);
  }

  async createMilestone(data: CreateMilestoneRequest): Promise<ApiResponse<Milestone>> {
    return this.request('/api/milestones', { method: 'POST', body: data });
  }

  async updateMilestone(id: number | string, data: UpdateMilestoneRequest): Promise<ApiResponse<Milestone>> {
    return this.request(`/api/milestones/${id}`, { method: 'PUT', body: data });
  }

  async deleteMilestone(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/milestones/${id}`, { method: 'DELETE' });
  }

  // ─── Wiki ─────────────────────────────────────────────────────────────

  async listWikiPages(params?: { project_id?: number | string }): Promise<ApiResponse<WikiPage[]>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', String(params.project_id));
    return this.request(`/api/wiki?${query.toString()}`);
  }

  async getWikiPage(id: number | string): Promise<ApiResponse<WikiPage>> {
    return this.request(`/api/wiki/${id}`);
  }

  async createWikiPage(data: CreateWikiPageRequest): Promise<ApiResponse<WikiPage>> {
    return this.request('/api/wiki', { method: 'POST', body: data });
  }

  async updateWikiPage(id: number | string, data: UpdateWikiPageRequest): Promise<ApiResponse<WikiPage>> {
    return this.request(`/api/wiki/${id}`, { method: 'PUT', body: data });
  }

  async deleteWikiPage(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/wiki/${id}`, { method: 'DELETE' });
  }

  async listWikiVersions(wikiId: number | string): Promise<ApiResponse<WikiVersion[]>> {
    return this.request(`/api/wiki/${wikiId}/versions`);
  }

  async restoreWikiVersion(wikiId: number | string, versionId: number | string): Promise<ApiResponse<WikiPage>> {
    return this.request(`/api/wiki/${wikiId}/versions/${versionId}/restore`, { method: 'POST' });
  }

  // ─── Posts ────────────────────────────────────────────────────────────

  async listPosts(params?: { project_id?: number | string; category?: string; page?: number; limit?: number }): Promise<ApiResponse<Post[]>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', String(params.project_id));
    if (params?.category) query.set('category', params.category);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request(`/api/posts?${query.toString()}`);
  }

  async getPost(id: number | string): Promise<ApiResponse<Post>> {
    return this.request(`/api/posts/${id}`);
  }

  async createPost(data: CreatePostRequest): Promise<ApiResponse<Post>> {
    return this.request('/api/posts', { method: 'POST', body: data });
  }

  async updatePost(id: number | string, data: UpdatePostRequest): Promise<ApiResponse<Post>> {
    return this.request(`/api/posts/${id}`, { method: 'PUT', body: data });
  }

  async deletePost(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/posts/${id}`, { method: 'DELETE' });
  }

  // ─── Post Comments ────────────────────────────────────────────────────

  async listPostComments(postId: number | string): Promise<ApiResponse<Comment[]>> {
    return this.request(`/api/posts/${postId}/comments`);
  }

  async createPostComment(postId: number | string, data: CreateCommentRequest): Promise<ApiResponse<Comment>> {
    return this.request(`/api/posts/${postId}/comments`, { method: 'POST', body: data });
  }

  async updatePostComment(commentId: number | string, data: UpdateCommentRequest): Promise<ApiResponse<Comment>> {
    return this.request(`/api/posts/comments/${commentId}`, { method: 'PUT', body: data });
  }

  async deletePostComment(commentId: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/posts/comments/${commentId}`, { method: 'DELETE' });
  }

  // ─── Issue Comments ──────────────────────────────────────────────────

  async listIssueComments(issueId: number | string): Promise<ApiResponse<Comment[]>> {
    return this.request(`/api/issues/${issueId}/comments`);
  }

  async createIssueComment(issueId: number | string, data: CreateCommentRequest): Promise<ApiResponse<Comment>> {
    return this.request(`/api/issues/${issueId}/comments`, { method: 'POST', body: data });
  }

  async updateIssueComment(commentId: number | string, data: UpdateCommentRequest): Promise<ApiResponse<Comment>> {
    return this.request(`/api/issues/comments/${commentId}`, { method: 'PUT', body: data });
  }

  async deleteIssueComment(commentId: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/issues/comments/${commentId}`, { method: 'DELETE' });
  }

  // ─── Groups ──────────────────────────────────────────────────────────

  async listGroups(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<Group[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    return this.request(`/api/groups?${query.toString()}`);
  }

  async getGroup(id: number | string): Promise<ApiResponse<Group>> {
    return this.request(`/api/groups/${id}`);
  }

  async createGroup(data: CreateGroupRequest): Promise<ApiResponse<Group>> {
    return this.request('/api/groups', { method: 'POST', body: data });
  }

  async updateGroup(id: number | string, data: UpdateGroupRequest): Promise<ApiResponse<Group>> {
    return this.request(`/api/groups/${id}`, { method: 'PUT', body: data });
  }

  async deleteGroup(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/groups/${id}`, { method: 'DELETE' });
  }

  async transferGroup(id: number | string, ownerId: number | string): Promise<ApiResponse<Group>> {
    // Backend groups::transfer_group reads `new_owner_id`.
    return this.request(`/api/groups/${id}/transfer`, { method: 'POST', body: { new_owner_id: ownerId } });
  }

  async listGroupMembers(groupId: number | string): Promise<ApiResponse<GroupMember[]>> {
    return this.request(`/api/groups/${groupId}/members`);
  }

  async addGroupMember(groupId: number | string, data: AddGroupMemberRequest): Promise<ApiResponse<GroupMember>> {
    // Backend groups::add_member expects `user_ids` (array); role is optional.
    return this.request(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: { user_ids: [data.user_id], role: data.role },
    });
  }

  async updateGroupMember(groupId: number | string, userId: number | string, data: UpdateGroupMemberRequest): Promise<ApiResponse<GroupMember>> {
    return this.request(`/api/groups/${groupId}/members/${userId}`, { method: 'PUT', body: data });
  }

  async removeGroupMember(groupId: number | string, userId: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
  }

  async listGroupShares(groupId: number | string): Promise<ApiResponse<GroupShare[]>> {
    return this.request(`/api/groups/${groupId}/shares`);
  }

  async createGroupShare(groupId: number | string, data: CreateGroupShareRequest): Promise<ApiResponse<GroupShare>> {
    return this.request(`/api/groups/${groupId}/shares`, { method: 'POST', body: data });
  }

  async deleteGroupShare(groupId: number | string, shareId: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/groups/${groupId}/shares/${shareId}`, { method: 'DELETE' });
  }

  async createGroupChatRoom(groupId: number | string): Promise<ApiResponse<{ id: number; name: string }>> {
    return this.request(`/api/groups/${groupId}/chat-room`, { method: 'POST' });
  }

  // ─── Address Book ────────────────────────────────────────────────────

  async listAddressBookGroups(): Promise<ApiResponse<AddressBookGroup[]>> {
    return this.request('/api/address-book/groups');
  }

  async getAddressBookGroup(id: number | string): Promise<ApiResponse<AddressBookGroup>> {
    return this.request(`/api/address-book/groups/${id}`);
  }

  async createAddressBookGroup(data: CreateAddressBookGroupRequest): Promise<ApiResponse<AddressBookGroup>> {
    return this.request('/api/address-book/groups', { method: 'POST', body: data });
  }

  async updateAddressBookGroup(id: number | string, data: UpdateAddressBookGroupRequest): Promise<ApiResponse<AddressBookGroup>> {
    return this.request(`/api/address-book/groups/${id}`, { method: 'PUT', body: data });
  }

  async deleteAddressBookGroup(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/address-book/groups/${id}`, { method: 'DELETE' });
  }

  async listAddressBookMembers(groupId: number | string): Promise<ApiResponse<AddressBookMember[]>> {
    return this.request(`/api/address-book/groups/${groupId}/members`);
  }

  async addAddressBookMembers(groupId: number | string, data: AddAddressBookMembersRequest): Promise<ApiResponse<{ added: number; skipped: number }>> {
    return this.request(`/api/address-book/groups/${groupId}/members`, { method: 'POST', body: data });
  }

  async removeAddressBookMember(groupId: number | string, userId: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/address-book/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
  }

  // ─── Tasks ────────────────────────────────────────────────────────────

  async listTasks(params?: { project_id?: number | string; status?: string; assignee_id?: number | string }): Promise<ApiResponse<Task[]>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', String(params.project_id));
    if (params?.status) query.set('status', params.status);
    if (params?.assignee_id) query.set('assignee_id', String(params.assignee_id));
    return this.request(`/api/tasks?${query.toString()}`);
  }

  async getTask(id: number | string): Promise<ApiResponse<Task>> {
    return this.request(`/api/tasks/${id}`);
  }

  async createTask(data: CreateTaskRequest): Promise<ApiResponse<Task>> {
    return this.request('/api/tasks', { method: 'POST', body: data });
  }

  async updateTask(id: number | string, data: UpdateTaskRequest): Promise<ApiResponse<Task>> {
    return this.request(`/api/tasks/${id}`, { method: 'PUT', body: data });
  }

  async deleteTask(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  // ─── Memos ────────────────────────────────────────────────────────────

  async listReceivedMemos(params?: { folder_id?: string; page?: number; limit?: number }): Promise<ApiResponse<Memo[]>> {
    const query = new URLSearchParams();
    if (params?.folder_id) query.set('folder_id', params.folder_id);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request(`/api/memos/received?${query.toString()}`);
  }

  async listSentMemos(params?: { folder_id?: string; page?: number; limit?: number }): Promise<ApiResponse<Memo[]>> {
    const query = new URLSearchParams();
    if (params?.folder_id) query.set('folder_id', params.folder_id);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request(`/api/memos/sent?${query.toString()}`);
  }

  async getMemo(id: string): Promise<ApiResponse<Memo>> {
    return this.request(`/api/memos/${id}`);
  }

  async createMemo(data: CreateMemoRequest): Promise<ApiResponse<{ memo_ids: string[] }>> {
    // Backend memos::send_memo expects `receiver_ids` (array) and returns { data: { memo_ids } }.
    return this.request('/api/memos', {
      method: 'POST',
      body: { receiver_ids: [data.receiver_id], title: data.title, content: data.content },
    });
  }

  async updateMemo(id: string, data: UpdateMemoRequest): Promise<ApiResponse<Memo>> {
    return this.request(`/api/memos/${id}`, { method: 'PUT', body: data });
  }

  async deleteMemo(id: string): Promise<ApiResponse<null>> {
    return this.request(`/api/memos/${id}`, { method: 'DELETE' });
  }

  // ─── Notifications ────────────────────────────────────────────────────

  async listNotifications(params?: { unread_only?: boolean; page?: number; limit?: number }): Promise<ApiResponse<Notification[]>> {
    const query = new URLSearchParams();
    if (params?.unread_only) query.set('unread_only', 'true');
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request(`/api/notifications?${query.toString()}`);
  }

  async markNotificationRead(id: string): Promise<ApiResponse<Notification>> {
    return this.request(`/api/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead(): Promise<ApiResponse<{ count: number }>> {
    return this.request('/api/notifications/read-all', { method: 'PUT' });
  }

  // ─── Search ──────────────────────────────────────────────────────────

  async search(query: string, params?: { types?: string[]; project_id?: number | string }): Promise<ApiResponse<SearchResult[]>> {
    const searchParams = new URLSearchParams();
    searchParams.set('q', query);
    if (params?.types) searchParams.set('types', params.types.join(','));
    if (params?.project_id) searchParams.set('project_id', String(params.project_id));
    return this.request(`/api/search?${searchParams.toString()}`);
  }

  // ─── Dashboard ───────────────────────────────────────────────────────

  async getDashboard(): Promise<ApiResponse<DashboardStats>> {
    return this.request('/api/dashboard');
  }

  // ─── Gantt Chart ─────────────────────────────────────────────────────

  async getGanttData(projectId: number | string): Promise<ApiResponse<GanttIssue[]>> {
    return this.request(`/api/projects/${projectId}/gantt`);
  }

  // ─── Admin - Organization ────────────────────────────────────────────

  async getOrganizationSettings(): Promise<ApiResponse<OrganizationSettings>> {
    return this.request('/api/admin/organization/settings');
  }

  async updateOrganizationSettings(data: Partial<OrganizationSettings>): Promise<ApiResponse<OrganizationSettings>> {
    return this.request('/api/admin/organization/settings', { method: 'PUT', body: data });
  }

  async listDepartments(): Promise<ApiResponse<Department[]>> {
    return this.request('/api/admin/organization/departments');
  }

  async getDepartment(id: number | string): Promise<ApiResponse<Department>> {
    return this.request(`/api/admin/organization/departments/${id}`);
  }

  async createDepartment(data: CreateDepartmentRequest): Promise<ApiResponse<Department>> {
    return this.request('/api/admin/organization/departments', { method: 'POST', body: data });
  }

  async updateDepartment(id: number | string, data: UpdateDepartmentRequest): Promise<ApiResponse<Department>> {
    return this.request(`/api/admin/organization/departments/${id}`, { method: 'PUT', body: data });
  }

  async deleteDepartment(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/admin/organization/departments/${id}`, { method: 'DELETE' });
  }

  async listDepartmentMembers(departmentId: number | string): Promise<ApiResponse<DepartmentMember[]>> {
    return this.request(`/api/admin/organization/departments/${departmentId}/members`);
  }

  // ─── Admin - Scheduler ───────────────────────────────────────────────

  async getSchedulerStatus(): Promise<ApiResponse<{ tasks: unknown[] }>> {
    return this.request('/api/admin/scheduler');
  }

  async updateSchedulerStatus(data: { task_id: string; running?: boolean; cron_expression?: string }): Promise<ApiResponse<unknown>> {
    return this.request('/api/admin/scheduler', { method: 'PUT', body: data });
  }

  async runSchedulerTask(taskId: string): Promise<ApiResponse<unknown>> {
    return this.request('/api/admin/scheduler/run', { method: 'POST', body: { task_id: taskId } });
  }

  // ─── Admin - Logs ────────────────────────────────────────────────────

  async listLogFiles(): Promise<ApiResponse<{ name: string; size: number; modified: string }[]>> {
    return this.request('/api/admin/logs/files');
  }

  async getLogFile(filename: string, lines?: number): Promise<ApiResponse<{ content: string }>> {
    const query = new URLSearchParams();
    if (lines) query.set('lines', String(lines));
    return this.request(`/api/admin/logs/files/${filename}?${query.toString()}`);
  }

  async getLogConfig(): Promise<ApiResponse<{ max_size_mb: number; max_files: number; retention_days: number }>> {
    return this.request('/api/admin/logs/config');
  }

  async updateLogConfig(data: { max_size_mb?: number; max_files?: number; retention_days?: number }): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/api/admin/logs/config', { method: 'PUT', body: data });
  }

  // ─── Admin - Groups ──────────────────────────────────────────────────

  async adminListGroups(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<Group[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    return this.request(`/api/admin/groups?${query.toString()}`);
  }

  async adminGetGroup(id: number | string): Promise<ApiResponse<Group>> {
    return this.request(`/api/admin/groups/${id}`);
  }

  async adminDeleteGroup(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/admin/groups/${id}`, { method: 'DELETE' });
  }

  // ─── Attachments ─────────────────────────────────────────────────────

  async uploadAttachment(file: File, referenceType: string, referenceId: number | string): Promise<ApiResponse<Attachment>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reference_type', referenceType);
    formData.append('reference_id', String(referenceId));

    const response = await fetch(`${this.baseUrl}/api/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.defaultToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
      throw new ApiError(response.status, error?.error || 'Upload failed', error);
    }

    return response.json() as Promise<ApiResponse<Attachment>>;
  }

  async deleteAttachment(id: number | string): Promise<ApiResponse<null>> {
    return this.request(`/api/attachments/${id}`, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Additional Types for Client ────────────────────────────────────────

export interface ProjectMember {
  id: number | string;
  project_id: number | string;
  user_id: number | string;
  role: string;
  user?: User;
  created_at: string;
}