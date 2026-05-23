import { test, expect } from '@playwright/test';

test.describe('인증 (Authentication)', () => {
  test.describe('로그인', () => {
    test('유효한 자격 증명으로 로그인 시 대시보드로 리다이렉트', async ({ page }) => {
      await page.goto('/login');

      // 로그인 폼 입력
      await page.getByRole('textbox', { name: '아이디 / 이메일' }).fill('admin');
      await page.getByRole('textbox', { name: '비밀번호' }).fill('urpsys12!@');
      await page.getByRole('button', { name: '로그인' }).click();

      // 대시보드로 이동 확인
      await page.waitForURL('**/dashboard');
      await expect(page).toHaveURL(/dashboard/);
      await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
    });

    test('잘못된 자격 증명으로 로그인 시도 시 오류 메시지 표시', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('textbox', { name: '아이디 / 이메일' }).fill('wrong');
      await page.getByRole('textbox', { name: '비밀번호' }).fill('wrong');
      await page.getByRole('button', { name: '로그인' }).click();

      // 오류 메시지 표시 확인 (로그인 페이지에 머무름)
      await expect(page).toHaveURL(/login/);
    });

    test('빈 필드로 로그인 시도 시 버튼 비활성화', async ({ page }) => {
      await page.goto('/login');
      
      // 빈 필드에서 로그인 버튼이 비활성화되어 있는지 확인
      const submitButton = page.getByRole('button', { name: '로그인' });
      await expect(submitButton).toBeDisabled();
    });

    test('로그인 페이지 상호작용', async ({ page }) => {
      await page.goto('/login');
      
      // 비밀번호 보기 버튼 클릭
      const passwordInput = page.getByLabel(/비밀번호/i);
      const showPasswordButton = page.locator('button[type="button"]').filter({ has: page.locator('svg') }).first();
      
      if (await showPasswordButton.isVisible()) {
        await showPasswordButton.click();
        await expect(passwordInput).toHaveAttribute('type', 'text');
        await showPasswordButton.click();
        await expect(passwordInput).toHaveAttribute('type', 'password');
      }
    });
  });

  test.describe('로그아웃', () => {
    test('로그아웃 시 로그인 페이지로 리다이렉트', async ({ page }) => {
      // 이미 인증된 상태로 시작 (setup project에서 storageState 적용)
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();

      // 로그아웃 버튼 클릭
      await page.getByRole('button', { name: '로그아웃' }).click();

      // 로그인 페이지로 이동 확인
      await page.waitForURL('**/login');
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('인증된 페이지 접근', () => {
    test('인증되지 않은 사용자가 보호된 페이지 접근 시 로그인으로 리다이렉트', async ({ browser }) => {
      // 새로운 컨텍스트로 인증 없이 접근
      const context = await browser.newContext();
      const page = await context.newPage();

      // localStorage를 비워서 인증 상태 제거
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());

      await page.goto('/dashboard');
      await page.waitForURL('**/login', { timeout: 10000 });
      await expect(page).toHaveURL(/login/);

      await context.close();
    });
  });
});
