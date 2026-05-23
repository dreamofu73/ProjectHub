/**
 * Memos API Integration Tests
 *
 * Tests sending, receiving, listing memos, memo folders,
 * status toggles (archive/spam), batch operations,
 * validation, and authorization enforcement.
 *
 * NOTE: ApiClient.createMemo sends {receiver_id} but the backend
 * expects {receiver_ids: [...]}, so we use raw fetch helpers for
 * memo creation and for endpoints missing from the client.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, TEST_CONFIG } from './setup';
import { ApiClient } from '@/client/api-client';

// ─── Types ──────────────────────────────────────────────────────────────

interface MemoData {
  id: string;
  title: string;
  content: string;
  sender_id: number | string;
  receiver_id?: number | string;
  is_read?: number;
  is_archived?: number;
  is_spam?: number;
  created_at?: string;
}

interface MemoFolder {
  id: string;
  name: string;
  user_id?: number | string;
  created_at?: string;
  updated_at?: string;
}

interface MemoResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Raw API helper for memo endpoints not in ApiClient ─────────────────

async function memoRequest<T>(
  endpoint: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<MemoResponse<T>> {
  const { method = 'GET', token = testContext.adminToken, body } = options;
  const res = await fetch(`${TEST_CONFIG.baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<MemoResponse<T>>;
}

describe('Memos API', () => {
  let memoId: string;
  let folderId: string;

  it('should send a memo and return 200 with memo_ids', async () => {
    const title = generateRandomString('Memo');
    const res = await memoRequest<{ memo_ids: string[] }>('/api/memos', {
      method: 'POST',
      body: {
        receiver_ids: [testContext.testUserId],
        title,
        content: 'Test memo content from integration test',
      },
    });
    // Backend send_memo returns { success, data: { memo_ids: [...] } }
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(Array.isArray(res.data!.memo_ids)).toBe(true);
    expect(res.data!.memo_ids.length).toBeGreaterThan(0);
    memoId = res.data!.memo_ids[0];
  });

  it('should list received memos and return 200 with array', async () => {
    // The test user received the memo sent by admin
    const res = await memoRequest<MemoData[]>('/api/memos/received', {
      token: testContext.testToken!,
    });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    const found = res.data!.find((m) => m.id === memoId);
    expect(found).toBeDefined();
    expect(found!.title).toBeTruthy();
  });

  it('should list sent memos and return 200 with array', async () => {
    const res = await memoRequest<MemoData[]>('/api/memos/sent');
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    const found = res.data!.find((m) => m.id === memoId);
    expect(found).toBeDefined();
  });

  it('should get memo detail and return 200', async () => {
    const res = await memoRequest<MemoData>(`/api/memos/${memoId}`);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data!.id).toBe(memoId);
    expect(res.data!.title).toBeTruthy();
    expect(res.data!.content).toBe('Test memo content from integration test');
    expect(res.data!.sender_id).toBeDefined();
  });

  it('should delete a memo and return 200 (moves to trash)', async () => {
    // Send a memo specifically for deletion
    const sendRes = await memoRequest<{ memo_ids: string[] }>('/api/memos', {
      method: 'POST',
      body: {
        receiver_ids: [testContext.testUserId],
        title: generateRandomString('Delete me'),
        content: 'This memo will be deleted',
      },
    });
    expect(sendRes.success).toBe(true);
    const delMemoId = sendRes.data!.memo_ids[0];

    const delRes = await memoRequest(`/api/memos/${delMemoId}`, { method: 'DELETE' });
    expect(delRes.success).toBe(true);
  });

  it('should toggle archive on a memo and return 200', async () => {
    // Backend toggle_archive_memo requires a JSON body ({ is_archived }); it is
    // authorized for the sender or receiver. memoId was sent by admin (sender).
    const archiveRes = await memoRequest(`/api/memos/${memoId}/archive`, {
      method: 'PUT',
      body: { is_archived: 1 },
    });
    expect(archiveRes.success).toBe(true);

    // Verify archived status
    const getRes = await memoRequest<MemoData>(`/api/memos/${memoId}`);
    expect(getRes.success).toBe(true);

    // Toggle back (un-archive)
    const unarchiveRes = await memoRequest(`/api/memos/${memoId}/archive`, {
      method: 'PUT',
      body: { is_archived: 0 },
    });
    expect(unarchiveRes.success).toBe(true);
  });

  it('should toggle spam on a memo and return 200', async () => {
    // Backend toggle_spam_memo requires a JSON body and only the receiver may
    // report spam, so use the test user's (receiver) token.
    const spamRes = await memoRequest(`/api/memos/${memoId}/spam`, {
      method: 'PUT',
      token: testContext.testToken!,
      body: { is_spam: 1 },
    });
    expect(spamRes.success).toBe(true);

    // Toggle back (un-spam)
    const unspamRes = await memoRequest(`/api/memos/${memoId}/spam`, {
      method: 'PUT',
      token: testContext.testToken!,
      body: { is_spam: 0 },
    });
    expect(unspamRes.success).toBe(true);
  });

  it('should get unread count and return 200 with count', async () => {
    const res = await memoRequest('/api/memos/unread/count', {
      token: testContext.testToken!,
    });
    expect(res.success).toBe(true);
    // Backend get_unread_memos_count returns the count at the top level
    // ({ success, count }), not nested under `data`.
    const count = (res as unknown as { count: number }).count;
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should create a memo folder and return 200 with id', async () => {
    const folderName = generateRandomString('Folder');
    const res = await memoRequest<MemoFolder>('/api/memos/folders', {
      method: 'POST',
      body: { name: folderName },
    });
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data!.id).toBeDefined();
    expect(res.data!.name).toBe(folderName);
    folderId = res.data!.id;
  });

  it('should list memo folders and return 200 with array', async () => {
    const res = await memoRequest<MemoFolder[]>('/api/memos/folders');
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    const found = res.data!.find((f) => f.id === folderId);
    expect(found).toBeDefined();
    expect(found!.name).toBeTruthy();
  });

  it('should update a memo folder and return 200 with updated name', async () => {
    const newName = generateRandomString('Updated Folder');
    const res = await memoRequest(`/api/memos/folders/${folderId}`, {
      method: 'PUT',
      body: { name: newName },
    });
    // Backend update_folder returns only { success }; verify the rename via list.
    expect(res.success).toBe(true);
    const listRes = await memoRequest<MemoFolder[]>('/api/memos/folders');
    const found = listRes.data!.find((f) => f.id === folderId);
    expect(found).toBeDefined();
    expect(found!.name).toBe(newName);
  });

  it('should delete a memo folder and return 200', async () => {
    // Create a disposable folder for deletion
    const createRes = await memoRequest<MemoFolder>('/api/memos/folders', {
      method: 'POST',
      body: { name: generateRandomString('To Delete') },
    });
    expect(createRes.success).toBe(true);
    const delFolderId = createRes.data!.id;

    const delRes = await memoRequest(`/api/memos/folders/${delFolderId}`, { method: 'DELETE' });
    expect(delRes.success).toBe(true);
  });

  it('should batch mark memos as read and return 200', async () => {
    // Send a new memo to be marked as read by the receiver
    const sendRes = await memoRequest<{ memo_ids: string[] }>('/api/memos', {
      method: 'POST',
      body: {
        receiver_ids: [testContext.testUserId],
        title: generateRandomString('Batch read'),
        content: 'Mark this as read via batch',
      },
    });
    expect(sendRes.success).toBe(true);
    const batchMemoId = sendRes.data!.memo_ids[0];

    // Mark as read using the receiver's token; backend batch_toggle_read expects { memo_ids }
    const res = await memoRequest('/api/memos/batch/read', {
      method: 'POST',
      token: testContext.testToken!,
      body: { memo_ids: [batchMemoId] },
    });
    expect(res.success).toBe(true);
  });

  it('should fail to send memo without receiver_ids', async () => {
    const res = await memoRequest('/api/memos', {
      method: 'POST',
      body: {
        title: generateRandomString('No receivers'),
        content: 'Missing receiver_ids',
      },
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('should fail to send memo without title', async () => {
    const res = await memoRequest('/api/memos', {
      method: 'POST',
      body: {
        receiver_ids: [testContext.testUserId],
        content: 'Missing title',
      },
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    try {
      await unauthApi.listReceivedMemos();
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });
});

// ─── 추가 시나리오: 예약/보관함/스팸/휴지통/폴더 이동/기한 연장 ────────────
describe('Memos API - 추가 시나리오 (예약/보관함/스팸/휴지통/폴더/연장)', () => {
  const recv = (): number | string => testContext.testUserId!;

  /** admin(발신자)이 testUser(수신자)에게 쪽지를 보내고 생성된 첫 memo id를 돌려준다. */
  async function sendMemo(overrides: Record<string, unknown> = {}): Promise<string> {
    const res = await memoRequest<{ memo_ids: string[] }>('/api/memos', {
      method: 'POST',
      body: {
        receiver_ids: [recv()],
        title: generateRandomString('추가Memo'),
        content: '추가 시나리오용 쪽지 본문',
        ...overrides,
      },
    });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data!.memo_ids)).toBe(true);
    return res.data!.memo_ids[0];
  }

  it('예약 발송 쪽지는 예약 목록에 나타나고 is_sent=0 이다', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const id = await sendMemo({ reserved_at: future });

    // Reserved list is paginated (default limit 10) and ordered by reserved_at ASC;
    // request a large page so a freshly-created reserved memo is included regardless
    // of how many reserved memos have accumulated on the live server.
    const res = await memoRequest<{ id: string; is_sent: number }[]>('/api/memos/sent/reserved?limit=200');
    expect(res.success).toBe(true);
    const found = res.data!.find((m) => m.id === id);
    expect(found).toBeDefined();
    expect(found!.is_sent).toBe(0);
  });

  it('수신자가 보관하면 보관함(archived) 목록에 나타난다', async () => {
    const id = await sendMemo();
    const arch = await memoRequest(`/api/memos/${id}/archive`, {
      method: 'PUT',
      token: testContext.testToken!,
      body: { is_archived: 1 },
    });
    expect(arch.success).toBe(true);

    const res = await memoRequest<{ id: string }[]>('/api/memos/archived', {
      token: testContext.testToken!,
    });
    expect(res.success).toBe(true);
    expect(res.data!.some((m) => m.id === id)).toBe(true);
  });

  it('수신자가 스팸 처리하면 스팸함(spam) 목록에 나타난다', async () => {
    const id = await sendMemo();
    const spam = await memoRequest(`/api/memos/${id}/spam`, {
      method: 'PUT',
      token: testContext.testToken!,
      body: { is_spam: 1 },
    });
    expect(spam.success).toBe(true);

    const res = await memoRequest<{ id: string }[]>('/api/memos/spam', {
      token: testContext.testToken!,
    });
    expect(res.success).toBe(true);
    expect(res.data!.some((m) => m.id === id)).toBe(true);
  });

  it('쪽지를 삭제하면 휴지통으로 이동하고 복원하면 휴지통에서 사라진다', async () => {
    const id = await sendMemo();

    const del = await memoRequest(`/api/memos/${id}`, {
      method: 'DELETE',
      token: testContext.testToken!,
    });
    expect(del.success).toBe(true);

    const trash = await memoRequest<{ id: string }[]>('/api/memos/trash', {
      token: testContext.testToken!,
    });
    expect(trash.data!.some((m) => m.id === id)).toBe(true);

    const restore = await memoRequest(`/api/memos/${id}/restore`, {
      method: 'PUT',
      token: testContext.testToken!,
    });
    expect(restore.success).toBe(true);

    const trashAfter = await memoRequest<{ id: string }[]>('/api/memos/trash', {
      token: testContext.testToken!,
    });
    expect(trashAfter.data!.some((m) => m.id === id)).toBe(false);
  });

  it('읽은 쪽지의 보관 기한을 연장할 수 있다', async () => {
    const id = await sendMemo();
    // 수신자가 상세 조회하면 읽음 처리된다.
    await memoRequest(`/api/memos/${id}`, { token: testContext.testToken! });

    const res = await memoRequest<{ new_expires_at: string }>(`/api/memos/${id}/extend`, {
      method: 'POST',
      token: testContext.testToken!,
    });
    expect(res.success).toBe(true);
    expect(res.data!.new_expires_at).toBeTruthy();
  });

  it('읽지 않은 쪽지의 보관 기한 연장은 거절된다', async () => {
    const id = await sendMemo();
    const res = await memoRequest(`/api/memos/${id}/extend`, {
      method: 'POST',
      token: testContext.testToken!,
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('수신자가 아닌 사용자는 보관 기한을 연장할 수 없다', async () => {
    const id = await sendMemo();
    // 발신자(admin, 기본 토큰)가 연장 시도 → 권한 없음
    const res = await memoRequest(`/api/memos/${id}/extend`, { method: 'POST' });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('쪽지를 폴더로 이동하면 해당 폴더의 쪽지 목록에서 조회된다', async () => {
    const folderRes = await memoRequest<{ id: string }>('/api/memos/folders', {
      method: 'POST',
      token: testContext.testToken!,
      body: { name: generateRandomString('이동폴더') },
    });
    expect(folderRes.success).toBe(true);
    const folderId = folderRes.data!.id;

    const id = await sendMemo();
    const move = await memoRequest('/api/memos/folders/move', {
      method: 'POST',
      token: testContext.testToken!,
      body: { memo_ids: [id], folder_id: folderId },
    });
    expect(move.success).toBe(true);

    const res = await memoRequest<{ id: string }[]>(`/api/memos/folders/${folderId}/memos`, {
      token: testContext.testToken!,
    });
    expect(res.success).toBe(true);
    expect(res.data!.some((m) => m.id === id)).toBe(true);
  });

  it('존재하지 않는 수신자에게 쪽지를 보내면 거절된다', async () => {
    const res = await memoRequest('/api/memos', {
      method: 'POST',
      body: {
        receiver_ids: [999999999],
        title: generateRandomString('무효수신'),
        content: '존재하지 않는 수신자',
      },
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('빈 수신자 배열로 쪽지를 보내면 거절된다', async () => {
    const res = await memoRequest('/api/memos', {
      method: 'POST',
      body: {
        receiver_ids: [],
        title: generateRandomString('빈수신'),
        content: '수신자 없음',
      },
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
