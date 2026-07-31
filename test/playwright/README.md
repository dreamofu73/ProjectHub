# ProjectHub E2E Test Guide

This directory runs End-to-End tests against the ProjectHub web application using [Playwright](https://playwright.dev/).

---

## Prerequisites

### 1. Required software

| Software | Version | How to install |
|----------|---------|----------------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Bundled with Node.js |
| Backend server | - | `./scripts/web/dev.sh` or `./scripts/dev-with-db.sh postgres` |

### 2. Start the dev servers

Both the **backend server** (port 8000) and the **frontend dev server** (port 5173) must be running before the tests.

```bash
# Terminal 1: run backend and frontend together
./scripts/web/dev.sh

# Or, when using PostgreSQL
./scripts/dev-with-db.sh postgres
```

> **Note:** `playwright.config.ts` contains a `webServer` block, so the Vite dev server starts automatically when the tests run. An already-running dev server is reused instead.

---

## Installation and setup

```bash
# 1. Install test dependencies
cd test/playwright
npm install

# 2. Install the Playwright browser (first time only)
npx playwright install chromium
```

---

## Running tests

### Run everything

```bash
cd test/playwright
npm test
```

### Run a single spec

```bash
npm test -- auth.spec.ts           # authentication
npm test -- dashboard.spec.ts      # dashboard
npm test -- projects.spec.ts       # project management
npm test -- issues.spec.ts         # issue tracking
npm test -- wiki.spec.ts           # wiki
npm test -- boards.spec.ts         # boards
npm test -- admin.spec.ts          # admin
```

### Show the browser window (debugging)

```bash
npm test -- --headed               # run with a visible browser window
npm test -- --debug                # debug mode (paused)
npm test -- --ui                   # Playwright UI mode
```

### Run a specific test

```bash
npm test -- -g "로그인"            # filter by test name
npm test -- -g "프로젝트 생성"      # Korean test names are supported
```

---

## Test layout

```
test/playwright/
├── playwright.config.ts      # Playwright configuration
├── package.json              # Test dependencies
├── fixtures/
│   ├── global.setup.ts       # Global auth setup (admin sign-in)
│   └── helpers.ts            # Utility functions
├── tests/
│   ├── auth.spec.ts          # Authentication (sign in/out)
│   ├── dashboard.spec.ts     # Dashboard widgets and navigation
│   ├── projects.spec.ts      # Project CRUD
│   ├── issues.spec.ts        # Issue tracking
│   ├── wiki.spec.ts          # Wiki (global/project)
│   ├── boards.spec.ts        # Boards (notice/free/question)
│   ├── admin.spec.ts         # Admin pages
│   ├── other-features.spec.ts    # Chat, memos, address book
│   └── project-features.spec.ts  # Kanban, tasks, members
└── README.md                 # This document
```

---

## Authentication

Every test is authenticated automatically by `fixtures/global.setup.ts`.

1. The `setup` project runs first and signs in with the admin account.
2. On success the authentication state (`storageState`) is written to `fixtures/.auth/admin.json`.
3. All tests in the `chromium` project load that saved state automatically.

> **Default credentials:** `admin` / `urpsys12!@`

---

## Reports

```bash
npm run report    # open the HTML report in a browser
```

Reports are generated in `test/playwright/report/`.

---

## Customisation

### Adding a test

Create a new `.spec.ts` file under `tests/` and it is picked up automatically.

```typescript
import { test, expect } from '@playwright/test';

test.describe('내 기능 테스트', () => {
  test('기본 동작 테스트', async ({ page }) => {
    await page.goto('/my-page');
    await expect(page.getByRole('heading', { name: '제목' })).toBeVisible();
  });
});
```

### Using the helpers

Utilities defined in `fixtures/helpers.ts` are available to every test.

```typescript
import { randomString, waitForPageLoad } from '../fixtures/helpers';

test('데이터 생성 테스트', async ({ page }) => {
  const uniqueName = `Test ${randomString()}`;
  // ...
});
```

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CI` | Enables retries and serial execution in CI | `false` |

---

## Troubleshooting

### Browser installation errors

```bash
npx playwright install --with-deps chromium
```

### Server connection errors

```bash
# Check the backend server
curl http://localhost:8000/api/auth/login

# Check the frontend server
curl http://localhost:5173
```

### When a test fails

1. Run with `--headed` to watch the browser.
2. Run with `--debug` to step through the test.
3. Inspect the screenshots and traces in the HTML report under `report/`.
