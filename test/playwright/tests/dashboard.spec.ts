import { test, expect } from '@playwright/test';

test.describe('대시보드 (Dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('대시보드 페이지 로드 및 위젯 표시', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
    await expect(page.getByText('전체 프로젝트 현황 및 활동 피드를 확인합니다.')).toBeVisible();

    // 통계 위젯 카드 확인 (텍스트가 숫자를 포함하므로 포함 매칭 사용)
    await expect(page.getByText('프로젝트', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('열린 이슈').first()).toBeVisible();
    await expect(page.getByText('내 할 일').first()).toBeVisible();
  });

  test('최근 활동 피드 표시', async ({ page }) => {
    await expect(page.getByText('최근 활동')).toBeVisible();
  });

  test('이슈 현황 차트 표시', async ({ page }) => {
    await expect(page.getByText('이슈 현황')).toBeVisible();
    await expect(page.getByText('해결율')).toBeVisible();
  });

  test('대시보드 상호작용 테스트', async ({ page }) => {
    // 필터/검색 버튼 확인
    const filterBtn = page.getByRole('button', { name: /필터|검색/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
    }

    // 위젯 내 버튼 확인
    const widgetButtons = page.locator('.widget button');
    const count = await widgetButtons.count();
    for (let i = 0; i < count; i++) {
      if (await widgetButtons.nth(i).isVisible()) {
        // 클릭 시도 (부작용 방지를 위해 hover만 하거나 클릭 후 되돌리기)
        await widgetButtons.nth(i).hover();
      }
    }
  });

  test('내비게이션 메뉴 모든 링크 동작', async ({ page }) => {
    const navLinks = [
      { name: '프로젝트', url: '/projects' },
      { name: '이슈', url: '/issues' },
      { name: '쪽지함', url: '/memos' },
      { name: '위키', url: '/wiki' },
      { name: '채팅', url: '/chat' },
    ];

    for (const link of navLinks) {
      await page.getByRole('navigation').getByRole('link', { name: link.name }).click();
      await expect(page).toHaveURL(new RegExp(link.url));
      await page.goto('/dashboard');
    }
  });
});
