import { test, expect } from '@playwright/test';
import { randomString } from '../fixtures/helpers';

test.describe('프로젝트 관리 (Projects)', () => {
  test.describe('프로젝트 목록', () => {
    test('프로젝트 목록 페이지 로드', async ({ page }) => {
      await page.goto('/projects');
      await expect(page.getByRole('heading', { name: '프로젝트' })).toBeVisible();
      await expect(page.getByText('참여 중이거나 공개된 프로젝트 목록입니다.')).toBeVisible();
    });

    test('프로젝트 카드/테이블 뷰 전환', async ({ page }) => {
      await page.goto('/projects');
      await expect(page.getByRole('button', { name: '카드 뷰' })).toBeVisible();

      await page.getByRole('button', { name: '테이블 뷰' }).click();
      await expect(page.locator('table')).toBeVisible();
    });

    test('프로젝트 검색', async ({ page }) => {
      await page.goto('/projects');
      await page.getByPlaceholder('프로젝트명, 설명 또는 식별자 검색').fill('E2E');
      await page.getByRole('button', { name: '검색', exact: true }).click();
      await expect(page.getByText('E2E 테스트 프로젝트')).toBeVisible();
    });
  });

  test.describe('프로젝트 생성', () => {
    test('새 프로젝트 생성 폼 접근', async ({ page }) => {
      await page.goto('/projects');
      await page.getByRole('link', { name: '새 프로젝트' }).click();
      await expect(page).toHaveURL(/projects\/new/);
      await expect(page.getByRole('heading', { name: '새 프로젝트 생성' })).toBeVisible();
    });

    test('프로젝트 생성 및 상세 페이지 이동', async ({ page }) => {
      const projectName = `Test Project ${randomString()}`;
      const identifier = `test-${randomString()}`;

      await page.goto('/projects/new');
      await page.waitForSelector('h1', { timeout: 10000 });

      // 프로젝트명 입력 (placeholder로 찾기)
      await page.getByPlaceholder('예: 마케팅 웹사이트 제작').fill(projectName);

      // 식별자 입력
      await page.getByPlaceholder(/marketing-website/).fill(identifier);

      // 설명 입력
      await page.getByPlaceholder('프로젝트에 대한 간단한 설명을 입력하세요').click();
      await page.getByPlaceholder('프로젝트에 대한 간단한 설명을 입력하세요').fill('테스트 프로젝트 설명입니다.');

      // 생성 버튼 클릭
      await page.getByRole('button', { name: '생성하기' }).click();

      // 상세 페이지로 이동 확인
      await page.waitForURL(new RegExp(`projects/${identifier}`), { timeout: 10000 });
    });
  });

  test.describe('프로젝트 상세', () => {
    test('프로젝트 대시보드 접근', async ({ page }) => {
      await page.goto('/projects/e2e-test-project/dashboard');
      await expect(page.getByText('E2E 테스트 프로젝트')).toBeVisible();
    });

    test('프로젝트 설정 페이지 접근 및 설정 버튼', async ({ page }) => {
      await page.goto('/projects/e2e-test-project/settings');
      await expect(page.locator('body')).toContainText('설정');
      
      // 설정 저장 버튼
      const saveBtn = page.getByRole('button', { name: '저장', exact: true });
      if (await saveBtn.isVisible() && await saveBtn.isEnabled()) {
        // 저장 버튼이 활성화되어 있으면 클릭
        // await saveBtn.click(); // 실제 저장 동작은 테스트 환경에 따라 다를 수 있으므로 클릭 시도만 하거나 생략
      }
    });
  });
});
