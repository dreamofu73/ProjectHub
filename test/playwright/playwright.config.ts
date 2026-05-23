import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

/**
 * ProjectHub E2E 테스트 설정
 *
 * 사전 요구사항:
 *   - 백엔드 서버가 포트 8000에서 실행 중이어야 합니다
 *   - 또는 아래 webServer 설정이 자동으로 프론트엔드를 시작합니다
 *
 * 실행 방법:
 *   npx playwright test                    # 전체 테스트
 *   npx playwright test auth.spec.ts       # 특정 스펙만
 *   npx playwright test --headed           # 브라우저 창 표시
 *   npx playwright test --ui               # UI 모드
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  fullyParallel: false,       // 직렬 실행으로 서버 부하 최소화
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { outputFolder: 'report', open: 'never' }],
    ['list'],
  ],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'setup',
      testDir: './fixtures',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'fixtures/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
  /* 프론트엔드 dev 서버 자동 시작 (이미 실행 중이면 재사용) */
  webServer: {
    command: process.platform === 'win32'
      ? `cd /d "${ROOT}\\apps\\web" && npx vite --port 5173 --host`
      : `cd "${ROOT}/apps/web" && npx vite --port 5173 --host`,
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
