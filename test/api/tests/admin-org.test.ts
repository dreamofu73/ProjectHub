import { describe, it, expect } from 'vitest';
import { testContext, expectSuccess, assertHasId } from './setup';

describe('Admin - Organization API', () => {
  let departmentId: number | string;

  it('should get organization settings', async () => {
    const res = await testContext.api!.getOrganizationSettings();
    const data = expectSuccess(res, 'Get Organization Settings');
    expect(data.name).toBeDefined();
    expect(data.domain).toBeDefined();
  });

  it('should update organization settings', async () => {
    const res = await testContext.api!.updateOrganizationSettings({
      name: 'Test Org ' + Date.now(),
      domain: 'test-org.com'
    });
    const data = expectSuccess(res, 'Update Organization Settings');
    expect(data.domain).toBe('test-org.com');
  });

  it('should create a department', async () => {
    const res = await testContext.api!.createDepartment({
      name: 'Engineering ' + Date.now(),
      description: 'Dev team',
      parent_id: null
    });
    const data = expectSuccess(res, 'Create Department');
    assertHasId(data, 'Create Department');
    expect(data.name).toContain('Engineering');
    departmentId = data.id;
  });

  it('should get department by id', async () => {
    const res = await testContext.api!.getDepartment(departmentId);
    const data = expectSuccess(res, 'Get Department');
    expect(data.id).toBe(departmentId);
  });

  it('should update department', async () => {
    const res = await testContext.api!.updateDepartment(departmentId, {
      name: 'Eng Updated',
      description: 'Updated dev team'
    });
    const data = expectSuccess(res, 'Update Department');
    expect(data.name).toBe('Eng Updated');
    expect(data.description).toBe('Updated dev team');
  });

  it('should list departments', async () => {
    const res = await testContext.api!.listDepartments();
    const data = expectSuccess(res, 'List Departments');
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((d: any) => d.id === departmentId)).toBe(true);
  });

  it('should list department members', async () => {
    const res = await testContext.api!.listDepartmentMembers(departmentId);
    const data = expectSuccess(res, 'List Department Members');
    expect(Array.isArray(data)).toBe(true);
  });

  it('should delete department', async () => {
    const res = await testContext.api!.deleteDepartment(departmentId);
    expectSuccess(res, 'Delete Department');

    // Verify deletion — the department is gone, so GET returns 404 and the
    // client throws an ApiError.
    await expect(testContext.api!.getDepartment(departmentId)).rejects.toThrow();
  });
});

// 시스템 관리 > 조직정보관리 > 부서추가 시 "상위 부서정보 포함 여/부" 조건 검증
describe('Admin - Department Hierarchy (상위 부서 포함/미포함)', () => {
  let parentId: number | string;
  let parentName: string;
  let childId: number | string;

  it('상위 부서 없이(최상위) 부서를 생성한다 (parent_id 미포함)', async () => {
    parentName = 'HQ ' + Date.now();
    const res = await testContext.api!.createDepartment({
      name: parentName,
      description: '본사(최상위)',
      parent_id: null,
    });
    const data = expectSuccess(res, 'Create Root Department');
    assertHasId(data, 'Create Root Department');
    // 최상위 부서는 상위 부서정보가 없어야 한다
    expect(data.parent_id ?? null).toBeNull();
    parentId = data.id;
  });

  it('상위 부서를 지정하여 하위 부서를 생성한다 (parent_id 포함)', async () => {
    const res = await testContext.api!.createDepartment({
      name: 'Team A ' + Date.now(),
      description: '하위 팀',
      parent_id: parentId,
    });
    const data = expectSuccess(res, 'Create Child Department');
    assertHasId(data, 'Create Child Department');
    // 문자열(Sonyflake) parent_id 가 유실되지 않고 그대로 저장되어야 한다
    expect(String(data.parent_id)).toBe(String(parentId));
    childId = data.id;
  });

  it('하위 부서 단건 조회 시 상위 부서명(parent_name)이 포함된다', async () => {
    const res = await testContext.api!.getDepartment(childId);
    const data = expectSuccess(res, 'Get Child Department');
    expect(String(data.parent_id)).toBe(String(parentId));
    expect(data.parent_name).toBe(parentName);
  });

  it('부서 목록에서 하위 부서에 상위 부서명이 노출된다', async () => {
    const res = await testContext.api!.listDepartments();
    const data = expectSuccess(res, 'List Departments');
    const child = data.find((d: any) => String(d.id) === String(childId));
    expect(child).toBeDefined();
    expect(String(child!.parent_id)).toBe(String(parentId));
    expect(child!.parent_name).toBe(parentName);
  });

  it('부서 수정으로 상위 부서를 해제할 수 있다 (parent_id 제거)', async () => {
    const res = await testContext.api!.updateDepartment(childId, { parent_id: null });
    const data = expectSuccess(res, 'Detach Parent Department');
    expect(data.parent_id ?? null).toBeNull();
    expect(data.parent_name ?? null).toBeNull();
  });

  it('테스트에서 생성한 상위/하위 부서를 정리한다', async () => {
    const delChild = await testContext.api!.deleteDepartment(childId);
    expectSuccess(delChild, 'Delete Child Department');
    const delParent = await testContext.api!.deleteDepartment(parentId);
    expectSuccess(delParent, 'Delete Parent Department');
  });
});

// 부서추가/조회 시 유효성 및 예외 처리 검증 (클라이언트는 비정상 응답 시 ApiError 를 throw 한다)
describe('Admin - Department 유효성 검증', () => {
  const NON_EXISTENT_ID = '999999999999999';

  it('이름 없이 부서를 생성하면 실패한다 (400)', async () => {
    await expect(
      testContext.api!.createDepartment({ name: '', description: '이름 없음' })
    ).rejects.toThrow();
  });

  it('존재하지 않는 부서를 조회하면 실패한다 (404)', async () => {
    await expect(
      testContext.api!.getDepartment(NON_EXISTENT_ID)
    ).rejects.toThrow();
  });

  it('존재하지 않는 부서를 수정하면 실패한다 (404)', async () => {
    await expect(
      testContext.api!.updateDepartment(NON_EXISTENT_ID, { name: '없는 부서' })
    ).rejects.toThrow();
  });

  it('존재하지 않는 부서를 삭제하면 실패한다 (404)', async () => {
    await expect(
      testContext.api!.deleteDepartment(NON_EXISTENT_ID)
    ).rejects.toThrow();
  });
});
