import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess } from './setup';

describe('Admin - Logs API', () => {
  let logFilename: string;

  it('should list log files', async () => {
    const res = await testContext.api!.listLogFiles();
    const data = expectSuccess(res, 'List Log Files');
    expect(Array.isArray(data)).toBe(true);
    
    if (data.length > 0) {
      logFilename = data[0].name;
    }
  });

  it('should get log file content', async () => {
    if (!logFilename) {
      console.log('No log files available to read');
      return;
    }
    const res = await testContext.api!.getLogFile(logFilename, 10);
    const data = expectSuccess(res, 'Get Log File Content');
    expect(data.content).toBeDefined();
  });

  it('should get log config', async () => {
    const res = await testContext.api!.getLogConfig();
    const data = expectSuccess(res, 'Get Log Config');
    expect(data.max_size_mb).toBeDefined();
    expect(data.max_files).toBeDefined();
  });

  it('should update log config', async () => {
    const res = await testContext.api!.updateLogConfig({
      max_size_mb: 20,
      max_files: 10
    });
    expectSuccess(res, 'Update Log Config');
  });
});

describe('Admin - Logs API - 추가 시나리오', () => {
  it('비관리자는 로그 파일 목록을 조회할 수 없다', async () => {
    testContext.api!.setToken(testContext.testToken!);
    try {
      await expect(testContext.api!.listLogFiles()).rejects.toThrow();
    } finally {
      testContext.api!.setToken(testContext.adminToken!);
    }
  });

  it('비관리자는 로그 설정을 조회할 수 없다', async () => {
    testContext.api!.setToken(testContext.testToken!);
    try {
      await expect(testContext.api!.getLogConfig()).rejects.toThrow();
    } finally {
      testContext.api!.setToken(testContext.adminToken!);
    }
  });

  it('비관리자는 로그 설정을 변경할 수 없다', async () => {
    testContext.api!.setToken(testContext.testToken!);
    try {
      await expect(testContext.api!.updateLogConfig({ max_size_mb: 15 })).rejects.toThrow();
    } finally {
      testContext.api!.setToken(testContext.adminToken!);
    }
  });

  it('유효하지 않은 로그 파일 이름은 거부한다', async () => {
    await expect(testContext.api!.getLogFile('invalid.txt', 10)).rejects.toThrow();
  });

  it('안전하지만 존재하지 않는 로그 파일은 404를 반환한다', async () => {
    await expect(testContext.api!.getLogFile('pms.log.999999', 10)).rejects.toThrow();
  });

  it('로그 설정에 retention_days 값이 포함된다', async () => {
    const res = await testContext.api!.getLogConfig();
    const data = expectSuccess(res, 'Get Log Config retention');
    expect(data.retention_days).toBeDefined();
  });
});
