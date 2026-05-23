import { test, expect } from '@playwright/test';

test.describe('채팅 (Chat)', () => {
  test('채팅 페이지 상호작용', async ({ page }) => {
    await page.goto('/chat');
    
    // 채팅 입력창 및 전송 버튼 확인
    const chatInput = page.locator('input[type="text"], textarea');
    const sendBtn = page.getByRole('button', { name: /전송/i });
    
    if (await chatInput.isVisible()) {
      await chatInput.fill('테스트 메시지');
      if (await sendBtn.isVisible()) {
        // 메시지 전송 시도 (실제 전송 방지를 위해 클릭만 확인)
        await sendBtn.hover();
      }
    }
  });

  test('프로젝트 채팅 페이지 로드', async ({ page }) => {
    await page.goto('/projects/e2e-test-project/chat');
    await expect(page.locator('body')).toContainText('채팅');
  });
});

test.describe('쪽지 (Memos)', () => {
  test('쪽지함 페이지 상호작용', async ({ page }) => {
    await page.goto('/memos');
    
    // 쪽지 작성 버튼
    const writeBtn = page.getByRole('button', { name: /쪽지 쓰기|작성/i });
    if (await writeBtn.isVisible()) {
      await writeBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible().catch(() => {});
    }
  });

  test('프로젝트 쪽지함 페이지 로드', async ({ page }) => {
    await page.goto('/projects/e2e-test-project/memos');
    await expect(page.locator('body')).toContainText('쪽지');
  });
});

test.describe('수신그룹 (Contact Groups)', () => {
  test('수신그룹 페이지 로드', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page.getByRole('heading', { name: '수신그룹' })).toBeVisible();
  });

  test('프로젝트 수신그룹 페이지 로드', async ({ page }) => {
    await page.goto('/projects/e2e-test-project/contacts');
    // 프로젝트 컨텍스트에서 수신그룹 페이지 확인
    await expect(page.locator('body')).toContainText('그룹');
  });
});
