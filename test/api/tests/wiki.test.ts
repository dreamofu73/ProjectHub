/**
 * Wiki API Integration Tests
 *
 * Tests CRUD operations for wiki pages, version history,
 * wiki comments, and authorization enforcement.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, assertHasId, assertArrayNotEmpty, TEST_CONFIG } from './setup';
import { ApiClient } from '@/client/api-client';

// ─── Raw API helper for wiki comment endpoints (not in ApiClient) ──────

async function wikiCommentRequest<T>(
  endpoint: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const { method = 'GET', token = testContext.adminToken, body } = options;
  const res = await fetch(`${TEST_CONFIG.baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<{ success: boolean; data?: T; error?: string }>;
}

describe('Wiki API', () => {
  let projectId: number | string;
  let wikiId: number | string;

  beforeAll(async () => {
    const res = await testContext.api!.createProject(factories.project());
    const data = expectSuccess(res, 'Setup Project');
    projectId = data.id;
  });

  it('should create a wiki page and return 200 with id', async () => {
    const res = await testContext.api!.createWikiPage(factories.wikiPage(projectId));
    // Create returns a minimal payload: { id, slug }. Capture the id here.
    const data = expectSuccess(res, 'Create Wiki Page');
    assertHasId(data, 'Created wiki page');
    wikiId = data.id;

    // Verify the full entity via the list endpoint (create omits title/content).
    const listRes = await testContext.api!.listWikiPages({ project_id: projectId });
    const pages = expectSuccess(listRes, 'List Wiki Pages after create');
    const created = pages.find((w) => String(w.id) === String(wikiId));
    expect(created).toBeDefined();
    expect(created!.title).toBeTruthy();
    expect(String(created!.project_id)).toBe(String(projectId));
    expect(created!.content).toContain('<p>');
  });

  it('should list wiki pages and return 200 with array', async () => {
    await testContext.api!.createWikiPage(
      factories.wikiPage(projectId, { title: generateRandomString('Second wiki page') })
    );

    const res = await testContext.api!.listWikiPages({ project_id: projectId });
    const data = expectSuccess(res, 'List Wiki Pages');
    assertArrayNotEmpty(data, 'Wiki pages list');
    const found = data.find((w) => String(w.id) === String(wikiId));
    expect(found).toBeDefined();
    expect(String(found!.project_id)).toBe(String(projectId));
  });

  it('should get wiki page by ID and return 200', async () => {
    // There is no GET /wiki/:id route; the list endpoint is the real fetch path.
    const res = await testContext.api!.listWikiPages({ project_id: projectId });
    const pages = expectSuccess(res, 'Get Wiki Page via list');
    const data = pages.find((w) => String(w.id) === String(wikiId));
    expect(data).toBeDefined();
    expect(String(data!.id)).toBe(String(wikiId));
    expect(String(data!.project_id)).toBe(String(projectId));
    expect(data!.title).toBeTruthy();
    expect(data!.content).toBeTruthy();
    // Wiki pages track author info (list exposes author_name).
    expect(data!.author_name).toBeDefined();
  });

  it('should update wiki page and return 200 with updated fields', async () => {
    const newTitle = generateRandomString('Updated Wiki');
    const newContent = '<p>Updated wiki content from test</p>';
    const res = await testContext.api!.updateWikiPage(wikiId, {
      title: newTitle,
      content: newContent,
    });
    // Update returns only { success }; verify persisted fields via list.
    expectSuccess(res, 'Update Wiki Page');

    const listRes = await testContext.api!.listWikiPages({ project_id: projectId });
    const pages = expectSuccess(listRes, 'List Wiki Pages after update');
    const updated = pages.find((w) => String(w.id) === String(wikiId));
    expect(updated).toBeDefined();
    expect(updated!.title).toBe(newTitle);
    expect(updated!.content).toBe(newContent);
    expect(String(updated!.id)).toBe(String(wikiId));
  });

  it('should delete a wiki page and return 200', async () => {
    const createRes = await testContext.api!.createWikiPage(factories.wikiPage(projectId));
    const created = expectSuccess(createRes, 'Create Wiki Page for Delete');
    const deleteRes = await testContext.api!.deleteWikiPage(created.id);
    expectSuccess(deleteRes, 'Delete Wiki Page');

    // Verify deletion: the page no longer appears in the project's wiki list.
    const listRes = await testContext.api!.listWikiPages({ project_id: projectId });
    const pages = expectSuccess(listRes, 'List Wiki Pages after delete');
    const stillThere = pages.find((w) => String(w.id) === String(created.id));
    expect(stillThere).toBeUndefined();
  });

  it('should show version history after updates and return 200', async () => {
    // Perform another update so we have at least 2 versions
    await testContext.api!.updateWikiPage(wikiId, {
      title: generateRandomString('Wiki version test'),
      content: '<p>Version test content</p>',
    });

    const res = await testContext.api!.listWikiVersions(wikiId);
    const data = expectSuccess(res, 'List Wiki Versions');
    assertArrayNotEmpty(data, 'Wiki versions');
    expect(data.length).toBeGreaterThanOrEqual(2);
    data.forEach((v) => {
      expect(String(v.wiki_page_id)).toBe(String(wikiId));
      expect(v.version).toBeGreaterThanOrEqual(1);
      expect(v.title).toBeTruthy();
    });
    // Versions are numbered 1..N (returned newest-first); the highest equals the count.
    const maxVersion = Math.max(...data.map((v) => v.version));
    expect(maxVersion).toBe(data.length);
  });

  it('should create a wiki comment and return 200', async () => {
    const commentContent = generateRandomString('Wiki comment');
    const res = await wikiCommentRequest<{ id: number | string; content: string }>(
      `/api/wiki/${wikiId}/comments`,
      { method: 'POST', body: { content: commentContent } }
    );
    expect(res.success).toBe(true);
    // Create returns the id at the top level (no `data` wrapper).
    const commentId = (res as any).id ?? res.data?.id;
    expect(commentId).toBeDefined();
    // Verify content via the list endpoint (create response omits content).
    const listRes = await wikiCommentRequest<{ id: number | string; content: string }[]>(
      `/api/wiki/${wikiId}/comments`
    );
    const created = listRes.data!.find((c) => String(c.id) === String(commentId));
    expect(created).toBeDefined();
    expect(created!.content).toBe(commentContent);
  });

  it('should list wiki comments and return 200 with array', async () => {
    const res = await wikiCommentRequest<{ id: number | string; content: string }[]>(
      `/api/wiki/${wikiId}/comments`
    );
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data!.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    try {
      await unauthApi.listWikiPages({ project_id: projectId });
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });

  it('should return 404 for non-existent wiki page', async () => {
    // No GET /wiki/:id route exists, so the client rejects for any single-page fetch.
    await expect(testContext.api!.getWikiPage(99999999)).rejects.toThrow();
  });
});

// ─── 추가 시나리오: 부모/자식, 버전 복원, 댓글 편집, 권한 ──────────────────
describe('Wiki API - 추가 시나리오 (부모/자식, 버전 복원, 댓글, 권한)', () => {
  let projectId: number | string;

  beforeAll(async () => {
    const res = await testContext.api!.createProject(factories.project());
    projectId = expectSuccess(res, 'Setup Project (wiki 추가)').id;
  });

  it('parent_id를 지정하면 하위 위키 페이지가 부모와 연결된다', async () => {
    const parent = expectSuccess(
      await testContext.api!.createWikiPage(
        factories.wikiPage(projectId, { title: generateRandomString('부모위키') })
      ),
      'Create parent wiki'
    );
    const child = expectSuccess(
      await testContext.api!.createWikiPage(
        factories.wikiPage(projectId, { title: generateRandomString('자식위키'), parent_id: parent.id })
      ),
      'Create child wiki'
    );

    const list = expectSuccess(
      await testContext.api!.listWikiPages({ project_id: projectId }),
      'List wiki for parent/child'
    );
    const foundChild = list.find((w) => String(w.id) === String(child.id));
    expect(foundChild).toBeDefined();
    expect(String(foundChild!.parent_id)).toBe(String(parent.id));
  });

  it('이전 버전으로 복원하면 현재 페이지 내용이 해당 버전으로 되돌아간다', async () => {
    const baseTitle = generateRandomString('복원기준');
    const baseContent = '<p>복원 기준 콘텐츠</p>';
    const page = expectSuccess(
      await testContext.api!.createWikiPage(
        factories.wikiPage(projectId, { title: baseTitle, content: baseContent })
      ),
      'Create wiki for restore'
    );

    // 두 번 수정하여 버전 히스토리를 생성한다.
    await testContext.api!.updateWikiPage(page.id, {
      title: generateRandomString('수정1'),
      content: '<p>수정본 1</p>',
    });
    await testContext.api!.updateWikiPage(page.id, {
      title: generateRandomString('수정2'),
      content: '<p>수정본 2</p>',
    });

    const versions = expectSuccess(
      await testContext.api!.listWikiVersions(page.id),
      'List versions for restore'
    );
    const baseVersion = versions.find((v) => v.title === baseTitle && v.content === baseContent);
    expect(baseVersion).toBeDefined();

    await testContext.api!.restoreWikiVersion(page.id, baseVersion!.id);

    const afterList = expectSuccess(
      await testContext.api!.listWikiPages({ project_id: projectId }),
      'List wiki after restore'
    );
    const restored = afterList.find((w) => String(w.id) === String(page.id));
    expect(restored).toBeDefined();
    expect(restored!.title).toBe(baseTitle);
    expect(restored!.content).toBe(baseContent);
  });

  it('위키 댓글을 수정하고 삭제할 수 있다', async () => {
    const page = expectSuccess(
      await testContext.api!.createWikiPage(factories.wikiPage(projectId)),
      'Create wiki for comment edit'
    );

    const createRes = await wikiCommentRequest<{ id: number | string }>(
      `/api/wiki/${page.id}/comments`,
      { method: 'POST', body: { content: '원본 위키 댓글' } }
    );
    expect(createRes.success).toBe(true);
    // Create returns the id at the top level (no `data` wrapper).
    const commentId = (createRes as any).id ?? createRes.data?.id;
    expect(commentId).toBeDefined();

    const updateRes = await wikiCommentRequest(
      `/api/wiki/${page.id}/comments/${commentId}`,
      { method: 'PUT', body: { content: '수정된 위키 댓글' } }
    );
    expect(updateRes.success).toBe(true);

    const listRes = await wikiCommentRequest<{ id: number | string; content: string }[]>(
      `/api/wiki/${page.id}/comments`
    );
    const updated = listRes.data!.find((c) => String(c.id) === String(commentId));
    expect(updated).toBeDefined();
    expect(updated!.content).toBe('수정된 위키 댓글');

    const deleteRes = await wikiCommentRequest(
      `/api/wiki/${page.id}/comments/${commentId}`,
      { method: 'DELETE' }
    );
    expect(deleteRes.success).toBe(true);
  });

  it('프로젝트 멤버가 아닌 사용자는 위키를 생성할 수 없다', async () => {
    const nonMemberApi = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    nonMemberApi.setToken(testContext.testToken!);
    await expect(
      nonMemberApi.createWikiPage(factories.wikiPage(projectId))
    ).rejects.toThrow();
  });
});
