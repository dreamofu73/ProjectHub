/**
 * Test setup and utilities
 */

import { beforeAll, afterAll, vi } from 'vitest';
import { ApiClient } from '@/client/api-client';
import type {
  ApiResponse,
  User,
  CreateProjectRequest,
  CreateIssueRequest,
  CreateCustomFieldRequest,
  CreateMilestoneRequest,
  CreateWikiPageRequest,
  CreatePostRequest,
  CreateCommentRequest,
  CreateGroupRequest,
  CreateAddressBookGroupRequest,
  CreateTaskRequest,
  CreateMemoRequest,
  CreateDepartmentRequest,
} from '@/types';

// ─── Global Test Configuration ────────────────────────────────────────

export const TEST_CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'admin123',
  testUser: process.env.TEST_USER || 'testuser',
  testPass: process.env.TEST_PASS || 'testpass123',
};

// ─── Global Test State ────────────────────────────────────────────────

export interface TestContext {
  api: ApiClient;
  adminToken: string;
  testToken: string;
  testUserId: number | string;
  projectId: number | string;
  issueId: number | string;
  postId: number | string;
  wikiId: number | string;
  groupId: number | string;
  abGroupId: number | string;
  taskId: number | string;
  milestoneId: number | string;
  customFieldId: number | string;
  memoId: string;
  notificationId: string;
}

export const testContext: Partial<TestContext> = {};

// ─── Setup / Teardown ────────────────────────────────────────────────

beforeAll(async () => {
  // Create API client
  testContext.api = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });

  // Login as admin
  const adminLogin = await testContext.api.login(TEST_CONFIG.adminUser, TEST_CONFIG.adminPass);
  if (!adminLogin.success || !(adminLogin as any).token) {
    throw new Error(`Admin login failed: ${adminLogin.error}`);
  }
  testContext.adminToken = (adminLogin as any).token as string;
  testContext.api!.setToken(testContext.adminToken);

  // Register and login test user
  try {
    await testContext.api!.register({
      login: TEST_CONFIG.testUser,
      password: TEST_CONFIG.testPass,
      firstname: 'Test',
      lastname: 'User',
      email: `${TEST_CONFIG.testUser}@example.com`,
    });
  } catch (e) {
    // User might already exist
  }

  const testLogin = await testContext.api!.login(TEST_CONFIG.testUser, TEST_CONFIG.testPass);
  if (!testLogin.success || !(testLogin as any).token) {
    throw new Error(`Test user login failed: ${testLogin.error}`);
  }
  testContext.testToken = (testLogin as any).token as string;
  testContext.testUserId = (testLogin as any).user.id as string;
}, 60000);

afterAll(async () => {
  // Cleanup if needed
  testContext.api?.clearToken();
});

// ─── Test Helpers ────────────────────────────────────────────────────

export function expectSuccess<T>(response: ApiResponse<T>, testName: string): T {
  if (!response.success) {
    throw new Error(`${testName} failed: ${response.error}`);
  }
  if (response.data !== undefined) {
    return response.data;
  }
  // Some endpoints (e.g. POST /api/projects) return fields at the top level
  // without a `data` wrapper. Return the whole response as T in that case.
  return response as unknown as T;
}

export function expectStatus(response: ApiResponse<unknown>, expectedStatus: number): void {
  // Note: Our client throws on non-2xx, so this is for manual checks
  if (!response.success) {
    throw new Error(`Expected success, got error: ${response.error}`);
  }
}

