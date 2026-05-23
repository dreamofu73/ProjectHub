/**
 * API utility that automatically includes Authorization header
 * from localStorage token.
 *
 * 401 응답은 토큰을 비우고 /login으로 리다이렉트.
 *
 * Tauri (데스크톱) 환경에서는 저장된 백엔드 서버 주소를 Base URL로 사용하고,
 * 브라우저 환경에서는 상대 경로(/api/...)를 그대로 사용한다.
 */

import { getBackendUrl, isTauri } from './desktop-config';
import type {
  Group, GroupMember, GroupResourceShare,
  CreateGroupPayload, AddMembersPayload, CreateSharePayload,
  ApiResponse,
} from '../types';
import type { OrganizationSettings, Department, DepartmentMember, AddressBookGroup, AddressBookMember } from '../types/organization';

// ---------------------------------------------------------------------------
// Base URL resolution (Tauri desktop only)
// ---------------------------------------------------------------------------

let cachedBaseUrl: string | null | undefined;

async function resolveBaseUrl(): Promise<string> {
  if (cachedBaseUrl !== undefined) return cachedBaseUrl ?? '';

  if (isTauri()) {
    const url = await getBackendUrl();
    cachedBaseUrl = url ? url.replace(/\/+$/, '') : '';
  } else {
    cachedBaseUrl = '';
  }
  return cachedBaseUrl;
}

/** Reset the cached base URL (useful after config changes). */
export function resetBaseUrl(): void {
  cachedBaseUrl = undefined;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
      };
    }
  } catch {
    // localStorage 접근 불가 환경
  }
  return {};
}

function handleUnauthorized() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

// ---------------------------------------------------------------------------
// fetch wrapper
// ---------------------------------------------------------------------------

/**
 * fetch wrapper. localStorage 토큰을 자동 부착하고,
 * 401 응답은 즉시 로그아웃 + /login 으로 이동시킨다.
 *
 * Tauri 환경에서는 저장된 백엔드 URL을 앞에 자동으로 붙인다.
 */
export async function api(url: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = await resolveBaseUrl();
  const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };

  if (options.headers) {
    const existing = options.headers as Record<string, string>;
    for (const [k, v] of Object.entries(existing)) {
      headers[k] = v;
    }
  }

  const res = await fetch(fullUrl, { ...options, headers });
  if (res.status === 401) {
    handleUnauthorized();
  }
  if (!res.ok) {
    return normalizeErrorResponse(res);
  }
  return res;
}

/**
 * 오류 응답 본문을 프로젝트 공통 `{ success, error }` JSON 형태로 정규화한다.
 *
 * 백엔드는 대부분 JSON 으로 오류를 돌려주지만, axum 의 추출 단계에서 거부되면
 * 평문이 온다(예: 422 + "Failed to deserialize the JSON body into the target type").
 * 호출부는 대개 `await res.json()` 을 바로 부르므로, 이때 진짜 원인 대신
 * `Unexpected token 'F'` 같은 파싱 오류가 표시되어 디버깅을 방해한다.
 *
 * 본문은 한 번만 읽을 수 있으므로 읽은 뒤 동일한 상태코드로 재구성해 반환한다.
 */
