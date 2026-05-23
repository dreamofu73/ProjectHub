import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, assertHasId, assertArrayNotEmpty } from './setup';
import { ApiClient } from '@/client/api-client';

describe('Tasks API', () => {
  let projectId: number | string;
  let taskId: number | string;

  beforeAll(async () => {
    const res = await testContext.api!.createProject(factories.project());
    const data = expectSuccess(res, 'Setup Project');
    projectId = data.id;
  });

  it('should create a task and return 200 with id', async () => {
    const res = await testContext.api!.createTask(factories.task(projectId));
    // Create returns a minimal payload { success, id }; capture the id and
    // verify the persisted entity via a follow-up GET.
    const data = expectSuccess(res, 'Create Task') as any;
    assertHasId(data, 'Created task');
    taskId = data.id;

    const fetched = expectSuccess(await testContext.api!.getTask(taskId), 'Get Created Task');
    expect(fetched.title).toBeTruthy();
    expect(String(fetched.project_id)).toBe(String(projectId));
    expect(fetched.status).toBe('New');
    expect(fetched.task_type).toBe('Development');
    expect(fetched.task_category).toBe('Feature');
    expect(fetched.progress).toBe(0);
  });

  it('should create a task with all fields populated', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const plannedStart = tomorrow;
    const plannedEnd = nextWeek;

    const res = await testContext.api!.createTask({
      project_id: projectId,
      title: generateRandomString('Full Task'),
      description: 'A task with all fields filled in',
      task_type: 'Research',
      task_category: 'Documentation',
      status: 'In Progress',
      progress: 50,
      planned_start_date: plannedStart,
      planned_end_date: plannedEnd,
      assignee_id: testContext.testUserId!,
    });
    const data = expectSuccess(res, 'Create Full Task') as any;
    assertHasId(data, 'Created full task');

    // Verify persisted fields via GET (create returns only { success, id }).
    const fetched = expectSuccess(await testContext.api!.getTask(data.id), 'Get Full Task');
    expect(fetched.title).toContain('Full Task');
    expect(fetched.description).toBe('A task with all fields filled in');
    expect(fetched.task_type).toBe('Research');
    expect(fetched.task_category).toBe('Documentation');
    expect(fetched.status).toBe('In Progress');
    expect(fetched.progress).toBe(50);
    expect(String(fetched.assignee_id)).toBe(String(testContext.testUserId));
  });

  it('should list tasks by project and return 200', async () => {
    const res = await testContext.api!.listTasks({ project_id: projectId });
    const data = expectSuccess(res, 'List Tasks');
    assertArrayNotEmpty(data, 'Tasks list');
    const found = data.find((t) => t.id === taskId);
    expect(found).toBeDefined();
    found && expect(found.project_id).toBe(projectId);
  });

  it('should get a task by ID and return 200', async () => {
    const res = await testContext.api!.getTask(taskId);
    const data = expectSuccess(res, 'Get Task');
    expect(data.id).toBe(taskId);
    expect(data.title).toBeTruthy();
    expect(data.project_id).toBe(projectId);
  });

  it('should update a task (title, status, progress) and return 200', async () => {
    const newTitle = generateRandomString('Updated Task');
    expectSuccess(await testContext.api!.updateTask(taskId, {
      title: newTitle,
      status: 'In Progress',
      progress: 75,
    }), 'Update Task');
    // Update returns { success: true } only; re-fetch to verify the changes.
    const fetched = expectSuccess(await testContext.api!.getTask(taskId), 'Get Updated Task');
    expect(fetched.title).toBe(newTitle);
    expect(fetched.status).toBe('In Progress');
    expect(fetched.progress).toBe(75);
  });

  it('should delete a task and return 200', async () => {
    const createRes = await testContext.api!.createTask(factories.task(projectId));
    const created = expectSuccess(createRes, 'Create Task for Delete');
    const deleteRes = await testContext.api!.deleteTask(created.id);
    expectSuccess(deleteRes, 'Delete Task');

    // Verify deletion
    try {
      await testContext.api!.getTask(created.id);
      expect.fail('Should have thrown after deletion');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should list tasks filtered by status', async () => {
    // Ensure at least one 'New' task exists (earlier tests may have moved the
    // originally-created task to another status) plus a distinct 'Done' task
    // that must be excluded by the status filter.
    await testContext.api!.createTask(factories.task(projectId, {
      title: 'Status filter test - new',
      status: 'New',
    }));
    await testContext.api!.createTask(factories.task(projectId, {
      title: 'Status filter test - done',
      status: 'Done',
    }));

    const res = await testContext.api!.listTasks({ project_id: projectId, status: 'New' });
    const data = expectSuccess(res, 'List Tasks by Status');
    assertArrayNotEmpty(data, 'Tasks filtered by status');
    data.forEach((task) => {
      expect(task.status).toBe('New');
    });
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: 'http://localhost:8000' });

    try {
      await unauthApi.listTasks({ project_id: projectId });
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });

  it('should get non-existent task and return 404', async () => {
    try {
      await testContext.api!.getTask(99999999);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });
});

