import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, assertHasId, assertArrayNotEmpty } from './setup';
import { ApiClient } from '@/client/api-client';

describe('Milestones API', () => {
  let projectId: number | string;
  let milestoneId: number | string;

  beforeAll(async () => {
    const res = await testContext.api!.createProject(factories.project());
    const data = expectSuccess(res, 'Setup Project');
    projectId = data.id;
  });

  it('should create a milestone and return 200 with id', async () => {
    const res = await testContext.api!.createMilestone(factories.milestone(projectId));
    const data = expectSuccess(res, 'Create Milestone');
    assertHasId(data, 'Created milestone');
    milestoneId = data.id;

    // create returns { success, id }; verify persisted fields via the list endpoint
    const list = expectSuccess(
      await testContext.api!.listMilestones({ project_id: projectId }),
      'List after create'
    );
    const found = list.find((m) => String(m.id) === String(milestoneId));
    expect(found).toBeDefined();
    expect(found!.name).toBeTruthy();
    expect(String(found!.project_id)).toBe(String(projectId));
    expect(found!.status).toBe('open');
  });

  it('should create a milestone with a due date and return 200', async () => {
    const dueDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const name = generateRandomString('Milestone Due Date');
    const res = await testContext.api!.createMilestone({
      project_id: projectId,
      name,
      status: 'open',
      due_date: dueDate,
    });
    const data = expectSuccess(res, 'Create Milestone with Due Date');
    assertHasId(data, 'Created milestone with due date');

    const list = expectSuccess(
      await testContext.api!.listMilestones({ project_id: projectId }),
      'List after create with due date'
    );
    const found = list.find((m) => String(m.id) === String(data.id));
    expect(found).toBeDefined();
    expect(found!.name).toBe(name);
    expect(found!.due_date).toBe(dueDate);
  });

  it('should list milestones by project and return 200', async () => {
    const res = await testContext.api!.listMilestones({ project_id: projectId });
    const data = expectSuccess(res, 'List Milestones');
    assertArrayNotEmpty(data, 'Milestones list');
    const found = data.find((m) => m.id === milestoneId);
    expect(found).toBeDefined();
    found && expect(found.project_id).toBe(projectId);
  });

  it('should update a milestone (name, status) and return 200', async () => {
    const newName = generateRandomString('Updated Milestone');
    const res = await testContext.api!.updateMilestone(milestoneId, {
      name: newName,
      status: 'closed',
    });
    expectSuccess(res, 'Update Milestone');

    // update returns { success }; verify persisted fields via the list endpoint
    const list = expectSuccess(
      await testContext.api!.listMilestones({ project_id: projectId }),
      'List after update'
    );
    const found = list.find((m) => String(m.id) === String(milestoneId));
    expect(found).toBeDefined();
    expect(found!.name).toBe(newName);
    expect(found!.status).toBe('closed');
  });

  it('should delete a milestone and return 200', async () => {
    const createRes = await testContext.api!.createMilestone(factories.milestone(projectId));
    const created = expectSuccess(createRes, 'Create Milestone for Delete');
    const deleteRes = await testContext.api!.deleteMilestone(created.id);
    expectSuccess(deleteRes, 'Delete Milestone');

    // Verify deletion via the list endpoint (there is no GET /milestones/:id route).
    const list = expectSuccess(
      await testContext.api!.listMilestones({ project_id: projectId }),
      'List after delete'
    );
    expect(list.find((m) => String(m.id) === String(created.id))).toBeUndefined();
  });

  it('should list milestones filtered by project', async () => {
    // Create another project and a milestone in it
    const otherProjRes = await testContext.api!.createProject(factories.project());
    const otherProject = expectSuccess(otherProjRes, 'Setup Other Project');
    await testContext.api!.createMilestone(factories.milestone(otherProject.id, {
      subject: 'Milestone in other project',
    }));

    // Ensure project-only filter works
    const res = await testContext.api!.listMilestones({ project_id: projectId });
    const data = expectSuccess(res, 'List Milestones by Project');
    assertArrayNotEmpty(data, 'Milestones for project');
    data.forEach((m) => {
      expect(m.project_id).toBe(projectId);
    });
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: 'http://localhost:8000' });

    try {
      await unauthApi.listMilestones({ project_id: projectId });
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });

  it('should not list a non-existent milestone', async () => {
    // There is no GET /milestones/:id route; a non-existent milestone simply
    // never appears in the project's milestone list.
    const list = expectSuccess(
      await testContext.api!.listMilestones({ project_id: projectId }),
      'List for non-existent check'
    );
    expect(list.find((m) => String(m.id) === '99999999')).toBeUndefined();
  });
});

describe('Milestones API - 추가 예외 커버리지', () => {
  const NONEXISTENT_ID = 99999999;

  it('존재하지 않는 마일스톤 수정 시 404를 반환한다', async () => {
    try {
      await testContext.api!.updateMilestone(NONEXISTENT_ID, { status: 'closed' });
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 마일스톤 삭제 시 404를 반환한다', async () => {
    try {
      await testContext.api!.deleteMilestone(NONEXISTENT_ID);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('project_id 없이 마일스톤 생성 시 400을 반환한다', async () => {
    try {
      await testContext.api!.createMilestone({ subject: 'orphan milestone' } as any);
      expect.fail('Should have thrown 400');
    } catch (error: any) {
      expect(error.status).toBe(400);
    }
  });

  it('토큰 없이 마일스톤 생성 시 401을 반환한다', async () => {
    const projRes = await testContext.api!.createProject(factories.project());
    const project = expectSuccess(projRes, 'Setup Project for 401 create');
    const unauthApi = new ApiClient({ baseUrl: 'http://localhost:8000' });
    try {
      await unauthApi.createMilestone(factories.milestone(project.id));
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error.status).toBe(401);
    }
  });

  it('비멤버가 마일스톤을 생성하면 403을 반환한다', async () => {
    const projRes = await testContext.api!.createProject(factories.project());
    const project = expectSuccess(projRes, 'Setup Project for 403 create');
    const userApi = new ApiClient({ baseUrl: 'http://localhost:8000', token: testContext.testToken! });
    try {
      await userApi.createMilestone(factories.milestone(project.id));
      expect.fail('Should have thrown 403');
    } catch (error: any) {
      expect(error.status).toBe(403);
    }
  });

  it('비관리자가 project_id 없이 마일스톤 목록 조회 시 400을 반환한다', async () => {
    const userApi = new ApiClient({ baseUrl: 'http://localhost:8000', token: testContext.testToken! });
    try {
      await userApi.listMilestones();
      expect.fail('Should have thrown 400');
    } catch (error: any) {
      expect(error.status).toBe(400);
    }
  });
});