async function normalizeErrorResponse(res: Response): Promise<Response> {
  let raw = '';
  try {
    raw = await res.text();
  } catch {
    // 본문을 읽을 수 없는 경우(네트워크 중단 등)는 상태코드만으로 메시지를 만든다.
  }

  if (raw) {
    try {
      JSON.parse(raw);
      // 이미 JSON 이면 그대로 돌려준다.
      return new Response(raw, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch {
      // 평문 오류 → 아래에서 JSON 으로 감싼다.
    }
  }

  const detail = raw.trim() || res.statusText || 'Request failed';
  return new Response(
    JSON.stringify({ success: false, error: `HTTP ${res.status}: ${detail}` }),
    {
      status: res.status,
      statusText: res.statusText,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * 토큰이 부착된 fetch로 바이너리/텍스트 리소스를 받아 blob URL로 변환.
 * <a href>, <img src>, <iframe src> 등 헤더를 보낼 수 없는 곳에서 사용.
 * 호출자는 받은 URL을 더 이상 쓰지 않을 때 URL.revokeObjectURL 로 해제해야 한다.
 */
export async function fetchBlobUrl(url: string): Promise<string> {
  const res = await api(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Generic type-safe fetch wrapper that parses the response as JSON.
 */
export async function apiJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await api(url, options);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Group API
// ---------------------------------------------------------------------------

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await api(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const res = await api(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

async function apiDelete<T>(url: string): Promise<T> {
  const res = await api(url, { method: 'DELETE' });
  return res.json() as Promise<T>;
}

export const groupApi = {
  // --- Group CRUD ---
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    apiJson<ApiResponse<Group[]>>(`/api/groups?${new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString()}`),

  create: (payload: CreateGroupPayload) =>
    apiPost<ApiResponse<Group>>('/api/groups', payload),

  get: (id: string) =>
    apiJson<ApiResponse<Group>>(`/api/groups/${id}`),

  update: (id: string, payload: Partial<CreateGroupPayload>) =>
    apiPut<ApiResponse<Group>>(`/api/groups/${id}`, payload),

  delete: (id: string) =>
    apiDelete<ApiResponse<null>>(`/api/groups/${id}`),

  transfer: (id: string, owner_id: string) =>
    apiPost<ApiResponse<Group>>(`/api/groups/${id}/transfer`, { owner_id }),

  // --- Members ---
  listMembers: (groupId: string) =>
    apiJson<ApiResponse<GroupMember[]>>(`/api/groups/${groupId}/members`),

  addMembers: (groupId: string, payload: AddMembersPayload) =>
    apiPost<ApiResponse<GroupMember[]>>(`/api/groups/${groupId}/members`, payload),

  updateMemberRole: (groupId: string, userId: string, role: GroupMember['role']) =>
    apiPut<ApiResponse<GroupMember>>(`/api/groups/${groupId}/members/${userId}`, { role }),

  removeMember: (groupId: string, userId: string) =>
    apiDelete<ApiResponse<null>>(`/api/groups/${groupId}/members/${userId}`),

  // --- Resource Shares ---
  listShares: (groupId: string) =>
    apiJson<ApiResponse<GroupResourceShare[]>>(`/api/groups/${groupId}/shares`),

  createShare: (groupId: string, payload: CreateSharePayload) =>
    apiPost<ApiResponse<GroupResourceShare>>(`/api/groups/${groupId}/shares`, payload),

  deleteShare: (groupId: string, shareId: string) =>
    apiDelete<ApiResponse<null>>(`/api/groups/${groupId}/shares/${shareId}`),

  // --- Chat Room ---
  createChatRoom: (groupId: string) =>
    apiPost<ApiResponse<{ id: string; name: string }>>(`/api/groups/${groupId}/chat-room`, {}),

  // --- Admin ---
  adminList: (params?: { page?: number; limit?: number; search?: string }) =>
    apiJson<ApiResponse<Group[]>>(`/api/admin/groups?${new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString()}`),

  adminGet: (id: string) =>
    apiJson<ApiResponse<Group>>(`/api/admin/groups/${id}`),

  adminDelete: (id: string) =>
    apiDelete<ApiResponse<null>>(`/api/admin/groups/${id}`),
};

// ---------------------------------------------------------------------------
// Organization API
// ---------------------------------------------------------------------------

export const organizationApi = {
  getSettings: () =>
    apiJson<ApiResponse<OrganizationSettings>>('/api/admin/organization/settings'),

  updateSettings: (data: { name: string; domain: string }) =>
    apiPut<ApiResponse<OrganizationSettings>>('/api/admin/organization/settings', data),

  listDepartments: () =>
    apiJson<ApiResponse<Department[]>>('/api/admin/organization/departments'),

  createDepartment: (data: { name: string; parent_id?: string; description?: string }) =>
    apiPost<ApiResponse<Department>>('/api/admin/organization/departments', data),

  getDepartment: (id: string) =>
    apiJson<ApiResponse<Department>>(`/api/admin/organization/departments/${id}`),

  updateDepartment: (id: string, data: { name?: string; parent_id?: string; description?: string }) =>
    apiPut<ApiResponse<Department>>(`/api/admin/organization/departments/${id}`, data),

  deleteDepartment: (id: string) =>
    apiDelete<ApiResponse<null>>(`/api/admin/organization/departments/${id}`),

  getDepartmentMembers: (id: string) =>
    apiJson<ApiResponse<DepartmentMember[]>>(`/api/admin/organization/departments/${id}/members`),
};

// ---------------------------------------------------------------------------
// Scheduler API (Admin)
// ---------------------------------------------------------------------------

export interface TaskStatus {
  id: string;
  name: string;
  running: boolean;
  processing: boolean;
  cron_expression: string;
  last_run: string | null;
  last_run_affected: number | null;
  total_processed: number;
}

export interface SchedulerStatus {
  tasks: TaskStatus[];
}

export const schedulerApi = {
  status: () =>
    apiJson<ApiResponse<SchedulerStatus>>('/api/admin/scheduler'),

  update: (data: { task_id: string; running?: boolean; cron_expression?: string }) =>
    apiPut<ApiResponse<SchedulerStatus>>('/api/admin/scheduler', data),

  runTask: (task_id: string) =>
    apiPost<ApiResponse<SchedulerStatus>>('/api/admin/scheduler/run', { task_id }),
};

export const addressBookApi = {
  listGroups: () =>
    apiJson<ApiResponse<AddressBookGroup[]>>('/api/address-book/groups'),

  createGroup: (data: { name: string }) =>
    apiPost<ApiResponse<AddressBookGroup>>('/api/address-book/groups', data),

  updateGroup: (id: string, data: { name: string }) =>
    apiPut<ApiResponse<AddressBookGroup>>(`/api/address-book/groups/${id}`, data),

  deleteGroup: (id: string) =>
    apiDelete<ApiResponse<null>>(`/api/address-book/groups/${id}`),

  listMembers: (groupId: string) =>
    apiJson<ApiResponse<AddressBookMember[]>>(`/api/address-book/groups/${groupId}/members`),

  addMembers: (groupId: string, data: { user_ids: string[] }) =>
    apiPost<ApiResponse<{ added: number; skipped: number }>>(`/api/address-book/groups/${groupId}/members`, data),

  removeMember: (groupId: string, userId: string) =>
    apiDelete<ApiResponse<null>>(`/api/address-book/groups/${groupId}/members/${userId}`),
};

// ---------------------------------------------------------------------------
// Log Management API
// ---------------------------------------------------------------------------

import type { LogFileInfo, LogFileContent, LogSearchResult, LogTailResult, LogConfig } from '../types';

export const logsApi = {
  listFiles: () =>
    apiJson<ApiResponse<LogFileInfo[]>>('/api/admin/logs/files'),

  getFile: (filename: string, lines?: number) =>
    apiJson<ApiResponse<LogFileContent>>(
      `/api/admin/logs/files/${encodeURIComponent(filename)}${lines ? `?lines=${lines}` : ''}`
    ),

  search: (q: string, file?: string) =>
    apiJson<ApiResponse<LogSearchResult[]>>(
      `/api/admin/logs/search?q=${encodeURIComponent(q)}${file ? `&file=${encodeURIComponent(file)}` : ''}`
    ),

  tail: (offset?: number) =>
    apiJson<ApiResponse<LogTailResult>>(`/api/admin/logs/tail?offset=${offset || 0}`),

  getConfig: () =>
    apiJson<ApiResponse<LogConfig>>('/api/admin/logs/config'),

  updateConfig: (data: Partial<LogConfig>) =>
    apiPut<ApiResponse<LogConfig>>('/api/admin/logs/config', data),

  getLevel: () =>
    apiJson<ApiResponse<{ level: string }>>('/api/admin/logs/level'),

  setLevel: (level: string) =>
    apiPut<ApiResponse<{ level: string }>>('/api/admin/logs/level', { level }),
};
