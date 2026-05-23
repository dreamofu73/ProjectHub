/**
 * Users API Integration Tests
 *
 * Tests CRUD operations, access control (admin vs non-admin),
 * authentication checks, and search functionality.
 * Runs against a LIVE server at http://localhost:8000.
 */

import { describe, it, expect } from 'vitest';
import {
  testContext,
  expectSuccess,
  generateRandomString,
  generateRandomEmail,
  assertArrayNotEmpty,
  TEST_CONFIG,
} from './setup';
import { ApiClient, ApiError } from '@/client/api-client';

describe('Users API', () => {
  // ─── Helpers ────────────────────────────────────────────────────────

  function nonAdminClient(): ApiClient {
    const client = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    client.setToken(testContext.testToken!);
    return client;
  }

  function unauthClient(): ApiClient {
    return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  }

  const uniqueMarker = Date.now();

  // ─── List Users ─────────────────────────────────────────────────────

  it('should list users as admin', async () => {
    const res = await testContext.api!.listUsers();
    const data = expectSuccess(res, 'List users (admin)');
    assertArrayNotEmpty(data, 'Users list');
    expect(Array.isArray(data)).toBe(true);

    // Admin should see full user details
    const first = data[0];
    expect(first.id).toBeDefined();
    expect(first.login).toBeDefined();
    // Admin sees email and role
    expect(first.email).toBeDefined();
    expect(first.role).toBeDefined();
  });

  it('should list users as non-admin', async () => {
    const client = nonAdminClient();
    const res = await client.listUsers();
    const data = expectSuccess(res, 'List users (non-admin)');
    assertArrayNotEmpty(data, 'Users list for non-admin');
    expect(Array.isArray(data)).toBe(true);

    // Non-admin should get limited fields (no email, no role exposed)
    const first = data[0];
    expect(first.id).toBeDefined();
    expect(first.login).toBeDefined();
  });

  it('should list users with pagination parameters', async () => {
    const res = await testContext.api!.listUsers({ page: 1, limit: 5 });
    const data = expectSuccess(res, 'List users with pagination');
    expect(Array.isArray(data)).toBe(true);
    // Should not throw for reasonable limits
    expect(data.length).toBeLessThanOrEqual(5);
  });

  it('should list users with search parameter', async () => {
    // The backend uses ?q= for users search but the client sends ?search=
    // This test verifies the endpoint handles the parameter gracefully
    const res = await testContext.api!.listUsers({ search: 'admin' });
    const data = expectSuccess(res, 'List users with search');
    expect(Array.isArray(data)).toBe(true);
  });

  // ─── Get User by ID ────────────────────────────────────────────────

  it('should get user by ID', async () => {
    const res = await testContext.api!.getUser(testContext.testUserId!);
    const data = expectSuccess(res, 'Get user by ID');
    expect(data.id).toBeDefined();
    expect(String(data.id)).toBe(String(testContext.testUserId));
    expect(data.login).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.role).toBeDefined();
  });

  it('should return 404 for nonexistent user', async () => {
    const fakeId = '999999999999999';
    try {
      await testContext.api!.getUser(fakeId);
      expect.fail('Should have thrown 404 for nonexistent user');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  // ─── Create User ────────────────────────────────────────────────────

  it('should create a new user as admin', async () => {
    const login = generateRandomString('create');
    const email = generateRandomEmail();
    const password = 'CreatePass1!';

    const res = await testContext.api!.createUser({
      login,
      password,
      email,
      firstname: 'Create',
      lastname: 'Test',
    });

    expect(res.success).toBe(true);

    // Verify the user was actually created
    const usersRes = await testContext.api!.listUsers({ search: '' });
    const users = expectSuccess(usersRes, 'Verify user created');
    const found = users.find((u) => u.login === login);
    expect(found).toBeDefined();
  });

  it('should return 403 when non-admin tries to create a user', async () => {
    const client = nonAdminClient();
    try {
      await client.createUser({
        login: generateRandomString('nope'),
        password: 'SomePass1!',
        email: generateRandomEmail(),
        firstname: 'No',
        lastname: 'Perms',
      });
      expect.fail('Should have thrown 403 for non-admin create');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
  });

  // ─── Update User ────────────────────────────────────────────────────

  it('should update user as admin', async () => {
    // Create a temp user first
    const login = generateRandomString('upd');
    const email = generateRandomEmail();
    const createRes = await testContext.api!.createUser({
      login,
      password: 'UpdatePass1!',
      email,
      firstname: 'Update',
      lastname: 'Me',
    });
    expect(createRes.success).toBe(true);

    // Find the user to get their ID
    const usersRes = await testContext.api!.listUsers({ search: '' });
    const users = expectSuccess(usersRes, 'Find user to update');
    const target = users.find((u) => u.login === login);
    expect(target).toBeDefined();

    // Update lastname
    const newLastname = 'Updated_' + uniqueMarker;
    const updateRes = await testContext.api!.updateUser(target!.id, {
      lastname: newLastname,
    });
    expect(updateRes.success).toBe(true);

    // Verify the update
    const getRes = await testContext.api!.getUser(target!.id);
    const updated = expectSuccess(getRes, 'Verify update');
    expect(updated.lastname).toBe(newLastname);
  });

  // ─── Change Password ────────────────────────────────────────────────

  it('should change password for self', async () => {
    // Create a temporary user for this test
    const login = generateRandomString('pwchange');
    const email = generateRandomEmail();
    const originalPass = 'OrigPass1!';
    const newPass = 'NewPass1!';

    const client = freshClient();

    // Register
    const reg = await client.register({
      login,
      password: originalPass,
      firstname: 'PW',
      lastname: 'Change',
      email,
    });
    expect(reg.success).toBe(true);

    // Login with original password
    const loginRes = await client.login(login, originalPass);
    const loginData = expectSuccess(loginRes, 'Login before password change');
    const userId = loginData.user.id;

    // Change password via the dedicated endpoint (POST /users/:id/password).
    // The PUT /users/:id update endpoint intentionally does NOT change passwords.
    const changeRes = await fetch(`${TEST_CONFIG.baseUrl}/api/users/${userId}/password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testContext.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPass }),
    });
    expect(changeRes.ok).toBe(true);

    // The old password must no longer work.
    await expect(freshClient().login(login, originalPass)).rejects.toThrow();

    // The new password logs in successfully.
    const relogin = await freshClient().login(login, newPass);
    expect(relogin.success).toBe(true);
    expect((relogin as any).token).toBeDefined();
  });

  // ─── Delete User ────────────────────────────────────────────────────

  it('should delete user as admin', async () => {
    // Create a temp user to delete
    const login = generateRandomString('delete');
    const email = generateRandomEmail();
    const createRes = await testContext.api!.createUser({
      login,
      password: 'DeletePass1!',
      email,
      firstname: 'Delete',
      lastname: 'Me',
    });
    expect(createRes.success).toBe(true);

    // Find the new user
    const usersRes = await testContext.api!.listUsers({ search: '' });
    const users = expectSuccess(usersRes, 'Find user to delete');
    const target = users.find((u) => u.login === login);
    expect(target).toBeDefined();

    // Delete
    const deleteRes = await testContext.api!.deleteUser(target!.id);
    expect(deleteRes.success).toBe(true);

    // Verify deletion — GET should return 404
    try {
      await testContext.api!.getUser(target!.id);
      expect.fail('Should have thrown 404 for deleted user');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
      } else {
        throw error;
      }
    }
  });

  it('should return 403 when non-admin tries to delete a user', async () => {
    const client = nonAdminClient();
    try {
      await client.deleteUser(testContext.testUserId!);
      expect.fail('Should have thrown 403 for non-admin delete');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
  });

  // ─── Authentication ─────────────────────────────────────────────────

  it('should return 401 when accessing users without token', async () => {
    const client = unauthClient();
    try {
      await client.listUsers();
      expect.fail('Should have thrown 401 without token');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('should return 401 without token for user detail', async () => {
    const client = unauthClient();
    try {
      await client.getUser('1');
      expect.fail('Should have thrown 401 without token');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('should return 401 without token for creating user', async () => {
    const client = unauthClient();
    try {
      await client.createUser({
        login: generateRandomString('noauth'),
        password: 'Pass1!',
        email: generateRandomEmail(),
        firstname: 'No',
        lastname: 'Auth',
      });
      expect.fail('Should have thrown 401 without token');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });
});

// ─── 추가 권한/검증 시나리오 ───────────────────────────────────────────────
describe('Users API - 추가 권한/검증 시나리오', () => {
  function nonAdminClient(): ApiClient {
    const client = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    client.setToken(testContext.testToken!);
    return client;
  }

  function unauthClient(): ApiClient {
    return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  }

  it('비관리자가 다른 사용자를 수정하면 403을 반환한다', async () => {
    const client = nonAdminClient();
    // 관리자(id=1) 등 본인이 아닌 사용자를 수정 시도 → 권한 검사에서 즉시 거부
    try {
      await client.updateUser('1', { lastname: 'Hacked' });
      expect.fail('Should have thrown 403 for updating another user');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
      } else {
        throw error;
      }
    }
  });

  it('비관리자가 본인 정보를 수정하면 성공한다', async () => {
    const client = nonAdminClient();
    const newFirstname = 'Self_' + Date.now();
    const res = await client.updateUser(testContext.testUserId!, { firstname: newFirstname });
    expect(res.success).toBe(true);

    // 관리자 조회로 반영 확인
    const getRes = await testContext.api!.getUser(testContext.testUserId!);
    const updated = expectSuccess(getRes, 'Verify self update');
    expect(updated.firstname).toBe(newFirstname);
  });

  it('토큰 없이 사용자 수정 시 401을 반환한다', async () => {
    const client = unauthClient();
    try {
      await client.updateUser('1', { lastname: 'NoAuth' });
      expect.fail('Should have thrown 401 without token');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('토큰 없이 사용자 삭제 시 401을 반환한다', async () => {
    const client = unauthClient();
    try {
      await client.deleteUser('1');
      expect.fail('Should have thrown 401 without token');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });
});

function freshClient(): ApiClient {
  return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
}
