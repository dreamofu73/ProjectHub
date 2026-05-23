import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, assertHasId, assertArrayNotEmpty } from './setup';
import { ApiClient } from '@/client/api-client';

describe('Issues API', () => {
  let projectId: number | string;
  let issueId: number | string;

  beforeAll(async () => {
    const res = await testContext.api!.createProject(factories.project());
    const data = expectSuccess(res, 'Setup Project');
    projectId = data.id;
  });

  it('should create an issue and return 200 with id', async () => {
    const res = await testContext.api!.createIssue(factories.issue(projectId));
    // Create returns a minimal payload { success, id }; capture the id and verify
    // the persisted entity via the detail endpoint (which returns { issue, comments }).
    const data = expectSuccess(res, 'Create Issue') as any;
    assertHasId(data, 'Created issue');
    issueId = data.id;

    const detail = expectSuccess(await testContext.api!.getIssue(issueId), 'Get Created Issue') as any;
    expect(detail.issue.subject).toBeTruthy();
    expect(String(detail.issue.project_id)).toBe(String(projectId));
    expect(detail.issue.status).toBe('new');
    expect(detail.issue.priority).toBe('normal');
    expect(detail.issue.tracker).toBe('bug');
  });

  it('should list issues by project and return 200 with array', async () => {
    // Create a second issue to ensure listing returns multiple
    await testContext.api!.createIssue(factories.issue(projectId, { subject: 'Second issue for listing' }));

    const res = await testContext.api!.listIssues({ project_id: projectId });
    const data = expectSuccess(res, 'List Issues');
    assertArrayNotEmpty(data, 'Issues list');
    const found = data.find((i) => i.id === issueId);
    expect(found).toBeDefined();
    found && expect(found.project_id).toBe(projectId);
  });

  it('should scope issue listing to the requested project only', async () => {
    // Create a separate project with its own issue that must NOT leak into the scoped list
    const otherProjRes = await testContext.api!.createProject(factories.project());
    const otherProject = expectSuccess(otherProjRes, 'Setup Other Project for scoping');
    const otherIssueRes = await testContext.api!.createIssue(
      factories.issue(otherProject.id, { subject: 'Issue in other project' }),
    );
    const otherIssue = expectSuccess(otherIssueRes, 'Create Issue in other project');

    // List issues scoped to the original project (client sends project_id)
    const res = await testContext.api!.listIssues({ project_id: projectId });
    const data = expectSuccess(res, 'List Issues scoped to project');
    assertArrayNotEmpty(data, 'Scoped issues list');

    // Every returned issue must belong to the requested project
    data.forEach((issue) => {
      expect(String(issue.project_id)).toBe(String(projectId));
    });

    // The other project's issue must NOT appear in the scoped result
    const leaked = data.find((i) => String(i.id) === String(otherIssue.id));
    expect(leaked).toBeUndefined();
  });

  it('should get an issue by ID and return 200', async () => {
    const res = await testContext.api!.getIssue(issueId);
    // Detail endpoint returns a nested shape: data = { issue, comments }
    const data = expectSuccess(res, 'Get Issue') as any;
    expect(String(data.issue.id)).toBe(String(issueId));
    expect(data.issue.subject).toBeTruthy();
    expect(String(data.issue.project_id)).toBe(String(projectId));
  });

  it('should update an issue (subject, status, priority) and return 200', async () => {
    const newSubject = generateRandomString('Updated Issue');
    expectSuccess(await testContext.api!.updateIssue(issueId, {
      subject: newSubject,
      status: 'in_progress',
      priority: 'high',
    }), 'Update Issue');
    // Update returns { success: true } only; re-fetch (detail shape) to verify.
    const detail = expectSuccess(await testContext.api!.getIssue(issueId), 'Get Updated Issue') as any;
    expect(detail.issue.subject).toBe(newSubject);
    expect(detail.issue.status).toBe('in_progress');
    expect(detail.issue.priority).toBe('high');
  });

  it('should delete an issue and return 200', async () => {
    const createRes = await testContext.api!.createIssue(factories.issue(projectId));
    const created = expectSuccess(createRes, 'Create Issue for Delete');
    const deleteRes = await testContext.api!.deleteIssue(created.id);
    expectSuccess(deleteRes, 'Delete Issue');

    // Verify deletion
    try {
      await testContext.api!.getIssue(created.id);
      expect.fail('Should have thrown after deletion');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should fail to create issue without project_id', async () => {
    try {
      await testContext.api!.createIssue({
        subject: 'Orphan issue',
      } as any);
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(422);
    }
  });

  it('should list issues filtered by status', async () => {
    // Create issues with known statuses
    await testContext.api!.createIssue(factories.issue(projectId, {
      subject: 'Status filter test - new',
      status: 'new',
    }));
    await testContext.api!.createIssue(factories.issue(projectId, {
      subject: 'Status filter test - closed',
      status: 'closed',
    }));

    const res = await testContext.api!.listIssues({ project_id: projectId, status: 'new' });
    const data = expectSuccess(res, 'List Issues by Status');
    assertArrayNotEmpty(data, 'Issues filtered by status');
    data.forEach((issue) => {
      expect(issue.status).toBe('new');
    });
  });

  it('should list issues filtered by tracker', async () => {
    await testContext.api!.createIssue(factories.issue(projectId, {
      subject: 'Tracker filter test - feature',
      tracker: 'feature',
    }));

    const res = await testContext.api!.listIssues({ project_id: projectId, tracker: 'bug' });
    const data = expectSuccess(res, 'List Issues by Tracker');
    assertArrayNotEmpty(data, 'Issues filtered by tracker');
    data.forEach((issue) => {
      expect(issue.tracker).toBe('bug');
    });
  });

  it('should reject non-member creating an issue with 403', async () => {
    // Create a separate project the test user is NOT a member of
    const projRes = await testContext.api!.createProject(factories.project());
    const otherProject = expectSuccess(projRes, 'Setup Other Project');

    const userApi = new ApiClient({
      baseUrl: 'http://localhost:8000',
      token: testContext.testToken!,
    });

    try {
      await userApi.createIssue(factories.issue(otherProject.id));
      expect.fail('Should have thrown 403 for non-member');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(403);
    }
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: 'http://localhost:8000' });

    try {
      await unauthApi.listIssues({ project_id: projectId });
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });

  it('should get non-existent issue and return 404', async () => {
    try {
      await testContext.api!.getIssue(99999999);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });
});

describe('Issues API - 추가 예외 커버리지', () => {
  const NONEXISTENT_ID = 99999999;

  it('존재하지 않는 이슈 수정 시 404를 반환한다', async () => {
    try {
      await testContext.api!.updateIssue(NONEXISTENT_ID, { subject: 'ghost' });
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 이슈 삭제 시 404를 반환한다', async () => {
    try {
      await testContext.api!.deleteIssue(NONEXISTENT_ID);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('토큰 없이 이슈 생성 시 401을 반환한다', async () => {
    const projRes = await testContext.api!.createProject(factories.project());
    const project = expectSuccess(projRes, 'Setup Project for 401 create');
    const unauthApi = new ApiClient({ baseUrl: 'http://localhost:8000' });
    try {
      await unauthApi.createIssue(factories.issue(project.id));
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error.status).toBe(401);
    }
  });

  it('비멤버가 이슈를 수정하면 403을 반환한다', async () => {
    // 관리자가 프로젝트와 이슈를 생성하고, 테스트 사용자는 멤버가 아니다
    const projRes = await testContext.api!.createProject(factories.project());
    const project = expectSuccess(projRes, 'Setup Project for 403 update');
    const issueRes = await testContext.api!.createIssue(factories.issue(project.id));
    const issue = expectSuccess(issueRes, 'Setup Issue for 403 update');

    const userApi = new ApiClient({ baseUrl: 'http://localhost:8000', token: testContext.testToken! });
    try {
      await userApi.updateIssue(issue.id, { subject: 'hacked' });
      expect.fail('Should have thrown 403');
    } catch (error: any) {
      expect(error.status).toBe(403);
    }
  });

  it('상태가 closed인 이슈만 필터링해 조회한다', async () => {
    const projRes = await testContext.api!.createProject(factories.project());
    const project = expectSuccess(projRes, 'Setup Project for closed filter');
    await testContext.api!.createIssue(
      factories.issue(project.id, { subject: 'closed filter target', status: 'closed' }),
    );

    const res = await testContext.api!.listIssues({ status: 'closed' });
    const data = expectSuccess(res, 'List closed issues');
    expect(Array.isArray(data)).toBe(true);
    data.forEach((issue) => {
      expect(issue.status).toBe('closed');
    });
  });
});
