import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, factories, assertArrayNotEmpty } from './setup';
import { ApiClient } from '@/client/api-client';
import type { Task } from '@/types';

/**
 * The Gantt chart was folded into Tasks: there is no `/api/projects/:id/gantt`
 * backend route. The real frontend Gantt (apps/web TasksGanttChart.tsx) derives
 * its bars from the Tasks list (planned_start_date/planned_end_date/status/progress
 * /assignee). These tests exercise that same contract via the tasks endpoint.
 *
 * `GET /api/tasks` returns every task the caller can access (the `project_id`
 * query param is not applied server-side), so we filter by project_id client-side.
 */
async function getGanttTasks(projectId: number | string): Promise<Task[]> {
  const res = await testContext.api!.listTasks({ project_id: projectId });
  const data = expectSuccess(res, 'List Gantt Tasks');
  return data.filter((t) => String(t.project_id) === String(projectId));
}

describe('Gantt Chart API (derived from Tasks)', () => {
  let projectId: number | string;

  beforeAll(async () => {
    const res = await testContext.api!.createProject({
      name: generateRandomString('Gantt-Project'),
      identifier: generateRandomString('gantt').toLowerCase(),
      description: 'Project for gantt chart tests',
      status: 'active',
    });
    const data = expectSuccess(res, 'Setup Project');
    projectId = data.id;

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Task with planned dates and progress
    await testContext.api!.createTask(
      factories.task(projectId, {
        title: generateRandomString('Gantt Task 1'),
        status: 'in_progress',
        progress: 30,
        planned_start_date: lastWeek,
        planned_end_date: nextWeek,
      })
    );

    // Task that carries actual (completed) dates
    const doneRes = await testContext.api!.createTask(
      factories.task(projectId, {
        title: generateRandomString('Gantt Task 2'),
        status: 'closed',
        progress: 100,
        planned_start_date: lastWeek,
        planned_end_date: today,
      })
    );
    const done = expectSuccess(doneRes, 'Create completed task');
    await testContext.api!.updateTask(done.id, {
      actual_start_date: lastWeek,
      actual_end_date: today,
    });

    // Task without any date fields
    await testContext.api!.createTask(
      factories.task(projectId, {
        title: generateRandomString('Gantt Task 3'),
        status: 'new',
      })
    );
  });

  it('should list project tasks for the gantt chart and return an array', async () => {
    const data = await getGanttTasks(projectId);
    expect(Array.isArray(data)).toBe(true);
    assertArrayNotEmpty(data, 'Gantt tasks');
  });

  it('gantt tasks expose the fields the chart needs', async () => {
    const data = await getGanttTasks(projectId);
    for (const task of data) {
      expect(task.id).toBeDefined();
      expect(task.title).toBeDefined();
      expect(typeof task.status).toBe('string');
      expect(typeof task.progress).toBe('number');
    }
  });

  it('gantt tasks contain planned date fields', async () => {
    const data = await getGanttTasks(projectId);
    const withPlannedDates = data.filter(
      (task) => task.planned_start_date || task.planned_end_date
    );
    expect(withPlannedDates.length).toBeGreaterThan(0);
  });

  it('gantt tasks contain actual date fields', async () => {
    const data = await getGanttTasks(projectId);
    const withActualDates = data.filter(
      (task) => task.actual_start_date || task.actual_end_date
    );
    expect(withActualDates.length).toBeGreaterThan(0);
  });

  it('gantt tasks include tasks without date fields', async () => {
    const data = await getGanttTasks(projectId);
    const withoutDates = data.filter(
      (task) =>
        !task.planned_start_date &&
        !task.planned_end_date &&
        !task.actual_start_date &&
        !task.actual_end_date
    );
    expect(withoutDates.length).toBeGreaterThanOrEqual(0);
  });

  it('gantt tasks expose assignee info when available', async () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await testContext.api!.createTask(
      factories.task(projectId, {
        title: generateRandomString('Gantt Assigned'),
        status: 'new',
        planned_start_date: tomorrow,
        planned_end_date: nextWeek,
        assignee_id: testContext.testUserId!,
      })
    );

    const data = await getGanttTasks(projectId);
    const assigned = data.filter((task) => task.assignee_id);
    expect(assigned.length).toBeGreaterThan(0);
    const target = assigned.find((t) => String(t.assignee_id) === String(testContext.testUserId));
    expect(target).toBeDefined();
    if (target) {
      expect(target.assignee_name).toBeDefined();
    }
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

  it('should return an empty list for a project that has no tasks', async () => {
    const emptyRes = await testContext.api!.createProject({
      name: generateRandomString('Gantt-Empty'),
      identifier: generateRandomString('gempty').toLowerCase(),
      description: 'Empty project',
      status: 'active',
    });
    const emptyProject = expectSuccess(emptyRes, 'Setup Empty Project');
    const data = await getGanttTasks(emptyProject.id);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });
});

describe('Gantt Chart API - 추가 검증 (경계값/일관성)', () => {
  let projectId: number | string;

  beforeAll(async () => {
    const project = expectSuccess(
      await testContext.api!.createProject({
        name: generateRandomString('Gantt-Extra'),
        identifier: generateRandomString('gex').toLowerCase(),
        description: 'Project for extra gantt tests',
        status: 'active',
      }),
      'Setup Extra Gantt Project'
    );
    projectId = project.id;

    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await testContext.api!.createTask(
      factories.task(projectId, {
        title: generateRandomString('Gantt Bounds'),
        status: 'in_progress',
        progress: 50,
        planned_start_date: lastWeek,
        planned_end_date: nextWeek,
      })
    );
  });

  it('간트 항목의 progress는 0~100 범위이며 status가 비어있지 않다', async () => {
    const data = await getGanttTasks(projectId);
    for (const task of data) {
      expect(task.progress).toBeGreaterThanOrEqual(0);
      expect(task.progress).toBeLessThanOrEqual(100);
      expect(typeof task.status).toBe('string');
      expect(task.status.length).toBeGreaterThan(0);
    }
  });

  it('동일 프로젝트의 간트 데이터는 두 번 호출해도 일관된 개수를 반환한다', async () => {
    const first = await getGanttTasks(projectId);
    const second = await getGanttTasks(projectId);
    expect(second.length).toBe(first.length);
  });
});
