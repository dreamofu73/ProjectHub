import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, expectSuccess, generateRandomString, assertHasId, assertArrayNotEmpty } from './setup';
import { ApiClient } from '@/client/api-client';

describe('Custom Fields API', () => {
  let projectId: number | string;
  let stringFieldId: number | string;
  let numberFieldId: number | string;
  let selectFieldId: number | string;
  let issueId: number | string;

  beforeAll(async () => {
    // Create a project
    const projRes = await testContext.api!.createProject({
      name: generateRandomString('CF-Project'),
      identifier: generateRandomString('cfproj').toLowerCase(),
      description: 'Project for custom field tests',
      status: 'active',
    });
    const project = expectSuccess(projRes, 'Setup Project');
    projectId = project.id;

    // Create an issue to be used for custom value tests
    const issueRes = await testContext.api!.createIssue({
      project_id: projectId,
      subject: generateRandomString('CF-Issue'),
      description: 'Issue for custom field value tests',
      status: 'new',
      priority: 'normal',
      tracker: 'bug',
    });
    const issue = expectSuccess(issueRes, 'Setup Issue');
    issueId = issue.id;
  });

  // create returns { success, id }; persisted fields are verified via the list endpoint.
  it('should create a string custom field and return 200', async () => {
    const fieldName = generateRandomString('StringField');
    const res = await testContext.api!.createCustomField(projectId, {
      field_name: fieldName,
      field_type: 'string',
      is_required: 0,
      sort_order: 1,
    });
    const data = expectSuccess(res, 'Create String Custom Field');
    assertHasId(data, 'Created string custom field');
    stringFieldId = data.id;

    const list = expectSuccess(await testContext.api!.listCustomFields(projectId), 'List after string');
    const created = list.find((f) => String(f.id) === String(stringFieldId));
    expect(created).toBeDefined();
    expect(created!.field_name).toBe(fieldName);
    expect(created!.field_type).toBe('string');
    expect(String(created!.project_id)).toBe(String(projectId));
  });

  it('should create an integer custom field and return 200', async () => {
    const fieldName = generateRandomString('IntegerField');
    const res = await testContext.api!.createCustomField(projectId, {
      field_name: fieldName,
      field_type: 'integer',
      is_required: 1,
      sort_order: 2,
    });
    const data = expectSuccess(res, 'Create Integer Custom Field');
    assertHasId(data, 'Created integer custom field');
    numberFieldId = data.id;

    const list = expectSuccess(await testContext.api!.listCustomFields(projectId), 'List after integer');
    const created = list.find((f) => String(f.id) === String(numberFieldId));
    expect(created).toBeDefined();
    expect(created!.field_name).toBe(fieldName);
    expect(created!.field_type).toBe('integer');
    expect(created!.is_required).toBe(1);
  });

  it('should create a text custom field with options and return 200', async () => {
    const fieldName = generateRandomString('TextField');
    const options = JSON.stringify(['Option A', 'Option B', 'Option C']);
    const res = await testContext.api!.createCustomField(projectId, {
      field_name: fieldName,
      field_type: 'text',
      is_required: 0,
      sort_order: 3,
      options,
    });
    const data = expectSuccess(res, 'Create Text Custom Field');
    assertHasId(data, 'Created text custom field');
    selectFieldId = data.id;

    const list = expectSuccess(await testContext.api!.listCustomFields(projectId), 'List after text');
    const created = list.find((f) => String(f.id) === String(selectFieldId));
    expect(created).toBeDefined();
    expect(created!.field_name).toBe(fieldName);
    expect(created!.field_type).toBe('text');
    expect(created!.options).toBe(options);
  });

  it('should list custom fields and return 200', async () => {
    const res = await testContext.api!.listCustomFields(projectId);
    const data = expectSuccess(res, 'List Custom Fields');
    assertArrayNotEmpty(data, 'Custom fields list');

    const stringField = data.find((f) => f.id === stringFieldId);
    expect(stringField).toBeDefined();
    expect(stringField!.field_type).toBe('string');

    const numberField = data.find((f) => f.id === numberFieldId);
    expect(numberField).toBeDefined();
    expect(numberField!.field_type).toBe('integer');

    const selectField = data.find((f) => f.id === selectFieldId);
    expect(selectField).toBeDefined();
    expect(selectField!.field_type).toBe('text');
  });

  it('should update a custom field and return 200', async () => {
    const newName = generateRandomString('UpdatedField');
    const res = await testContext.api!.updateCustomField(projectId, stringFieldId, {
      field_name: newName,
      is_required: 1,
      sort_order: 10,
    });
    expectSuccess(res, 'Update Custom Field');

    // update returns { success }; verify persisted fields via the list endpoint
    const list = expectSuccess(await testContext.api!.listCustomFields(projectId), 'List after update');
    const updated = list.find((f) => String(f.id) === String(stringFieldId));
    expect(updated).toBeDefined();
    expect(updated!.field_name).toBe(newName);
    expect(updated!.is_required).toBe(1);
    expect(updated!.sort_order).toBe(10);
  });

  it('should delete a custom field and return 200', async () => {
    // First create a temporary field for deletion
    const createRes = await testContext.api!.createCustomField(projectId, {
      field_name: generateRandomString('DeleteField'),
      field_type: 'string',
    });
    const created = expectSuccess(createRes, 'Create Field for Delete');
    const deleteRes = await testContext.api!.deleteCustomField(projectId, created.id);
    expectSuccess(deleteRes, 'Delete Custom Field');

    // Verify deletion
    const listRes = await testContext.api!.listCustomFields(projectId);
    const listData = expectSuccess(listRes, 'List After Delete');
    expect(listData.find((f) => f.id === created.id)).toBeUndefined();
  });

  it('should save custom values on an issue and return 200', async () => {
    const res = await testContext.api!.saveCustomValues(issueId, {
      values: [
        { field_id: stringFieldId, value: 'Test string value' },
        { field_id: numberFieldId, value: '42' },
        { field_id: selectFieldId, value: 'Option A' },
      ],
    });
    const data = expectSuccess(res, 'Save Custom Values');
    expect(data).toBeDefined();
  });

  it('should get custom values for an issue and return 200', async () => {
    const res = await testContext.api!.getCustomValues(issueId);
    const data = expectSuccess(res, 'Get Custom Values');
    expect(data).toBeDefined();

    // Convert to array if it's a record, or check the record shape
    if (typeof data === 'object' && data !== null) {
      const values = data as Record<string, string>;
      // We may not know the key names, but there should be some values
      expect(Object.keys(values).length).toBeGreaterThan(0);
    }
  });

  it('should reject access without token with 401', async () => {
    const unauthApi = new ApiClient({ baseUrl: 'http://localhost:8000' });

    try {
      await unauthApi.listCustomFields(projectId);
      expect.fail('Should have thrown 401');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    }
  });
});

