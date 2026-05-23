import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, assertHasId, generateRandomString, TEST_CONFIG } from './setup';
import { ApiClient, ApiError } from '@/client/api-client';

describe('Admin / General - Groups API', () => {
  let groupId: string;

  it('should list admin groups', async () => {
    const res = await testContext.api!.adminListGroups();
    const data = expectSuccess(res, 'Admin List Groups');
    expect(Array.isArray(data)).toBe(true);
  });

  it('should create a group', async () => {
    const res = await testContext.api!.createGroup({
      name: 'Test Group ' + Date.now(),
    });
    const data = expectSuccess(res, 'Create Group');
    assertHasId(data, 'Create Group');
    groupId = String(data.id);
  });

  it('should list groups', async () => {
    const res = await testContext.api!.listGroups();
    const data = expectSuccess(res, 'List Groups');
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((g: any) => String(g.id) === groupId)).toBe(true);
  });

  it('should get group by id', async () => {
    const res = await testContext.api!.getGroup(groupId);
    const data = expectSuccess(res, 'Get Group');
    expect(String(data.id)).toBe(groupId);
  });

  it('should admin get group by id', async () => {
    const res = await testContext.api!.adminGetGroup(groupId);
    const data = expectSuccess(res, 'Admin Get Group');
    expect(String(data.id)).toBe(groupId);
  });

  it('should update group', async () => {
    const res = await testContext.api!.updateGroup(groupId, {
      name: 'Updated Group Name'
    });
    const data = expectSuccess(res, 'Update Group');
    expect(data.name).toBe('Updated Group Name');
  });

  it('should add a member to the group (user_ids contract)', async () => {
    // The client now sends { user_ids: [...] } as groups::add_member expects.
    // A wrong field name would make the backend answer 400 "user_ids is required".
    const res = await testContext.api!.addGroupMember(groupId, {
      user_id: testContext.testUserId!,
      role: 'member',
    });
    expectSuccess(res, 'Add Group Member');
  });

  it('should list group members after adding one', async () => {
    const res = await testContext.api!.listGroupMembers(groupId);
    const data = expectSuccess(res, 'List Group Members');
    expect(Array.isArray(data)).toBe(true);
  });

  it('should delete group (admin)', async () => {
    const res = await testContext.api!.adminDeleteGroup(groupId);
    expectSuccess(res, 'Admin Delete Group');
  });
});

// ─── 추가 시나리오 (검증 / 권한 / 멤버 오류 경로) ───────────────────────────
describe('Groups API - 추가 시나리오', () => {
  const FAKE_ID = '999999999999999';
  let groupId: string;
  let ownerId: string;

  function nonAdminClient(): ApiClient {
    const client = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    client.setToken(testContext.testToken!);
    return client;
  }

  function unauthClient(): ApiClient {
    return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  }

  beforeAll(async () => {
    const res = await testContext.api!.createGroup({
      name: generateRandomString('GrpExtra'),
    });
    const data = expectSuccess(res, 'Create group for extra scenarios');
    groupId = String(data.id);
    // The group owner is the admin who created it; IDs are Sonyflake strings,
    // so the owner is NOT hard-coded id 1. Capture the real owner id.
    ownerId = String(data.owner_id);
  });

  // ── 검증 ──
  it('이름 없이 그룹 생성 시 400/422를 반환한다', async () => {
    try {
      await testContext.api!.createGroup({} as any);
      expect.fail('Should have thrown for missing name');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect([400, 422]).toContain(error.status);
      } else {
        throw error;
      }
    }
  });

  // ── Not Found ──
  it('존재하지 않는 그룹 조회 시 404를 반환한다', async () => {
    try {
      await testContext.api!.getGroup(FAKE_ID);
      expect.fail('Should have thrown 404');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 그룹 수정 시 404를 반환한다', async () => {
    try {
      await testContext.api!.updateGroup(FAKE_ID, { name: 'Ghost' });
      expect.fail('Should have thrown 404');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('관리자 API로 존재하지 않는 그룹 조회 시 404를 반환한다', async () => {
    try {
      await testContext.api!.adminGetGroup(FAKE_ID);
      expect.fail('Should have thrown 404');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('관리자 API로 존재하지 않는 그룹 삭제 시 404를 반환한다', async () => {
    try {
      await testContext.api!.adminDeleteGroup(FAKE_ID);
      expect.fail('Should have thrown 404');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  // ── 인증 ──
  it('토큰 없이 그룹 목록 조회 시 401을 반환한다', async () => {
    try {
      await unauthClient().listGroups();
      expect.fail('Should have thrown 401');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('토큰 없이 그룹 생성 시 401을 반환한다', async () => {
    try {
      await unauthClient().createGroup({ name: generateRandomString('NoAuth') });
      expect.fail('Should have thrown 401');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  // ── 권한 ──
  it('비관리자가 관리자 그룹 목록에 접근하면 403을 반환한다', async () => {
    try {
      await nonAdminClient().adminListGroups();
      expect.fail('Should have thrown 403');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
  });

  it('멤버가 아닌 사용자가 그룹을 조회하면 403을 반환한다', async () => {
    try {
      await nonAdminClient().getGroup(groupId);
      expect.fail('Should have thrown 403');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
  });

  // ── 멤버 오류 경로 ──
  it('소유자의 역할을 변경하려 하면 403을 반환한다', async () => {
    try {
      // 소유자(그룹 생성자)의 역할 변경 시도
      await testContext.api!.updateGroupMember(groupId, ownerId, { role: 'member' });
      expect.fail('Should have thrown 403 for changing owner role');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
  });

  it('멤버 역할을 잘못된 값으로 변경하면 400을 반환한다', async () => {
    try {
      await testContext.api!.updateGroupMember(groupId, FAKE_ID, { role: 'superuser' } as any);
      expect.fail('Should have thrown 400 for invalid role');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(400);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 멤버의 역할을 변경하면 404를 반환한다', async () => {
    try {
      await testContext.api!.updateGroupMember(groupId, FAKE_ID, { role: 'member' });
      expect.fail('Should have thrown 404 for missing member');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('소유자를 그룹에서 제거하려 하면 403을 반환한다', async () => {
    try {
      await testContext.api!.removeGroupMember(groupId, ownerId);
      expect.fail('Should have thrown 403 for removing owner');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 멤버를 제거하면 404를 반환한다', async () => {
    try {
      await testContext.api!.removeGroupMember(groupId, FAKE_ID);
      expect.fail('Should have thrown 404 for missing member');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  // ── 리소스 공유 ──
  it('그룹 리소스 공유 목록을 조회한다 (초기 빈 배열)', async () => {
    const res = await testContext.api!.listGroupShares(groupId);
    const data = expectSuccess(res, 'List group shares');
    expect(Array.isArray(data)).toBe(true);
  });

  it('지원하지 않는 resource_type으로 공유 생성 시 400을 반환한다', async () => {
    try {
      await testContext.api!.createGroupShare(groupId, {
        resource_type: 'wiki',
        resource_id: '1',
        permission: 'read',
      });
      expect.fail('Should have thrown 400 for unsupported resource_type');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(400);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 프로젝트로 공유 생성 시 404를 반환한다', async () => {
    try {
      await testContext.api!.createGroupShare(groupId, {
        resource_type: 'project',
        resource_id: 999999999999999,
        permission: 'read',
      });
      expect.fail('Should have thrown 404 for missing project');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });
});
