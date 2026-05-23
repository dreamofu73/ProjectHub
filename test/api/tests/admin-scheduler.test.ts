import { describe, it, expect } from 'vitest';
import { testContext, expectSuccess } from './setup';

describe('Admin - Scheduler API', () => {
  let firstTaskId: string;

  it('should get scheduler status', async () => {
    const res = await testContext.api!.getSchedulerStatus();
    const data = expectSuccess(res, 'Get Scheduler Status');
    
    // Backend returns { tasks: TaskStatus[] }
    expect(data.tasks).toBeDefined();
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(data.tasks.length).toBeGreaterThan(0);
    
    if (data.tasks.length > 0) {
      firstTaskId = data.tasks[0].id;
    }
  });

  it('should update scheduler status', async () => {
    if (!firstTaskId) {
      console.log('No scheduler tasks available to update');
      return;
    }
    
    const res = await testContext.api!.updateSchedulerStatus({
      task_id: firstTaskId,
      running: false
    });
    expectSuccess(res, 'Update Scheduler Status');
  });

  it('should run a scheduler task manually', async () => {
    if (!firstTaskId) {
      console.log('No scheduler tasks available to run');
      return;
    }

    const res = await testContext.api!.runSchedulerTask(firstTaskId);
    expectSuccess(res, 'Run Scheduler Task');
  });
});

describe('Admin - Scheduler API - 추가 시나리오', () => {
  it('비관리자는 스케줄러 상태를 조회할 수 없다', async () => {
    testContext.api!.setToken(testContext.testToken!);
    try {
      await expect(testContext.api!.getSchedulerStatus()).rejects.toThrow();
    } finally {
      testContext.api!.setToken(testContext.adminToken!);
    }
  });

  it('유효하지 않은 task_id 업데이트는 거부한다', async () => {
    await expect(
      testContext.api!.updateSchedulerStatus({ task_id: '___no_such_task___', running: false })
    ).rejects.toThrow();
  });

  it('유효하지 않은 task_id 강제 실행은 거부한다', async () => {
    await expect(testContext.api!.runSchedulerTask('___no_such_task___')).rejects.toThrow();
  });

  it('첫 번째 작업을 다시 활성화한다', async () => {
    const res = await testContext.api!.getSchedulerStatus();
    const data = expectSuccess(res, 'Get Scheduler Status (재활성화)');
    const tasks = data.tasks as Array<{ id: string }>;
    expect(tasks.length).toBeGreaterThan(0);
    const firstTaskId = String(tasks[0].id);

    const updateRes = await testContext.api!.updateSchedulerStatus({
      task_id: firstTaskId,
      running: true,
    });
    expectSuccess(updateRes, 'Re-enable first scheduler task');
  });
});
