/**
 * Attachments API Integration Tests
 *
 * Tests upload, download, list, and delete of file attachments.
 * Runs against a LIVE server at http://localhost:8000.
 *
 * NOTE: Attachments use multipart form data via raw fetch since the
 * ApiClient's uploadAttachment method uses a different parameter scheme
 * (reference_type/reference_id) than the backend expects (issue_id, etc.).
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  testContext,
  expectSuccess,
  generateRandomString,
  factories,
  TEST_CONFIG,
} from './setup';
import { ApiClient, ApiError } from '@/client/api-client';
import type { Attachment, Project, Issue } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────

const BASE = TEST_CONFIG.baseUrl;
const ADMIN_TOKEN = (): string => testContext.adminToken!;

/** Raw authenticated fetch helper — throws ApiError on non-2xx. */
async function rawRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    token?: string;
  } = {},
): Promise<T> {
  const { method = 'GET', body = null, headers = {}, token = ADMIN_TOKEN() } = options;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  });
  if (!res.ok) {
    const errorBody: any = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody?.error || `HTTP ${res.status}`, errorBody);
  }
  return res.json() as Promise<T>;
}

/** Upload a small text file as an attachment linked to an issue. */
async function uploadTestAttachment(
  issueId: number | string,
  filename = 'test.txt',
  content = 'Hello from attachment test',
  token?: string,
): Promise<{ id: string; filename: string; filesize: number }> {
  const formData = new FormData();
  formData.append('file', new Blob([content]), filename);
  formData.append('issue_id', String(issueId));
  formData.append('description', 'Test attachment');

  const res = await fetch(`${BASE}/api/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token ?? ADMIN_TOKEN()}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (errorBody as any).error || 'Upload failed', errorBody);
  }

  const json: any = await res.json();
  expect(json.success).toBe(true);
  const data = json.data || json;
  const id = data.id || (data.attachments && data.attachments[0]?.id);
  expect(id).toBeDefined();
  return { id: String(id), filename, filesize: content.length };
}

async function cleanupTestData(_ctx: typeof testContext): Promise<void> {
  // Attachments created during tests are cleaned up by individual delete tests.
  // No persistent data to clean up beyond what individual tests handle.
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Attachments API', () => {
  let projectId: string;
  let issueId: string;

  beforeAll(async () => {
    // Create a test project and issue for attachment endpoints
    const projRes = await testContext.api!.createProject(factories.project());
    expect(projRes.success).toBe(true);
    projectId = String((projRes as any).id);

    const issueData = factories.issue(projectId);
    const issueRes = await testContext.api!.createIssue(issueData);
    const issue = expectSuccess(issueRes, 'Setup issue');
    issueId = String(issue.id);
  }, 30000);

  afterAll(async () => {
    await cleanupTestData(testContext);
  });

  // ─── Upload Attachment ──────────────────────────────────────────────

  describe('POST /api/attachments', () => {
    it('should upload a text file attachment', async () => {
      const result = await uploadTestAttachment(issueId, 'hello.txt', 'Hello, World!');
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.filename).toBe('hello.txt');
      expect(result.filesize).toBeGreaterThan(0);
    });

    it('should upload multiple files in a single request', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['File one content']), 'multi1.txt');
      formData.append('file', new Blob(['File two content']), 'multi2.txt');
      formData.append('issue_id', String(issueId));

      const res = await fetch(`${BASE}/api/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
        body: formData,
      });
      expect(res.ok).toBe(true);
      const json: any = await res.json();
      expect(json.success).toBe(true);
      const data = json.data || json;
      const attachments = data.attachments;
      expect(attachments).toBeDefined();
      expect(Array.isArray(attachments)).toBe(true);
      expect(attachments.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject upload without a file', async () => {
      const formData = new FormData();
      formData.append('issue_id', String(issueId));

      try {
        await fetch(`${BASE}/api/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
          body: formData,
        }).then(async (r) => {
          if (!r.ok) throw new ApiError(r.status, 'No files error');
          return r.json();
        });
        expect.fail('Should have rejected empty upload');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(400);
        } else {
          throw error;
        }
      }
    });

    it('should reject unauthenticated upload with 401', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'unauth.txt');
      formData.append('issue_id', String(issueId));

      const res = await fetch(`${BASE}/api/attachments`, {
        method: 'POST',
        body: formData,
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── Download Attachment ────────────────────────────────────────────

  describe('GET /api/attachments/:id/download', () => {
    it('should download an attachment', async () => {
      const { id } = await uploadTestAttachment(issueId, 'download.txt', 'Download me');

      const res = await fetch(`${BASE}/api/attachments/${id}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
      });
      expect(res.ok).toBe(true);
      expect(res.headers.get('content-disposition')).toContain('download.txt');
      const text = await res.text();
      expect(text).toContain('Download me');
    });

    it('should return 404 for non-existent attachment', async () => {
      const res = await fetch(`${BASE}/api/attachments/99999999`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
      });
      expect(res.status).toBe(404);
    });

    it('should reject unauthenticated download with 401', async () => {
      const { id } = await uploadTestAttachment(issueId, 'authcheck.txt', 'Auth check');
      const res = await fetch(`${BASE}/api/attachments/${id}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── Delete Attachment ──────────────────────────────────────────────

  describe('DELETE /api/attachments/:id', () => {
    it('should delete an attachment', async () => {
      const { id } = await uploadTestAttachment(issueId, 'delete.txt', 'Delete me');

      const delRes = await testContext.api!.deleteAttachment(id);
      expect(delRes.success).toBe(true);

      // Verify deletion — download should return 404
      const getRes = await fetch(`${BASE}/api/attachments/${id}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
      });
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for deleting non-existent attachment', async () => {
      try {
        await testContext.api!.deleteAttachment(99999999);
        expect.fail('Should have thrown 404');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(404);
        } else {
          throw error;
        }
      }
    });

    it('should reject unauthenticated delete with 401', async () => {
      const { id } = await uploadTestAttachment(issueId, 'del-auth.txt', 'Auth delete');
      try {
        const unauthClient = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
        await unauthClient.deleteAttachment(id);
        expect.fail('Should have thrown 401');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(401);
        } else {
          throw error;
        }
      }
    });
  });

  // ─── Batch Download ─────────────────────────────────────────────────

  describe('GET /api/attachments/batch-download', () => {
    it('should batch download attachments by issue_id', async () => {
      // Upload two attachments to the same issue
      await uploadTestAttachment(issueId, 'batch1.txt', 'Batch file 1');
      await uploadTestAttachment(issueId, 'batch2.txt', 'Batch file 2');

      const res = await fetch(`${BASE}/api/attachments/batch-download?issue_id=${issueId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
      });
      expect(res.ok).toBe(true);
      expect(res.headers.get('content-type')).toContain('application/zip');
    });

    it('should return 400 when no target ID is provided', async () => {
      const res = await fetch(`${BASE}/api/attachments/batch-download`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
      });
      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated batch download with 401', async () => {
      const res = await fetch(`${BASE}/api/attachments/batch-download?issue_id=${issueId}`);
      expect(res.status).toBe(401);
    });
  });
});

// ─── 추가 시나리오 (검증 / 권한 / 배치) ────────────────────────────────────

describe('Attachments API - 추가 시나리오', () => {
  let issueId: string;
  let emptyIssueId: string;

  beforeAll(async () => {
    const projRes = await testContext.api!.createProject(factories.project());
    expect(projRes.success).toBe(true);
    const projectId = String((projRes as any).id);

    const issueRes = await testContext.api!.createIssue(factories.issue(projectId));
    const issue = expectSuccess(issueRes, 'Setup issue (추가)');
    issueId = String(issue.id);

    const emptyIssueRes = await testContext.api!.createIssue(factories.issue(projectId));
    const emptyIssue = expectSuccess(emptyIssueRes, 'Setup empty issue (추가)');
    emptyIssueId = String(emptyIssue.id);
  }, 30000);

  it('확장자가 없는 파일 업로드는 400으로 거부한다', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['no extension content']), 'noextfile');
    formData.append('issue_id', String(issueId));

    const res = await fetch(`${BASE}/api/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
      body: formData,
    });
    expect(res.status).toBe(400);
  });

  it('비관리자는 타인이 올린 첨부를 삭제할 수 없다', async () => {
    const { id } = await uploadTestAttachment(issueId, 'owned-by-admin.txt', 'Admin owns this');

    const nonAdminClient = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    nonAdminClient.setToken(testContext.testToken!);
    await expect(nonAdminClient.deleteAttachment(id)).rejects.toThrow();

    // 삭제가 거부되었으므로 관리자 다운로드는 여전히 성공해야 한다
    const getRes = await fetch(`${BASE}/api/attachments/${id}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
    });
    expect(getRes.ok).toBe(true);
  });

  it('대상에 첨부가 없으면 배치 다운로드가 404를 반환한다', async () => {
    const res = await fetch(`${BASE}/api/attachments/batch-download?issue_id=${emptyIssueId}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
    });
    expect(res.status).toBe(404);
  });

  it('attachment_ids로 배치 다운로드하면 zip을 반환한다', async () => {
    const { id } = await uploadTestAttachment(issueId, 'byid.txt', 'Batch by id');

    const res = await fetch(`${BASE}/api/attachments/batch-download?attachment_ids=${id}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN()}` },
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toContain('application/zip');
  });
});