describe('Tasks API - 추가 시나리오 (권한/검증/상태 전이)', () => {
  let memberProjectId: number | string;
  let nonMemberProjectId: number | string;
  let userApi: ApiClient;

  beforeAll(async () => {
    userApi = new ApiClient({ baseUrl: 'http://localhost:8000', token: testContext.testToken! });

    // 테스트 유저가 멤버로 등록된 프로젝트
    const memberProj = expectSuccess(
      await testContext.api!.createProject(factories.project()),
      'Setup Member Project'
    );
    memberProjectId = memberProj.id;
    // NOTE: api-client.addProjectMember sends user_id as a Sonyflake string, but the
    // backend (projects.rs add_project_member) parses it with as_i64(), which rejects
    // JSON strings ("user_id is required"). Send the id as a raw numeric JSON literal to
    // preserve Sonyflake precision (it exceeds Number.MAX_SAFE_INTEGER) and satisfy as_i64().
    await fetch(`http://localhost:8000/api/projects/${memberProjectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testContext.adminToken}`,
      },
      body: `{"user_id": ${testContext.testUserId}, "role": "member"}`,
    });

    // 테스트 유저가 멤버가 아닌 프로젝트
    const nonMemberProj = expectSuccess(
      await testContext.api!.createProject(factories.project()),
      'Setup Non-member Project'
    );
    nonMemberProjectId = nonMemberProj.id;
  });

  it('비멤버가 태스크를 생성하면 403을 반환한다', async () => {
    try {
      await userApi.createTask(factories.task(nonMemberProjectId));
      expect.fail('Should have thrown 403');
    } catch (error: any) {
      expect(error.status).toBe(403);
    }
  });

  it('존재하지 않는 태스크를 수정하면 404를 반환한다', async () => {
    try {
      await testContext.api!.updateTask(99999999, { title: generateRandomString('nope') });
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 태스크를 삭제하면 404를 반환한다', async () => {
    try {
      await testContext.api!.deleteTask(99999999);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('작성자가 아닌 일반 멤버가 태스크를 삭제하면 403을 반환한다', async () => {
    // 관리자가 멤버 프로젝트에 태스크 생성 (author = admin)
    const created = expectSuccess(
      await testContext.api!.createTask(factories.task(memberProjectId)),
      'Create Task as Admin'
    );
    // 멤버(비매니저, 비작성자)인 테스트 유저가 삭제 시도
    try {
      await userApi.deleteTask(created.id);
      expect.fail('Should have thrown 403');
    } catch (error: any) {
      expect(error.status).toBe(403);
    }
  });

  it('실제 시작/종료일과 진행률 100% 상태 전이가 반영된다', async () => {
    const created = expectSuccess(
      await testContext.api!.createTask(factories.task(memberProjectId)),
      'Create Task for actual-date update'
    );
    const start = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = new Date().toISOString().split('T')[0];

    expectSuccess(
      await testContext.api!.updateTask(created.id, {
        status: 'Done',
        progress: 100,
        actual_start_date: start,
        actual_end_date: end,
      }),
      'Update Task actual dates'
    );

    // update 응답은 {success:true} 만 반환하므로 재조회로 검증
    const fetched = expectSuccess(await testContext.api!.getTask(created.id), 'Get Updated Task');
    expect(fetched.status).toBe('Done');
    expect(fetched.progress).toBe(100);
    expect(fetched.actual_start_date).toBe(start);
    expect(fetched.actual_end_date).toBe(end);
  });

  it('비멤버는 태스크 목록에서 다른 프로젝트의 태스크를 볼 수 없다', async () => {
    // 관리자가 비멤버 프로젝트에 태스크 생성
    const created = expectSuccess(
      await testContext.api!.createTask(
        factories.task(nonMemberProjectId, { title: generateRandomString('Hidden Task') })
      ),
      'Create Hidden Task'
    );

    // 테스트 유저(비멤버) 목록에는 포함되지 않아야 한다
    const list = expectSuccess(await userApi.listTasks(), 'List Tasks as non-member');
    const found = list.find((t) => String(t.id) === String(created.id));
    expect(found).toBeUndefined();
  });
});
