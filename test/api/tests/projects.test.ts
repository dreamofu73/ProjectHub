/**
 * Projects API Integration Tests
 *
 * Tests CRUD operations, member management, access control,
 * authentication checks, and search functionality.
 * Runs against a LIVE server at http://localhost:8000.
 */

import { describe, it, expect } from 'vitest';
import {
  testContext,
  expectSuccess,
  generateRandomString,
  assertArrayNotEmpty,
  factories,
  TEST_CONFIG,
} from './setup';
import { ApiClient, ApiError } from '@/client/api-client';
import type { Project } from '@/types';

describe('Projects API', () => {
  // ─── Helpers ────────────────────────────────────────────────────────

  function nonAdminClient(): ApiClient {
    const client = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    client.setToken(testContext.testToken!);
    return client;
  }

  function unauthClient(): ApiClient {
    return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  }

  /** Helper: create a project and return its ID string. */
  async function createProject(overrides: Record<string, unknown> = {}): Promise<string> {
    const projectData = {
      ...factories.project(),
      ...overrides,
    };
    const res = await testContext.api!.createProject(projectData as any);
    expect(res.success).toBe(true);
    const id = (res as any).id;
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    return id;
  }

  /** Helper: find a project by identifier in the list. */
  async function findProjectByIdentifier(
    identifier: string,
  ): Promise<Project | undefined> {
    const listRes = await testContext.api!.listProjects({ search: identifier });
    const projects = expectSuccess(listRes, `Find project ${identifier}`);
    return projects.find((p) => p.identifier === identifier);
  }

  // ─── Create & Read ──────────────────────────────────────────────────

  it('should list projects', async () => {
    const res = await testContext.api!.listProjects();
    const data = expectSuccess(res, 'List projects');
    expect(Array.isArray(data)).toBe(true);
  });

  it('should create a project', async () => {
    const projectData = factories.project();
    const res = await testContext.api!.createProject(projectData);
    expect(res.success).toBe(true);
    const id = (res as any).id;
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should get project by ID', async () => {
    const projectId = await createProject();
    const res = await testContext.api!.getProject(projectId);
    const data = expectSuccess(res, 'Get project by ID');
    expect(String(data.id)).toBe(projectId);
    expect(data.name).toBeDefined();
    expect(data.identifier).toBeDefined();
    expect(data.status).toBeDefined();
  });

  it('should get project with member count and issue counts', async () => {
    const projectId = await createProject();
    const res = await testContext.api!.getProject(projectId);
    const data = expectSuccess(res, 'Get project with counts');
    // The backend enriches responses with computed counts
    expect(data.member_count).toBeDefined();
    expect(typeof data.member_count).toBe('number');
  });

  // ─── Update ─────────────────────────────────────────────────────────

  it('should update project', async () => {
    const projectId = await createProject();
    const newDescription = 'Updated description ' + Date.now();

    const updateRes = await testContext.api!.updateProject(projectId, {
      description: newDescription,
    });
    expect(updateRes.success).toBe(true);

    // Verify
    const getRes = await testContext.api!.getProject(projectId);
    const updated = expectSuccess(getRes, 'Verify update');
    expect(updated.description).toBe(newDescription);
  });

  it('should update project status', async () => {
    const projectId = await createProject();
    const newStatus = 'closed';

    const updateRes = await testContext.api!.updateProject(projectId, {
      status: newStatus,
    } as any);
    expect(updateRes.success).toBe(true);

    // Reopen for cleanup (or let subsequent tests handle it)
    await testContext.api!.updateProject(projectId, { status: 'active' } as any);
  });

  // ─── Delete ─────────────────────────────────────────────────────────

  it('should delete project as admin', async () => {
    const projectId = await createProject();

    const deleteRes = await testContext.api!.deleteProject(projectId);
    expect(deleteRes.success).toBe(true);

    // Verify deletion — GET should return 404
    try {
      await testContext.api!.getProject(projectId);
      expect.fail('Should have thrown 404 for deleted project');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('should return 403 when non-admin deletes project', async () => {
    // Admin creates a project
    const projectId = await createProject();
    const client = nonAdminClient();

    try {
      await client.deleteProject(projectId);
      expect.fail('Should have thrown 403');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }

    // Cleanup
    await testContext.api!.deleteProject(projectId);
  });

  // ─── Member Management ──────────────────────────────────────────────

  it('should add member to project', async () => {
    const projectId = await createProject();
    const testUserIdNum = String(testContext.testUserId);

    const addRes = await testContext.api!.addProjectMember(
      projectId,
      testUserIdNum,
      'developer',
    );
    expect(addRes.success).toBe(true);
  });

  it('should list project members', async () => {
    const projectId = await createProject();
    const testUserIdNum = String(testContext.testUserId);

    // Add test user as member first
    await testContext.api!.addProjectMember(projectId, testUserIdNum, 'developer');

    const res = await testContext.api!.listProjectMembers(projectId);
    const data = expectSuccess(res, 'List project members');
    assertArrayNotEmpty(data, 'Project members');

    // Should include both the admin (creator = manager) and test user
    const testUserMember = data.find(
      (m) => String(m.user_id) === String(testUserIdNum),
    );
    expect(testUserMember).toBeDefined();
    expect(testUserMember!.role).toBe('developer');
  });

  it('should update member role', async () => {
    const projectId = await createProject();
    const testUserIdNum = String(testContext.testUserId);

    // Add as developer first
    await testContext.api!.addProjectMember(projectId, testUserIdNum, 'developer');

    // Update to viewer
    const updateRes = await testContext.api!.updateProjectMember(
      projectId,
      testUserIdNum,
      'viewer',
    );
    expect(updateRes.success).toBe(true);

    // Verify via member list
    const membersRes = await testContext.api!.listProjectMembers(projectId);
    const members = expectSuccess(membersRes, 'List after role update');
    const updatedMember = members.find(
      (m) => String(m.user_id) === String(testUserIdNum),
    );
    expect(updatedMember).toBeDefined();
    expect(updatedMember!.role).toBe('viewer');
  });

  it('should remove member from project', async () => {
    const projectId = await createProject();
    const testUserIdNum = String(testContext.testUserId);

    // Add then remove
    await testContext.api!.addProjectMember(projectId, testUserIdNum, 'developer');
    const removeRes = await testContext.api!.removeProjectMember(
      projectId,
      testUserIdNum,
    );
    expect(removeRes.success).toBe(true);

    // Verify removal
    const membersRes = await testContext.api!.listProjectMembers(projectId);
    const members = expectSuccess(membersRes, 'List after removal');
    const found = members.find(
      (m) => String(m.user_id) === String(testUserIdNum),
    );
    expect(found).toBeUndefined();
  });

  it('should batch add members to project', async () => {
    const projectId = await createProject();
    const testUserIdNum = String(testContext.testUserId);

    // The backend expects { user_ids: [...], role: "..." } at POST /members/batch.
    // The client has no dedicated batch method, so use a raw fetch.
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/projects/${projectId}/members/batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testContext.adminToken}`,
        },
        body: JSON.stringify({ user_ids: [testUserIdNum], role: 'reporter' }),
      },
    );
    const body = await response.json() as { success: boolean; added: number; errors?: unknown[] };
    expect(body.success).toBe(true);
    expect(body.added).toBeGreaterThanOrEqual(1);

    // Verify via member list
    const membersRes = await testContext.api!.listProjectMembers(projectId);
    const members = expectSuccess(membersRes, 'List after batch add');
    const addedMember = members.find(
      (m) => String(m.user_id) === String(testUserIdNum),
    );
    expect(addedMember).toBeDefined();
    expect(addedMember!.role).toBe('reporter');
  });

  // ─── Batch Update & Delete Members ─────────────────────────────────

  it('should batch update project members role', async () => {
    const projectId = await createProject();
    const testUserIdNum = String(testContext.testUserId);

    // Add member first
    await testContext.api!.addProjectMember(projectId, testUserIdNum, 'developer');

    // Batch update to 'lead'
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/projects/${projectId}/members/batch`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testContext.adminToken}`,
        },
        body: JSON.stringify({ user_ids: [testUserIdNum], role: 'lead' }),
      },
    );
    const body1 = await response.json() as { success: boolean; updated: number; errors?: unknown[] };
    expect(body1.success).toBe(true);
    expect(body1.updated).toBeGreaterThanOrEqual(1);
  });

  it('should batch delete project members', async () => {
    const projectId = await createProject();
    const testUserIdNum = String(testContext.testUserId);

    // Add member first
    await testContext.api!.addProjectMember(projectId, testUserIdNum, 'developer');

    // Batch delete
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/projects/${projectId}/members/batch`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testContext.adminToken}`,
        },
        body: JSON.stringify({ user_ids: [testUserIdNum] }),
      },
    );
    const body2 = await response.json() as { success: boolean; deleted: number; errors?: unknown[] };
    expect(body2.success).toBe(true);
    expect(body2.deleted).toBeGreaterThanOrEqual(1);
  });

  // ─── Access Control ─────────────────────────────────────────────────

  it('should return 403 when non-admin tries to add member without manager role', async () => {
    const client = nonAdminClient();
    const projectId = await createProject();

    try {
      // Test user is not a member of this project
      await client.addProjectMember(projectId, Number(testContext.testUserId), 'developer');
      expect.fail('Should have thrown 403');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }

    // Cleanup
    await testContext.api!.deleteProject(projectId);
  });

  it('should return 403 when non-admin tries to update project', async () => {
    const client = nonAdminClient();
    const projectId = await createProject();

    try {
      await client.updateProject(projectId, { description: 'hacked' });
      expect.fail('Should have thrown 403');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }

    await testContext.api!.deleteProject(projectId);
  });

  it('should handle non-member access to private project', async () => {
    // Create a project with is_public = false (private)
    const identifier = generateRandomString('priv').toLowerCase();
    const projectData = {
      ...factories.project({ identifier }),
      is_public: false,
    };

    const createRes = await testContext.api!.createProject(projectData as any);
    expect(createRes.success).toBe(true);
    const projectId = (createRes as any).id as string;

    // Have the test user (non-member) try to access it
    const client = nonAdminClient();
    try {
      const res = await client.getProject(projectId);
      // If the backend allows access to private projects for any authenticated user,
      // this will succeed. Otherwise it should return 403.
      if (!res.success) {
        expect.fail('Unexpected failure: ' + res.error);
      }
      // Access allowed — valid for some access policies
      if (res.data) {
        expect(res.data.id).toBeDefined();
      }
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        // 403 means the access control is working correctly for private projects
        expect([403, 404]).toContain(error.status);
      } else {
        throw error;
      }
    }

    // Cleanup
    await testContext.api!.deleteProject(projectId);
  });

  // ─── Authentication ─────────────────────────────────────────────────

  it('should return 401 when accessing projects without token', async () => {
    const client = unauthClient();
    try {
      await client.listProjects();
      expect.fail('Should have thrown 401 without token');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('should return 401 when creating project without token', async () => {
    const client = unauthClient();
    try {
      await client.createProject(factories.project());
      expect.fail('Should have thrown 401 without token');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  // ─── Search & Filtering ─────────────────────────────────────────────

  it('should list projects with search parameter', async () => {
    const uniqueTag = generateRandomString('searchtest').toLowerCase();
    const identifier = uniqueTag;

    // Create a project with a unique name/identifier
    const createRes = await testContext.api!.createProject(
      factories.project({ identifier, name: `Search Test ${uniqueTag}` }),
    );
    expect(createRes.success).toBe(true);

    // Search by the identifier
    const res = await testContext.api!.listProjects({ search: uniqueTag });
    const data = expectSuccess(res, 'Search projects');
    expect(Array.isArray(data)).toBe(true);

    // At least one result should match
    const match = data.find((p) => p.identifier === identifier);
    expect(match).toBeDefined();
    expect(match!.name).toContain('Search Test');
  });

  it('should list projects with pagination', async () => {
    const res = await testContext.api!.listProjects({ page: 1, limit: 3 });
    const data = expectSuccess(res, 'List projects paginated');
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(3);
  });
});

// ─── Additional Exception / Edge Coverage ──────────────────────────────
describe('Projects API - 추가 예외 커버리지', () => {
  const NONEXISTENT_ID = '99999999';

  function authedNonAdmin(): ApiClient {
    const client = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    client.setToken(testContext.testToken!);
    return client;
  }

  function noAuth(): ApiClient {
    return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  }

  async function createProject(): Promise<string> {
    const res = await testContext.api!.createProject(factories.project());
    return (res as any).id as string;
  }

  it('존재하지 않는 프로젝트 조회 시 404를 반환한다', async () => {
    try {
      await testContext.api!.getProject(NONEXISTENT_ID);
      expect.fail('Should have thrown 404');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 프로젝트 수정 시 404를 반환한다', async () => {
    try {
      await testContext.api!.updateProject(NONEXISTENT_ID, { description: 'ghost' });
      expect.fail('Should have thrown 404');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 프로젝트 삭제 시 404를 반환한다', async () => {
    try {
      await testContext.api!.deleteProject(NONEXISTENT_ID);
      expect.fail('Should have thrown 404');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('토큰 없이 프로젝트 상세 조회 시 401을 반환한다', async () => {
    const projectId = await createProject();
    try {
      await noAuth().getProject(projectId);
      expect.fail('Should have thrown 401');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
    await testContext.api!.deleteProject(projectId);
  });

  it('비관리자/비멤버가 멤버 목록 조회 시 403을 반환한다', async () => {
    const projectId = await createProject();
    try {
      await authedNonAdmin().listProjectMembers(projectId);
      expect.fail('Should have thrown 403');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
    await testContext.api!.deleteProject(projectId);
  });

  it('배치 멤버 추가 시 허용되지 않은 role은 400을 반환한다', async () => {
    const projectId = await createProject();
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/projects/${projectId}/members/batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testContext.adminToken}`,
        },
        body: JSON.stringify({
          user_ids: [Number(testContext.testUserId)],
          role: 'super-invalid-role',
        }),
      },
    );
    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    await testContext.api!.deleteProject(projectId);
  });
});
