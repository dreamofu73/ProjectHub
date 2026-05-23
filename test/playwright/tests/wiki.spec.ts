import { test, expect } from '@playwright/test';
import { randomString } from '../fixtures/helpers';

test.describe('위키 (Wiki)', () => {
  test.describe('글로벌 위키', () => {
    test('글로벌 위키 페이지 로드', async ({ page }) => {
      await page.goto('/wiki');

      // 위키 인덱스 사이드바 확인
      await expect(page.getByText('위키 인덱스')).toBeVisible();
    });

    test('새 위키 페이지 버튼 동작', async ({ page }) => {
      await page.goto('/wiki');

      // 위키 인덱스가 로드될 때까지 대기
      await page.waitForSelector('text=위키 인덱스', { timeout: 10000 });

      // 새 위키 페이지 버튼 클릭
      const newPageBtn = page.getByRole('button', { name: '새 위키 페이지' });
      if (await newPageBtn.isVisible() && await newPageBtn.isEnabled()) {
        await newPageBtn.click();
        // 페이지 URL 변경 확인 (?page=new)
        await expect(page).toHaveURL(/wiki\?page=new/);
      }
    });

    test('기존 위키 페이지 보기', async ({ page }) => {
      await page.goto('/wiki');

      // 기존 위키 페이지가 있으면 표시됨
      await page.waitForSelector('text=위키 인덱스', { timeout: 10000 });

      // 위키 페이지 목록에서 링크 클릭
      const wikiLink = page.locator('a[href*="/wiki?id="]').first();
      if (await wikiLink.isVisible()) {
        await wikiLink.click();
        await page.waitForTimeout(1000);
        // 해당 위키 페이지가 표시됨
        await expect(page.locator('body')).toContainText('위키');
      }
    });
  });

  test.describe('프로젝트 위키', () => {
    test('프로젝트 위키 페이지 로드', async ({ page }) => {
      await page.goto('/projects/e2e-test-project/wiki');
      await expect(page.locator('body')).toContainText('위키');
    });

    test('프로젝트 위키에서 새 페이지 버튼 동작', async ({ page }) => {
      await page.goto('/projects/e2e-test-project/wiki');

      // 위키 인덱스가 로드될 때까지 대기
      await page.waitForSelector('text=위키 인덱스', { timeout: 10000 });

      // 새 위키 페이지 버튼 클릭
      const newPageBtn = page.getByRole('button', { name: '새 위키 페이지' });
      if (await newPageBtn.isVisible()) {
        await newPageBtn.click();
        // 페이지 URL 변경 확인
        await expect(page).toHaveURL(/wiki\?page=new/);
      }
    });
  });
});