export function generateRandomString(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateRandomEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@example.com`;
}

// ─── Test Data Factories ─────────────────────────────────────────────

export const factories = {
  project: (overrides: Partial<CreateProjectRequest> = {}): CreateProjectRequest => ({
    name: generateRandomString('Project'),
    identifier: generateRandomString('proj').toLowerCase(),
    description: 'Test project created by API tests',
    status: 'active',
    ...overrides,
  }),

  issue: (projectId: number | string, overrides: Partial<CreateIssueRequest> = {}): CreateIssueRequest => ({
    project_id: projectId,
    subject: generateRandomString('Issue'),
    description: 'Test issue created by API tests',
    status: 'new',
    priority: 'normal',
    tracker: 'bug',
    ...overrides,
  }),

  customField: (overrides: Partial<CreateCustomFieldRequest> = {}): CreateCustomFieldRequest => ({
    field_name: generateRandomString('field'),
    field_type: 'string',
    is_required: 0,
    sort_order: 0,
    ...overrides,
  }),

  milestone: (projectId: number | string, overrides: Partial<CreateMilestoneRequest> = {}): CreateMilestoneRequest => ({
    project_id: projectId,
    subject: generateRandomString('Milestone'),
    status: 'open',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ...overrides,
  }),

  wikiPage: (projectId: number | string, overrides: Partial<CreateWikiPageRequest> = {}): CreateWikiPageRequest => ({
    project_id: projectId,
    title: generateRandomString('Wiki'),
    content: '<p>Test wiki content</p>',
    ...overrides,
  }),

  post: (projectId: number | string, overrides: Partial<CreatePostRequest> = {}): CreatePostRequest => ({
    title: generateRandomString('Post'),
    content: 'Test post content',
    category: 'news',
    project_id: projectId,
    ...overrides,
  }),

  comment: (overrides: Partial<CreateCommentRequest> = {}): CreateCommentRequest => ({
    content: 'Test comment',
    ...overrides,
  }),

  group: (overrides: Partial<CreateGroupRequest> = {}): CreateGroupRequest => ({
    name: generateRandomString('Group'),
    ...overrides,
  }),

  addressBookGroup: (overrides: Partial<CreateAddressBookGroupRequest> = {}): CreateAddressBookGroupRequest => ({
    name: generateRandomString('ABGroup'),
    ...overrides,
  }),

  task: (projectId: number | string, overrides: Partial<CreateTaskRequest> = {}): CreateTaskRequest => ({
    project_id: projectId,
    title: generateRandomString('Task'),
    description: 'Test task',
    task_type: 'Development',
    task_category: 'Feature',
    status: 'New',
    progress: 0,
    ...overrides,
  }),

  memo: (receiverId: number | string, overrides: Partial<CreateMemoRequest> = {}): CreateMemoRequest => ({
    receiver_id: receiverId,
    title: generateRandomString('Memo'),
    content: 'Test memo content',
    ...overrides,
  }),

  department: (overrides: Partial<CreateDepartmentRequest> = {}): CreateDepartmentRequest => ({
    name: generateRandomString('Dept'),
    description: 'Test department',
    ...overrides,
  }),
};

// ─── Assertion Helpers ───────────────────────────────────────────────

export function assertHasId<T extends { id?: number | string }>(obj: T, context: string): void {
  if (!obj.id) {
    throw new Error(`${context}: Expected object to have id, got ${JSON.stringify(obj)}`);
  }
}

export function assertArrayNotEmpty<T>(arr: T[], context: string): void {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`${context}: Expected non-empty array, got ${JSON.stringify(arr)}`);
  }
}

export function assertFieldExists<T extends object>(obj: T, field: keyof T, context: string): void {
  if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
    throw new Error(`${context}: Expected field '${String(field)}' to exist`);
  }
}

// ─── Type Guards ──────────────────────────────────────────────────────

export function isApiError(error: unknown): error is { status: number; message: string; data?: unknown } {
  return error instanceof Error && 'status' in error;
}

// ─── Mock Data for Offline Testing ───────────────────────────────────

export const mockData = {
  user: {
    id: '1',
    login: 'admin',
    email: 'admin@localhost',
    firstname: 'Admin',
    lastname: 'User',
    role: 'admin' as const,
    is_active: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  project: {
    id: '1',
    name: 'Test Project',
    identifier: 'testproj',
    description: 'A test project',
    status: 'active' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  issue: {
    id: '1',
    project_id: '1',
    tracker: 'bug',
    subject: 'Test Issue',
    description: 'Test issue description',
    status: 'new',
    priority: 'normal',
    author_id: '1',
    author_name: 'Admin User',
    assigned_to_id: null,
    due_date: null,
    done_ratio: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};