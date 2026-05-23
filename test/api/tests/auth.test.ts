/**
 * Auth API Integration Tests
 *
 * Tests registration, login, token validation, and error cases.
 * Runs against a LIVE server at http://localhost:8000.
 */

import { describe, it, expect } from 'vitest';
import {
  testContext,
  expectSuccess,
  generateRandomString,
  generateRandomEmail,
  TEST_CONFIG,
} from './setup';
import { ApiClient, ApiError } from '@/client/api-client';

describe('Auth API', () => {
  // Create a fresh unauthenticated client
  function freshClient(): ApiClient {
    return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  }

  // ─── Registration ───────────────────────────────────────────────────

  it('should register a new user successfully', async () => {
    const client = freshClient();
    const login = generateRandomString('reg');
    const email = generateRandomEmail();

    const res = await client.register({
      login,
      password: 'StrongPass1!',
      firstname: 'Register',
      lastname: 'Test',
      email,
    });

    expect(res.success).toBe(true);
    // Register returns { success, uuid } — no data wrapper
    expect((res as any).uuid).toBeDefined();
    expect(typeof (res as any).uuid).toBe('string');
  });

  it('should return 409 when registering with an existing login', async () => {
    const client = freshClient();
    const login = generateRandomString('dup');
    const email = generateRandomEmail();

    // First registration
    const first = await client.register({
      login,
      password: 'Pass123!',
      firstname: 'Dup',
      lastname: 'User',
      email,
    });
    expect(first.success).toBe(true);

    // Second registration — same login
    try {
      await client.register({
        login,
        password: 'Pass456!',
        firstname: 'Dup2',
        lastname: 'User2',
        email: generateRandomEmail(),
      });
      expect.fail('Should have thrown 409 for duplicate login');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(409);
      } else {
        throw error;
      }
    }
  });

  it('should return 409 when registering with an existing email', async () => {
    const client = freshClient();
    const login = generateRandomString('dupemail');
    const email = generateRandomEmail();

    // First registration
    const first = await client.register({
      login,
      password: 'Pass123!',
      firstname: 'Email',
      lastname: 'Dup',
      email,
    });
    expect(first.success).toBe(true);

    // Second registration — same email
    try {
      await client.register({
        login: generateRandomString('dupemail2'),
        password: 'Pass456!',
        firstname: 'Email2',
        lastname: 'Dup2',
        email,
      });
      expect.fail('Should have thrown 409 for duplicate email');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(409);
      } else {
        throw error;
      }
    }
  });

  it('should return 422 when registration is missing required fields', async () => {
    const client = freshClient();

    // Omit required fields by casting to any
    try {
      await (client as any).register({ login: generateRandomString('partial') });
      expect.fail('Should have thrown for missing fields');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        // Axum returns 422 for JSON deserialization failures
        expect([400, 422]).toContain(error.status);
      } else {
        throw error;
      }
    }

    // Also test missing password
    try {
      await (client as any).register({ login: generateRandomString('partial2'), email: generateRandomEmail() });
      expect.fail('Should have thrown for missing password');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect([400, 422]).toContain(error.status);
      } else {
        throw error;
      }
    }
  });

  // ─── Login ──────────────────────────────────────────────────────────

  it('should login with valid credentials', async () => {
    const login = generateRandomString('logintest');
    const email = generateRandomEmail();
    const password = 'CorrectPass1!';
    const client = freshClient();

    // Register first
    const reg = await client.register({
      login,
      password,
      firstname: 'Login',
      lastname: 'Test',
      email,
    });
    expect(reg.success).toBe(true);

    // Now login
    const res = await client.login(login, password);
    const data = expectSuccess(res, 'Login');

    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThan(0);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBeDefined();
    expect(data.user.login).toBe(login);
    expect(data.user.role).toBeDefined();
  });

  it('should login by email as alternative identifier', async () => {
    const login = generateRandomString('logintest2');
    const email = generateRandomEmail();
    const password = 'PassByEmail1!';
    const client = freshClient();

    const reg = await client.register({
      login,
      password,
      firstname: 'Login',
      lastname: 'ByEmail',
      email,
    });
    expect(reg.success).toBe(true);

    // Login using email instead of login
    const res = await client.login(email, password);
    const data = expectSuccess(res, 'Login by email');
    expect(data.user.login).toBe(login);
  });

  it('should return 401 for wrong password', async () => {
    try {
      await testContext.api!.login(TEST_CONFIG.testUser, 'DefinitelyWrongPassword!');
      expect.fail('Should have thrown for wrong password');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('should return 401 for nonexistent user', async () => {
    try {
      await testContext.api!.login('nonexistent_user_that_does_not_exist_12345', 'SomePass1!');
      expect.fail('Should have thrown for nonexistent user');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('should return 401 for empty credentials', async () => {
    try {
      await testContext.api!.login('', '');
      expect.fail('Should have thrown for empty credentials');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  // ─── Token Authentication ──────────────────────────────────────────

  it('should provide usable token upon login', async () => {
    // Login as admin to get a fresh token
    const res = await freshClient().login(TEST_CONFIG.adminUser, TEST_CONFIG.adminPass);
    const data = expectSuccess(res, 'Admin login');
    expect(data.token).toBeDefined();

    // Create a client with this token and call a protected endpoint
    const authedClient = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    authedClient.setToken(data.token);

    // listUsers is a protected endpoint — if it resolves, the token works
    const usersRes = await authedClient.listUsers({ limit: 1 });
    expect(usersRes.success).toBe(true);
  });

  // ─── Get Current User (optional endpoint) ───────────────────────────

  it('should handle /api/auth/me endpoint (may not exist)', async () => {
    // This endpoint is optional — the backend may not implement it.
    // If it exists, validate the response; if 404, skip gracefully.
    try {
      const res = await testContext.api!.getCurrentUser();
      // Endpoint exists
      expect(res.success).toBe(true);
      if (res.data) {
        expect(res.data.id).toBeDefined();
        expect(res.data.login).toBeDefined();
        expect(res.data.role).toBeDefined();
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        // Endpoint not implemented — acceptable, skip
        return;
      }
      throw error;
    }
  });
});

// ─── 추가 시나리오 (기본 역할 / 관리자 폴백 로그인) ─────────────────────────
describe('Auth API - 추가 시나리오', () => {
  function freshClient(): ApiClient {
    return new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
  }

  it('신규 가입 사용자는 기본 역할이 user 여야 한다', async () => {
    const client = freshClient();
    const login = generateRandomString('role');
    const email = generateRandomEmail();
    const password = 'DefaultRole1!';

    const reg = await client.register({
      login,
      password,
      firstname: 'Role',
      lastname: 'Default',
      email,
    });
    expect(reg.success).toBe(true);

    const res = await client.login(login, password);
    const data = expectSuccess(res, 'Login default role');
    expect(data.user.role).toBe('user');
  });

  it('관리자 계정 폴백 로그인은 admin 역할을 반환한다', async () => {
    const res = await freshClient().login(TEST_CONFIG.adminUser, TEST_CONFIG.adminPass);
    const data = expectSuccess(res, 'Admin fallback login');
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('admin');
  });

  it('로그인 식별자에 잘못된 비밀번호면 등록 사용자라도 401을 반환한다', async () => {
    const client = freshClient();
    const login = generateRandomString('wrongpw');
    const email = generateRandomEmail();
    const reg = await client.register({
      login,
      password: 'RightPass1!',
      firstname: 'Wrong',
      lastname: 'Pw',
      email,
    });
    expect(reg.success).toBe(true);

    try {
      await client.login(login, 'TotallyWrong9!');
      expect.fail('Should have thrown 401 for wrong password');
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(401);
      } else {
        throw error;
      }
    }
  });
});
