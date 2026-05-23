import { Page, expect } from '@playwright/test';

/** 백엔드 API 기본 URL */
export const API_BASE = 'http://localhost:8000/api';

/** 테스트용 랜덤 문자열 생성 */
export function randomString(len = 6): string {
  return Math.random().toString(36).substring(2, 2 + len);
}

/** 테스트용 타임스탬프 */
export function timestamp(): string {
  return Date.now().toString(36);
}

/**
 * 페이지가 로드될 때까지 대기
 */
export async function waitForPageLoad(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

/**
 * 토스트 메시지 확인
 */
export async function expectToast(page: Page, text: string) {
  const toast = page.locator('[role="status"], .toast, [data-sonner-toast]');
  await expect(toast.filter({ hasText: text })).toBeVisible({ timeout: 5000 });
}

/**
 * 확인 다이얼로그 처리 (confirm)
 */
export async function handleConfirm(page: Page, accept = true) {
  page.on('dialog', async (dialog) => {
    if (accept) {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  });
}

/**
 * API를 직접 호출하여 토큰 획득
 */
export async function getAuthToken(
  login = 'admin',
  password = 'urpsys12!@'
): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json();
  return data.token;
}
