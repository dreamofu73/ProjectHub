/**
 * Posts API Integration Tests
 *
 * Tests CRUD operations for posts, project-scoped filtering,
 * and authorization enforcement.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, assertHasId, assertArrayNotEmpty, TEST_CONFIG } from './setup';
import { ApiClient } from '@/client/api-client';

describe('Posts API', () => {
  let projectId: number | string;
  let postId: number | string;

  beforeAll(async () => {
    const res = await testContext.api!.createProject(factories.project());
    const data = expectSuccess(res, 'Setup Project');
    projectId = data.id;
  });

  it('should create a post and return 200 with id', async () => {
    const res = await testContext.api!.createPost(factories.post(projectId));
    const data = expectSuccess(res, 'Create Post');
    assertHasId(data, 'Created post');
    postId = data.id;

    // Create returns a minimal { success, id } envelope — fetch the full entity to verify fields.
    const getRes = await testContext.api!.getPost(postId);
    const post = expectSuccess(getRes, 'Get created post');
    expect(post.title).toBeTruthy();
    expect(post.content).toBeTruthy();
    expect(String(post.project_id)).toBe(String(projectId));
    expect(post.category).toBe('news');
    expect(post.author_id).toBeDefined();
  });

  it('should list posts and return 200 with array', async () => {
    const res = await testContext.api!.listPosts();
    const data = expectSuccess(res, 'List Posts');
    assertArrayNotEmpty(data, 'Posts list');
    const found = data.find((p) => p.id === postId);
    expect(found).toBeDefined();
    expect(found!.project_id).toBe(projectId);
  });

  it('should get post by ID and return 200', async () => {
    const res = await testContext.api!.getPost(postId);
    const data = expectSuccess(res, 'Get Post');
    expect(data.id).toBe(postId);
    expect(data.title).toBeTruthy();
    expect(data.content).toBeTruthy();
    expect(data.project_id).toBe(projectId);
    expect(data.category).toBe('news');
    expect(data.author_id).toBeDefined();
  });

  it('should update post and return 200 with updated fields', async () => {
    const newTitle = generateRandomString('Updated Post');
    const newContent = 'Updated post content from test';
    const res = await testContext.api!.updatePost(postId, {
      title: newTitle,
      content: newContent,
      category: 'notice',
    });
    expectSuccess(res, 'Update Post');

    // Update returns a minimal { success } envelope — fetch to verify persisted fields.
    const getRes = await testContext.api!.getPost(postId);
    const data = expectSuccess(getRes, 'Get updated post');
    expect(data.title).toBe(newTitle);
    expect(data.content).toBe(newContent);
    expect(data.category).toBe('notice');
    expect(String(data.id)).toBe(String(postId));
  });

  it('should delete a post and return 200', async () => {
    const createRes = await testContext.api!.createPost(factories.post(projectId));
    const created = expectSuccess(createRes, 'Create Post for Delete');
    const deleteRes = await testContext.api!.deletePost(created.id);
    expectSuccess(deleteRes, 'Delete Post');

    // Verify deletion — fetching should now 404
    try {
      await testContext.api!.getPost(created.id);
      expect.fail('Should have thrown after deletion');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should list posts filtered by project and return 200', async () => {
    // Create a second project with its own post to verify scoping
    const projRes = await testContext.api!.createProject(factories.project());
    const otherProject = expectSuccess(projRes, 'Setup Other Project');
    await testContext.api!.createPost(
      factories.post(otherProject.id, { title: 'Other project post' })
    );

    // List posts scoped to the original project
    const res = await testContext.api!.listPosts({ project_id: projectId });
    const data = expectSuccess(res, 'List Posts by Project');
    expect(data.length).toBeGreaterThanOrEqual(1);
    data.forEach((post) => {
      expect(post.project_id).toBe(projectId);
    });
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    try {
      await unauthApi.listPosts();
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });

  it('should return 404 for non-existent post', async () => {
    try {
      await testContext.api!.getPost(99999999);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should create a post with a different category', async () => {
    const res = await testContext.api!.createPost(
      factories.post(projectId, {
        title: generateRandomString('Notice Post'),
        category: 'notice',
      })
    );
    const data = expectSuccess(res, 'Create Post with Category');
    assertHasId(data, 'Created notice post');

    // Fetch the full entity to verify the persisted category.
    const getRes = await testContext.api!.getPost(data.id);
    const post = expectSuccess(getRes, 'Get notice post');
    expect(post.category).toBe('notice');
    expect(post.title).toBeTruthy();
  });

  it('should list posts filtered by category', async () => {
    // Create a post in a distinct category
    await testContext.api!.createPost(
      factories.post(projectId, {
        title: generateRandomString('Event Post'),
        category: 'event',
      })
    );

    const res = await testContext.api!.listPosts({
      project_id: projectId,
      category: 'event',
    });
    const data = expectSuccess(res, 'List Posts by Category');
    expect(data.length).toBeGreaterThanOrEqual(1);
    data.forEach((post) => {
      expect(post.category).toBe('event');
      expect(post.project_id).toBe(projectId);
    });
  });
});

// ─── 추가 시나리오: 인증/권한/검증 ────────────────────────────────────────
describe('Posts API - 추가 시나리오 (인증/권한/검증)', () => {
  let projectId: number | string;
  let nonAdminApi: ApiClient;

  beforeAll(async () => {
    const res = await testContext.api!.createProject(factories.project());
    projectId = expectSuccess(res, 'Setup Project (추가)').id;
    nonAdminApi = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    nonAdminApi.setToken(testContext.testToken!);
  });

  it('존재하지 않는 게시글 수정 시 에러(404)를 반환한다', async () => {
    await expect(
      testContext.api!.updatePost(99999999, { title: generateRandomString('Missing') })
    ).rejects.toThrow();
  });

  it('존재하지 않는 게시글 삭제 시 에러(404)를 반환한다', async () => {
    await expect(testContext.api!.deletePost(99999999)).rejects.toThrow();
  });

  it('프로젝트 멤버가 아닌 사용자는 해당 프로젝트에 글을 작성할 수 없다', async () => {
    await expect(nonAdminApi.createPost(factories.post(projectId))).rejects.toThrow();
  });

  it('작성자가 아닌 비관리자는 타인의 게시글을 수정할 수 없다', async () => {
    const created = expectSuccess(
      await testContext.api!.createPost(factories.post(projectId)),
      'Create post for update-perm test'
    );
    await expect(
      nonAdminApi.updatePost(created.id, { title: generateRandomString('Hijack') })
    ).rejects.toThrow();
  });

  it('작성자가 아닌 비관리자는 타인의 게시글을 삭제할 수 없다', async () => {
    const created = expectSuccess(
      await testContext.api!.createPost(factories.post(projectId)),
      'Create post for delete-perm test'
    );
    await expect(nonAdminApi.deletePost(created.id)).rejects.toThrow();
  });
});
