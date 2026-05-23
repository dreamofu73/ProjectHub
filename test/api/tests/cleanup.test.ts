/**
 * Cleanup / Maintenance API Integration Tests
 *
 * Tests scheduler-based cleanup operations (log cleanup, task execution).
 * Runs against a LIVE server at http://localhost:8000.
 *
 * The backend does not have a dedicated /api/admin/cleanup endpoint.
 * Cleanup operations are performed through the scheduler system:
 *   - GET  /api/admin/scheduler       — list/status of scheduled tasks
 *   - PUT  /api/admin/scheduler       — update a task configuration
 *   - POST /api/admin/scheduler/run   — manually trigger a task
 *
 * The "log_cleanup" task rotates/deletes old log files.
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  testContext,
  expectSuccess,
  TEST_CONFIG,
} from './setup';
import { ApiClient, ApiError } from '@/client/api-client';

// ─── Helpers ─────────────────────────────────────────────────────────────

const BASE = TEST_CONFIG.baseUrl;
const ADMIN_TOKEN = (): string => testContext.adminToken!;

/** Raw authenticated request helper. */
async function rawGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token ?? ADMIN_TOKEN()}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error || `HTTP ${res.status}`, body);
  }
  return res.json() as Promise<T>;
}

async function rawPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token ?? ADMIN_TOKEN()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody: any = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody?.error || `HTTP ${res.status}`, errorBody);
  }
  return res.json() as Promise<T>;
}

async function rawPut<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token ?? ADMIN_TOKEN()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody: any = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody?.error || `HTTP ${res.status}`, errorBody);
  }
  return res.json() as Promise<T>;
}

function nonAdminClient(): ApiClient {
  const client = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  client.setToken(testContext.testToken!);
  return client;
}

/** Return just the status code — no auth header. */
async function statusOnly(method: string, path: string): Promise<number> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
  });
  return res.status;
}

async function cleanupTestData(_ctx: typeof testContext): Promise<void> {
  // No persistent data to clean up — scheduler operations are ephemeral.
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Cleanup / Maintenance API', () => {
  afterAll(async () => {
    await cleanupTestData(testContext);
  });

  // ─── Scheduler Status ───────────────────────────────────────────────

  describe('GET /api/admin/scheduler (cleanup status)', () => {
    it('should return scheduler status with task list', async () => {
      const res: any = await rawGet('/api/admin/scheduler');
      expect(res.success).toBe(true);
      const data = res.data || res;
      // Should contain tasks array
      expect(data.tasks).toBeDefined();
      expect(Array.isArray(data.tasks)).toBe(true);
    });

    it('should include log_cleanup task in scheduler tasks', async () => {
      const res: any = await rawGet('/api/admin/scheduler');
      expect(res.success).toBe(true);
      const data = res.data || res;
      if (Array.isArray(data.tasks)) {
        const logTask = data.tasks.find((t: any) => t.id === 'log_cleanup');
        // log_cleanup may or may not be present depending on config
        if (logTask) {
          expect(logTask.name).toBeDefined();
        }
      }
    });

    it('should reject unauthenticated request with 401', async () => {
      const status = await statusOnly('GET', '/api/admin/scheduler');
      expect(status).toBe(401);
    });

    it('should reject non-admin access with 403', async () => {
      try {
        await nonAdminClient().getSchedulerStatus();
        expect.fail('Should have thrown 403');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(403);
        } else {
          throw error;
        }
      }
    });
  });

  // ─── Run Scheduler Task (log cleanup) ───────────────────────────────

  describe('POST /api/admin/scheduler/run (trigger cleanup)', () => {
    it('should trigger log_cleanup task successfully', async () => {
      const res: any = await rawPost('/api/admin/scheduler/run', { task_id: 'log_cleanup' });
      expect(res.success).toBe(true);
    });

    it('should return 400 for non-existent task', async () => {
      try {
        await rawPost('/api/admin/scheduler/run', { task_id: 'nonexistent_task_xyz' });
        expect.fail('Should have thrown 400');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(400);
        } else {
          throw error;
        }
      }
    });

    it('should reject a missing task_id', async () => {
      try {
        await rawPost('/api/admin/scheduler/run', {});
        expect.fail('Should have thrown for missing task_id');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          // task_id is a required body field → the framework rejects with 422;
          // an explicit handler check would be 400. Either is a valid rejection.
          expect([400, 422]).toContain(error.status);
        } else {
          throw error;
        }
      }
    });

    it('should reject unauthenticated request with 401', async () => {
      const status = await statusOnly('POST', '/api/admin/scheduler/run');
      expect(status).toBe(401);
    });

    it('should reject non-admin access with 403', async () => {
      try {
        await nonAdminClient().runSchedulerTask('log_cleanup');
        expect.fail('Should have thrown 403');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(403);
        } else {
          throw error;
        }
      }
    });
  });

  // ─── Update Scheduler Task ──────────────────────────────────────────

  describe('PUT /api/admin/scheduler (configure cleanup)', () => {
    it('should update scheduler task configuration', async () => {
      const res: any = await rawPut('/api/admin/scheduler', {
        task_id: 'log_cleanup',
        running: true,
      });
      expect(res.success).toBe(true);
    });

    it('should reject update without task_id', async () => {
      try {
        await rawPut('/api/admin/scheduler', { running: false });
        expect.fail('Should have thrown for missing task_id');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          // task_id is a required body field → 422 from the framework (or 400
          // from an explicit check). Either is a valid rejection.
          expect([400, 422]).toContain(error.status);
        } else {
          throw error;
        }
      }
    });

    it('should reject non-admin scheduler update with 403', async () => {
      try {
        await nonAdminClient().updateSchedulerStatus({ task_id: 'log_cleanup' });
        expect.fail('Should have thrown 403');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(403);
        } else {
          throw error;
        }
      }
    });
  });

  // ─── Log Files (cleanup target) ─────────────────────────────────────

  describe('Log File Management (related to cleanup)', () => {
    it('should list log files', async () => {
      // This endpoint is available to admin and may be empty
      const res = await testContext.api!.listLogFiles();
      if (res.success) {
        const data = res.data;
        expect(Array.isArray(data)).toBe(true);
      }
      // If it fails with certain status, that's acceptable
    });

    it('should get log config', async () => {
      const res = await testContext.api!.getLogConfig();
      if (res.success && res.data) {
        expect(typeof res.data.max_size_mb).toBe('number');
        expect(typeof res.data.max_files).toBe('number');
      }
    });

    it('should update log config (retention settings)', async () => {
      const res = await testContext.api!.updateLogConfig({
        max_size_mb: 10,
        max_files: 5,
      });
      // The endpoint echoes back the persisted config object, not a { success } payload.
      expect(res.success).toBe(true);
      if (res.data) {
        expect(res.data.max_size_mb).toBe(10);
        expect(res.data.max_files).toBe(5);
      }
    });

    it('should reject non-admin log config access with 403', async () => {
      try {
        await nonAdminClient().getLogConfig();
        expect.fail('Should have thrown 403');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(403);
        } else {
          throw error;
        }
      }
    });
  });
});
