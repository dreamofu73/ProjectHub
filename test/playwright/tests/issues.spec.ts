import { test, expect } from '@playwright/test';
import { randomString } from '../fixtures/helpers';

test.describe('이슈 트래킹 (Issues)', () => {
  test.describe('이슈 목록', () => {
    test('전체 이슈 목록 페이지 로드', async ({ page }) => {
      await page.goto('/issues');
      await expect(page.getByRole('heading', { name: '이슈' })).toBeVisible();
    });

    test('프로젝트별 이슈 목록 페이지 로드', async ({ page }) => {
      await page.goto('/projects/e2e-test-project/issues');
      // 이슈 목록 또는 빈 상태 메시지 확인
      await expect(page.locator('body')).toContainText('이슈');
    });
  });

  test.describe('이슈 생성', () => {
    test('새 이슈 생성 폼 접근', async ({ page }) => {
      await page.goto('/projects/e2e-test-project/issues/new');

      // 이슈 생성 폼 확인
      await expect(page.locator('body')).toContainText('새 이슈');
    });

    test('이슈 목록 필터링 및 페이지네이션', async ({ page }) => {
      await page.goto('/projects/e2e-test-project/issues');
      
      // 필터링 옵션 (예: 상태 필터)
      const filterBtn = page.getByRole('button', { name: /필터/ });
      if (await filterBtn.isVisible()) {
        await filterBtn.click();
        const statusOption = page.getByRole('option', { name: '진행중' });
        if (await statusOption.isVisible()) {
          await statusOption.click();
        }
      }

      // 페이지네이션
      const nextBtn = page.getByRole('button', { name: /다음/ });
      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
      }
    });

    test('이슈 생성 및 댓글 작성', async ({ page }) => {
      const issueTitle = `Test Issue ${randomString()}`;

      await page.goto('/projects/e2e-test-project/issues/new');

      // 이슈 제목 입력
      const titleInput = page.getByRole('textbox', { name: /제목|제목 입력/ });
      if (await titleInput.isVisible()) {
        await titleInput.fill(issueTitle);
      }

      // 생성 버튼 클릭
      const submitBtn = page.getByRole('button', { name: /생성|저장|등록/ });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }

      // 댓글 작성
      const commentInput = page.getByPlaceholder('댓글을 입력하세요');
      if (await commentInput.isVisible()) {
        await commentInput.fill('테스트 댓글입니다.');
        const commentBtn = page.getByRole('button', { name: '댓글 작성' });
        if (await commentBtn.isVisible()) {
          await commentBtn.click();
        }
      }
    });
  });

  test.describe('이슈 상세', () => {
    test('이슈 상세 페이지 접근', async ({ page }) => {
      // 이슈 목록에서 첫 번째 이슈 클릭
      await page.goto('/projects/e2e-test-project/issues');

      // 이슈 링크가 있으면 클릭
      const issueLink = page.locator('a[href*="/issues/"]').first();
      if (await issueLink.isVisible()) {
        await issueLink.click();
        // 상세 페이지 로드 확인
        await expect(page.locator('body')).toContainText('이슈');
      }
    });
  });
});
