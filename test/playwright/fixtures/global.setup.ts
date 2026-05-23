import { test as setup, expect } from '@playwright/test';

const authFile = 'fixtures/.auth/admin.json';

/**
 * 글로벌 인증 설정
 * 모든 테스트 전에 admin 계정으로 로그인하여 인증 상태를 저장합니다.
 */
setup('authenticate as admin', async ({ page }) => {
  // 로그인 페이지로 이동
  await page.goto('/login');

  // 로그인 폼 입력
  await page.getByRole('textbox', { name: '아이디 / 이메일' }).fill('admin');
  await page.getByRole('textbox', { name: '비밀번호' }).fill('admin123');

  // 로그인 버튼 클릭
  await page.getByRole('button', { name: '로그인' }).click();

  // 대시보드 리다이렉트 확인
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await expect(page).toHaveURL(/dashboard/);

  // 인증 상태 저장
  await page.context().storageState({ path: authFile });
});