describe('Custom Fields API - 추가 예외 커버리지', () => {
  let cfProjectId: number | string;
  let cfIssueId: number | string;
  let cfIntFieldId: number | string;

  beforeAll(async () => {
    const projRes = await testContext.api!.createProject({
      name: generateRandomString('CF-Ext-Project'),
      identifier: generateRandomString('cfext').toLowerCase(),
      description: 'Project for custom field extra tests',
      status: 'active',
    });
    const project = expectSuccess(projRes, 'Setup Ext Project');
    cfProjectId = project.id;

    const issueRes = await testContext.api!.createIssue({
      project_id: cfProjectId,
      subject: generateRandomString('CF-Ext-Issue'),
      description: 'Issue for custom field extra tests',
      status: 'new',
      priority: 'normal',
      tracker: 'bug',
    });
    const issue = expectSuccess(issueRes, 'Setup Ext Issue');
    cfIssueId = issue.id;

    // Backend accepts these field types: integer, float, string, text, date, time, boolean
    const fieldRes = await testContext.api!.createCustomField(cfProjectId, {
      field_name: generateRandomString('IntField'),
      field_type: 'integer' as any,
      is_required: 1,
      sort_order: 1,
    });
    const field = expectSuccess(fieldRes, 'Setup Integer Field');
    cfIntFieldId = field.id;
  });

  it('알 수 없는 field_type으로 생성 시 400을 반환한다', async () => {
    try {
      await testContext.api!.createCustomField(cfProjectId, {
        field_name: generateRandomString('BadField'),
        field_type: 'totally-invalid' as any,
      });
      expect.fail('Should have thrown 400');
    } catch (error: any) {
      expect(error.status).toBe(400);
    }
  });

  it('존재하지 않는 커스텀 필드 수정 시 404를 반환한다', async () => {
    try {
      await testContext.api!.updateCustomField(cfProjectId, '99999999', { field_name: 'ghost' });
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 커스텀 필드 삭제 시 404를 반환한다', async () => {
    try {
      await testContext.api!.deleteCustomField(cfProjectId, '99999999');
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('존재하지 않는 이슈의 커스텀 값 조회 시 404를 반환한다', async () => {
    try {
      await testContext.api!.getCustomValues(99999999);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('필수 정수 필드에 정수가 아닌 값을 저장하면 400을 반환한다', async () => {
    try {
      await testContext.api!.saveCustomValues(cfIssueId, {
        values: [{ field_id: cfIntFieldId, value: 'not-a-number' }],
      });
      expect.fail('Should have thrown 400');
    } catch (error: any) {
      expect(error.status).toBe(400);
    }
  });

  it('필수 필드를 빈 값으로 저장하면 400을 반환한다', async () => {
    try {
      await testContext.api!.saveCustomValues(cfIssueId, {
        values: [{ field_id: cfIntFieldId, value: '' }],
      });
      expect.fail('Should have thrown 400');
    } catch (error: any) {
      expect(error.status).toBe(400);
    }
  });

  it('비멤버가 커스텀 필드를 생성하면 403을 반환한다', async () => {
    const userApi = new ApiClient({ baseUrl: 'http://localhost:8000', token: testContext.testToken! });
    try {
      await userApi.createCustomField(cfProjectId, {
        field_name: generateRandomString('NoPermField'),
        field_type: 'string',
      });
      expect.fail('Should have thrown 403');
    } catch (error: any) {
      expect(error.status).toBe(403);
    }
  });
});
