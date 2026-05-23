import { test, expect } from '@playwright/test';

test.describe('칸반 보드 (Kanban)', () => {
  test('칸반 보드 페이지 로드', async ({ page }) => {
    await page.goto('/projects/e2e-test-project/kanban');

    // 칸반 보드 페이지 확인
    await expect(page.locator('body')).toContainText('칸반');
  });

  test('칸반 보드에 상태 컬럼 표시', async ({ page }) => {
    await page.goto('/projects/e2e-test-project/kanban');

    // 일반적인 칸반 상태 컬럼 확인
    const body = page.locator('body');
    await expect(body).toContainText(/신규|진행중|피드백|해결|완료/);
  });
});

test.describe('일감 관리 (Tasks)', () => {
  test('일감 목록 페이지 로드', async ({ page }) => {
    await page.goto('/projects/e2e-test-project/tasks');

    // 일감 목록 페이지 확인
    await expect(page.locator('body')).toContainText('일감');
  });
});

test.describe('멤버 관리 (Members)', () => {
  test('프로젝트 멤버 관리 페이지 로드 및 멤버 추가 버튼', async ({ page }) => {
    await page.goto('/projects/e2e-test-project/members');

    // 멤버 관리 페이지 확인
    await expect(page.locator('body')).toContainText('멤버');

    // 멤버 추가 버튼
    const addMemberBtn = page.getByRole('button', { name: /멤버 추가|초대/ });
    if (await addMemberBtn.isVisible()) {
      // 버튼이 보이면 클릭 시도 (실제 모달이 뜨는지 확인)
      await addMemberBtn.click();
    }
  });
});
