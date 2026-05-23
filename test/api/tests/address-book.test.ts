/**
 * Address Book API Integration Tests
 *
 * Tests CRUD operations for address book groups and members.
 * Runs against a LIVE server at http://localhost:8000.
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
import type { AddressBookGroup, AddressBookMember } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────

function nonAdminClient(): ApiClient {
  const client = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  client.setToken(testContext.testToken!);
  return client;
}

function unauthClient(): ApiClient {
  return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
}

/** Create an address book group and return its ID. */
async function createGroup(name?: string): Promise<string> {
  const data = factories.addressBookGroup({ name: name ?? generateRandomString('AB') });
  const res = await testContext.api!.createAddressBookGroup(data);
  expect(res.success).toBe(true);
  const id = res.data?.id ?? (res as any).id;
  expect(id).toBeDefined();
  expect(typeof id).toBe('string');
  return String(id);
}

async function cleanupTestData(_ctx: typeof testContext): Promise<void> {
  // Groups created during tests will be cleaned up by the test flow itself.
  // No persistent data to clean up beyond what individual tests handle.
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Address Book API', () => {
  afterAll(async () => {
    await cleanupTestData(testContext);
  });

  // ─── List Groups ────────────────────────────────────────────────────

  describe('GET /api/address-book/groups', () => {
    it('should list address book groups', async () => {
      const res = await testContext.api!.listAddressBookGroups();
      const data = expectSuccess(res, 'List address book groups');
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include newly created group in list', async () => {
      const groupName = generateRandomString('ABList');
      const groupId = await createGroup(groupName);

      const res = await testContext.api!.listAddressBookGroups();
      const data = expectSuccess(res, 'List groups after create');
      const found = data.find((g: AddressBookGroup) => g.id === groupId);
      expect(found).toBeDefined();
      expect(found!.name).toBe(groupName);
    });

    it('should reject unauthenticated request with 401', async () => {
      try {
        await unauthClient().listAddressBookGroups();
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

  // ─── Create Group ───────────────────────────────────────────────────

  describe('POST /api/address-book/groups', () => {
    it('should create an address book group', async () => {
      const groupData = factories.addressBookGroup();
      const res = await testContext.api!.createAddressBookGroup(groupData);
      expect(res.success).toBe(true);
      const id = res.data?.id ?? (res as any).id;
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(res.data?.name ?? (res as any).name).toBe(groupData.name);
    });

    it('should reject creation without name', async () => {
      try {
        await testContext.api!.createAddressBookGroup({} as any);
        expect.fail('Should have thrown for missing name');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect([400, 422]).toContain(error.status);
        } else {
          throw error;
        }
      }
    });

    it('should reject unauthenticated creation with 401', async () => {
      try {
        await unauthClient().createAddressBookGroup(factories.addressBookGroup());
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

  // ─── Get Single Group ───────────────────────────────────────────────

  describe('GET /api/address-book/groups/:id', () => {
    it('should get a group by ID', async () => {
      const groupId = await createGroup();

      const res = await testContext.api!.getAddressBookGroup(groupId);
      const data = expectSuccess(res, 'Get group by ID');
      expect(String(data.id)).toBe(groupId);
      expect(data.name).toBeDefined();
      expect(data.member_count).toBeDefined();
    });

    it('should return 404 for non-existent group', async () => {
      try {
        await testContext.api!.getAddressBookGroup(99999999);
        expect.fail('Should have thrown 404');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(404);
        } else {
          throw error;
        }
      }
    });

    it('should reject unauthenticated request with 401', async () => {
      const groupId = await createGroup();
      try {
        await unauthClient().getAddressBookGroup(groupId);
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

  // ─── Update Group ───────────────────────────────────────────────────

  describe('PUT /api/address-book/groups/:id', () => {
    it('should update a group name', async () => {
      const groupId = await createGroup();
      const newName = generateRandomString('UpdatedAB');

      const res = await testContext.api!.updateAddressBookGroup(groupId, { name: newName });
      expect(res.success).toBe(true);
      expect(res.data?.name ?? (res as any).name).toBe(newName);

      // Verify by fetching
      const getRes = await testContext.api!.getAddressBookGroup(groupId);
      const data = expectSuccess(getRes, 'Verify updated group');
      expect(data.name).toBe(newName);
    });

    it('should return 404 for updating non-existent group', async () => {
      try {
        await testContext.api!.updateAddressBookGroup(99999999, { name: 'Ghost' });
        expect.fail('Should have thrown 404');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(404);
        } else {
          throw error;
        }
      }
    });

    it('should reject unauthenticated update with 401', async () => {
      const groupId = await createGroup();
      try {
        await unauthClient().updateAddressBookGroup(groupId, { name: 'Hacked' });
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

  // ─── Delete Group ───────────────────────────────────────────────────

  describe('DELETE /api/address-book/groups/:id', () => {
    it('should delete a group', async () => {
      const groupId = await createGroup();

      const delRes = await testContext.api!.deleteAddressBookGroup(groupId);
      expect(delRes.success).toBe(true);

      // Verify deletion
      try {
        await testContext.api!.getAddressBookGroup(groupId);
        expect.fail('Should have thrown 404 after deletion');
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          expect(error.status).toBe(404);
        } else {
          throw error;
        }
      }
    });

    it('should return 404 for deleting non-existent group', async () => {
      try {
        await testContext.api!.deleteAddressBookGroup(99999999);
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
      const groupId = await createGroup();
      try {
        await unauthClient().deleteAddressBookGroup(groupId);
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

  // ─── Group Members ──────────────────────────────────────────────────

  describe('Group Members', () => {
    let groupId: string;

    beforeAll(async () => {
      groupId = await createGroup();
    });

    it('should list members of a group (initially empty)', async () => {
      const res = await testContext.api!.listAddressBookMembers(groupId);
      const data = expectSuccess(res, 'List group members');
      expect(Array.isArray(data)).toBe(true);
    });

    it('should add members to a group', async () => {
      const res = await testContext.api!.addAddressBookMembers(groupId, {
        user_ids: [testContext.testUserId!],
      });
      expect(res.success).toBe(true);
      const result = res.data;
      if (result) {
        expect(typeof result.added).toBe('number');
      }
    });

    it('should list members after adding', async () => {
      const res = await testContext.api!.listAddressBookMembers(groupId);
      const data = expectSuccess(res, 'List members after add');
      expect(Array.isArray(data)).toBe(true);
      const found = data.find((m: AddressBookMember) => String(m.user_id) === String(testContext.testUserId!));
      expect(found).toBeDefined();
    });

    it('should remove a member from a group', async () => {
      const delRes = await testContext.api!.removeAddressBookMember(groupId, testContext.testUserId!);
      expect(delRes.success).toBe(true);

      // Verify removal
      const listRes = await testContext.api!.listAddressBookMembers(groupId);
      const data = expectSuccess(listRes, 'List members after remove');
      const found = data.find((m: AddressBookMember) => String(m.user_id) === String(testContext.testUserId!));
      expect(found).toBeUndefined();
    });

    it('should reject unauthenticated member operations with 401', async () => {
      try {
        await unauthClient().listAddressBookMembers(groupId);
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
});

// ─── 추가 검증/권한 시나리오 ───────────────────────────────────────────────
describe('Address Book API - 추가 검증/권한 시나리오', () => {
  it('공백만 있는 이름으로 그룹 생성 시 400을 반환한다', async () => {
    try {
      await testContext.api!.createAddressBookGroup({ name: '   ' } as any);
      expect.fail('Should have thrown 400 for blank name');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect([400, 422]).toContain(error.status);
      } else {
        throw error;
      }
    }
  });

  it('빈 이름으로 그룹 수정 시 400을 반환한다', async () => {
    const groupId = await createGroup();
    try {
      await testContext.api!.updateAddressBookGroup(groupId, { name: '   ' });
      expect.fail('Should have thrown 400 for blank name');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect([400, 422]).toContain(error.status);
      } else {
        throw error;
      }
    }
  });

  it('빈 user_ids로 멤버 추가 시 400을 반환한다', async () => {
    const groupId = await createGroup();
    try {
      await testContext.api!.addAddressBookMembers(groupId, { user_ids: [] });
      expect.fail('Should have thrown 400 for empty user_ids');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(400);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 그룹에 멤버 추가 시 404를 반환한다', async () => {
    try {
      await testContext.api!.addAddressBookMembers(99999999, { user_ids: [testContext.testUserId!] });
      expect.fail('Should have thrown 404 for missing group');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('중복 멤버 추가 시 skipped로 집계된다', async () => {
    const groupId = await createGroup();

    const first = await testContext.api!.addAddressBookMembers(groupId, {
      user_ids: [testContext.testUserId!],
    });
    expect(first.success).toBe(true);
    expect(first.data?.added).toBe(1);

    const second = await testContext.api!.addAddressBookMembers(groupId, {
      user_ids: [testContext.testUserId!],
    });
    expect(second.success).toBe(true);
    expect(second.data?.added).toBe(0);
    expect(second.data?.skipped).toBe(1);
  });

  it('존재하지 않는 그룹의 멤버 목록 조회 시 404를 반환한다', async () => {
    try {
      await testContext.api!.listAddressBookMembers(99999999);
      expect.fail('Should have thrown 404 for missing group');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('존재하지 않는 그룹에서 멤버 제거 시 404를 반환한다', async () => {
    try {
      await testContext.api!.removeAddressBookMember(99999999, testContext.testUserId!);
      expect.fail('Should have thrown 404 for missing group');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('다른 사용자의 그룹 멤버 목록에 접근하면 404를 반환한다 (소유권 격리)', async () => {
    // 관리자 소유 그룹을 비관리자(다른 사용자)가 조회 → 소유권 불일치로 404
    const groupId = await createGroup();
    try {
      await nonAdminClient().listAddressBookMembers(groupId);
      expect.fail('Should have thrown 404 for non-owner access');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });
});
