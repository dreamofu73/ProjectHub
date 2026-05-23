/**
 * Comments API Integration Tests
 *
 * Tests post comments and issue comments CRUD operations,
 * ownership enforcement, and authorization.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, assertHasId, assertArrayNotEmpty, TEST_CONFIG } from './setup';
import { ApiClient } from '@/client/api-client';

describe('Comments API', () => {
  let projectId: number | string;
  let postId: number | string;
  let issueId: number | string;

  beforeAll(async () => {
    // Create project
    const projRes = await testContext.api!.createProject(factories.project());
    const project = expectSuccess(projRes, 'Setup Project');
    projectId = project.id;

    // Create a post for post-comment tests
    const postRes = await testContext.api!.createPost(factories.post(projectId));
    const post = expectSuccess(postRes, 'Setup Post');
    postId = post.id;

    // Create an issue for issue-comment tests
    const issueRes = await testContext.api!.createIssue(factories.issue(projectId));
    const issue = expectSuccess(issueRes, 'Setup Issue');
    issueId = issue.id;

    // Best-effort: add test user as a project member so non-owner tests are
    // about ownership, not mere project access. Post comments require no
    // membership and issue comments here are authored by the admin (whose
    // role bypasses the membership check), so this is not load-bearing.
    try {
      await testContext.api!.addProjectMember(projectId, testContext.testUserId!, 'member');
    } catch {
      // projects add-member currently drops Sonyflake string user ids; ignore.
    }
  });

  // ─── Post Comments ──────────────────────────────────────────────────

  it('should create a post comment and return 200', async () => {
    const content = generateRandomString('Post comment');
    const res = await testContext.api!.createPostComment(postId, factories.comment({ content }));
    const data = expectSuccess(res, 'Create Post Comment');
    assertHasId(data, 'Created post comment');
    // create returns a minimal { success, id }; verify fields via the list endpoint
    const comments = expectSuccess(
      await testContext.api!.listPostComments(postId),
      'List Post Comments after create'
    );
    const created = comments.find((c) => String(c.id) === String(data.id));
    expect(created).toBeDefined();
    expect(created!.content).toBe(content);
    expect(created!.author_id).toBeDefined();
    expect(created!.author_name).toBeDefined();
  });

  it('should list post comments and return 200 with array', async () => {
    const res = await testContext.api!.listPostComments(postId);
    const data = expectSuccess(res, 'List Post Comments');
    assertArrayNotEmpty(data, 'Post comments list');
    data.forEach((c) => {
      expect(c.content).toBeTruthy();
    });
  });

  it('should update a post comment and return 200 with updated content', async () => {
    // Create a fresh comment to update
    const createRes = await testContext.api!.createPostComment(postId, factories.comment());
    const created = expectSuccess(createRes, 'Create Post Comment for Update');

    const newContent = generateRandomString('Updated post comment');
    // update returns only { success }; verify the new content via the list endpoint
    expectSuccess(
      await testContext.api!.updatePostComment(created.id, { content: newContent }),
      'Update Post Comment'
    );
    const comments = expectSuccess(
      await testContext.api!.listPostComments(postId),
      'List Post Comments after update'
    );
    const updated = comments.find((c) => String(c.id) === String(created.id));
    expect(updated).toBeDefined();
    expect(updated!.content).toBe(newContent);
  });

  it('should delete a post comment and return 200', async () => {
    // Create a fresh comment to delete
    const createRes = await testContext.api!.createPostComment(postId, factories.comment());
    const created = expectSuccess(createRes, 'Create Post Comment for Delete');
    const deleteRes = await testContext.api!.deletePostComment(created.id);
    expectSuccess(deleteRes, 'Delete Post Comment');

    // Verify deletion — should no longer appear in the list
    const listRes = await testContext.api!.listPostComments(postId);
    const comments = expectSuccess(listRes, 'List Post Comments after Delete');
    const found = comments.find((c) => c.id === created.id);
    expect(found).toBeUndefined();
  });

  // ─── Issue Comments ─────────────────────────────────────────────────

  it('should create an issue comment and return 200', async () => {
    const content = generateRandomString('Issue comment');
    const res = await testContext.api!.createIssueComment(issueId, factories.comment({ content }));
    const data = expectSuccess(res, 'Create Issue Comment');
    assertHasId(data, 'Created issue comment');
    // create returns a minimal { success, id }; verify fields via the list endpoint
    const comments = expectSuccess(
      await testContext.api!.listIssueComments(issueId),
      'List Issue Comments after create'
    );
    const created = comments.find((c) => String(c.id) === String(data.id));
    expect(created).toBeDefined();
    expect(created!.content).toBe(content);
    expect(created!.author_id).toBeDefined();
  });

  it('should list issue comments and return 200 with array', async () => {
    const res = await testContext.api!.listIssueComments(issueId);
    const data = expectSuccess(res, 'List Issue Comments');
    assertArrayNotEmpty(data, 'Issue comments list');
    data.forEach((c) => {
      expect(c.content).toBeTruthy();
    });
  });

  it('should update an issue comment and return 200 with updated content', async () => {
    const createRes = await testContext.api!.createIssueComment(issueId, factories.comment());
    const created = expectSuccess(createRes, 'Create Issue Comment for Update');

    const newContent = generateRandomString('Updated issue comment');
    // update returns only { success }; verify the new content via the list endpoint
    expectSuccess(
      await testContext.api!.updateIssueComment(created.id, { content: newContent }),
      'Update Issue Comment'
    );
    const comments = expectSuccess(
      await testContext.api!.listIssueComments(issueId),
      'List Issue Comments after update'
    );
    const updated = comments.find((c) => String(c.id) === String(created.id));
    expect(updated).toBeDefined();
    expect(updated!.content).toBe(newContent);
  });

  it('should delete an issue comment and return 200', async () => {
    const createRes = await testContext.api!.createIssueComment(issueId, factories.comment());
    const created = expectSuccess(createRes, 'Create Issue Comment for Delete');
    const deleteRes = await testContext.api!.deleteIssueComment(created.id);
    expectSuccess(deleteRes, 'Delete Issue Comment');

    // Verify deletion
    const listRes = await testContext.api!.listIssueComments(issueId);
    const comments = expectSuccess(listRes, 'List Issue Comments after Delete');
    const found = comments.find((c) => c.id === created.id);
    expect(found).toBeUndefined();
  });

  // ─── Authorization ──────────────────────────────────────────────────

  it('should reject non-owner update of a comment with 403', async () => {
    // Create a comment as admin (the default api client)
    const createRes = await testContext.api!.createPostComment(
      postId,
      factories.comment({ content: 'Admin-owned comment' })
    );
    const created = expectSuccess(createRes, 'Create Comment as Admin');

    // Test user (not the author) tries to update it
    const userApi = new ApiClient({
      baseUrl: TEST_CONFIG.baseUrl,
      token: testContext.testToken!,
    });

    try {
      await userApi.updatePostComment(created.id, { content: 'Attempted update by non-owner' });
      expect.fail('Should have thrown 403 for non-owner');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(403);
    }
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl });
    try {
      await unauthApi.listPostComments(postId);
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });
});

describe('Comments API - 추가 시나리오 (404/403/관리자 권한)', () => {
  let projectId: number | string;
  let postId: number | string;
  let issueId: number | string;
  let userApi: ApiClient;

  beforeAll(async () => {
    userApi = new ApiClient({ baseUrl: TEST_CONFIG.baseUrl, token: testContext.testToken! });

    const project = expectSuccess(await testContext.api!.createProject(factories.project()), 'Setup Project');
    projectId = project.id;
    const post = expectSuccess(await testContext.api!.createPost(factories.post(projectId)), 'Setup Post');
    postId = post.id;
    const issue = expectSuccess(await testContext.api!.createIssue(factories.issue(projectId)), 'Setup Issue');
    issueId = issue.id;

    // Best-effort membership registration (projects add-member currently drops
    // Sonyflake string user ids). Not load-bearing: userApi only exercises post
    // comments and issue-comment updates, neither of which requires membership.
    try {
      await testContext.api!.addProjectMember(projectId, testContext.testUserId!, 'member');
    } catch {
      // ignore
    }
  });

  it('존재하지 않는 게시글 댓글을 수정하면 404를 반환한다', async () => {
    try {
      await testContext.api!.updatePostComment(99999999, { content: 'X' });
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 게시글 댓글을 삭제하면 404를 반환한다', async () => {
    try {
      await testContext.api!.deletePostComment(99999999);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 이슈 댓글을 수정하면 404를 반환한다', async () => {
    try {
      await testContext.api!.updateIssueComment(99999999, { content: 'X' });
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 이슈에 댓글을 생성하면 404를 반환한다', async () => {
    try {
      await testContext.api!.createIssueComment(99999999, factories.comment());
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('비작성자가 게시글 댓글을 삭제하면 403을 반환한다', async () => {
    const created = expectSuccess(
      await testContext.api!.createPostComment(postId, factories.comment({ content: 'Admin-owned comment' })),
      'Create Admin Post Comment'
    );
    try {
      await userApi.deletePostComment(created.id);
      expect.fail('Should have thrown 403');
    } catch (error: any) {
      expect(error.status).toBe(403);
    }
  });

  it('비작성자가 이슈 댓글을 수정하면 403을 반환한다', async () => {
    const created = expectSuccess(
      await testContext.api!.createIssueComment(issueId, factories.comment({ content: 'Admin-owned issue comment' })),
      'Create Admin Issue Comment'
    );
    try {
      await userApi.updateIssueComment(created.id, { content: 'hijack attempt' });
      expect.fail('Should have thrown 403');
    } catch (error: any) {
      expect(error.status).toBe(403);
    }
  });

  it('관리자는 타인이 작성한 게시글 댓글을 수정할 수 있다', async () => {
    // 테스트 유저가 댓글 작성
    const created = expectSuccess(
      await userApi.createPostComment(postId, factories.comment({ content: 'User comment' })),
      'Create User Post Comment'
    );
    // 관리자가 수정 (update 응답은 {success:true} 만 반환하므로 목록으로 검증)
    const newContent = generateRandomString('Admin edited');
    expectSuccess(
      await testContext.api!.updatePostComment(created.id, { content: newContent }),
      'Admin Update User Comment'
    );
    const comments = expectSuccess(await testContext.api!.listPostComments(postId), 'List after admin edit');
    const target = comments.find((c) => String(c.id) === String(created.id));
    expect(target).toBeDefined();
    expect(target!.content).toBe(newContent);
  });
});
