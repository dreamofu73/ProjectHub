# ProjectHub API Test Suite (TypeScript)

A backend API integration test suite built on TypeScript and Vitest. It replaces the previous Bash script (`run.sh`) to provide type safety, IDE support, and better debugging.

---

## 📁 Layout

```
test/api/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vitest.config.ts      # Vitest configuration
├── src/
│   ├── types/
│   │   └── index.ts      # Backend API response types (all 19 domains)
│   ├── client/
│   │   └── api-client.ts # Type-safe API client
│   └── utils/
│       └── helpers.ts    # Test helper functions
├── tests/
│   ├── setup.ts          # Global setup/teardown, factories, mocks
│   ├── auth.test.ts      # Authentication
│   ├── users.test.ts     # User management
│   ├── projects.test.ts  # Project CRUD
│   ├── issues.test.ts    # Issue CRUD
│   ├── custom-fields.test.ts  # Custom fields
│   ├── milestones.test.ts     # Milestones
│   ├── wiki.test.ts          # Wiki
│   ├── posts.test.ts         # Posts
│   ├── comments.test.ts      # Comments (posts/issues)
│   ├── groups.test.ts        # Groups
│   ├── address-book.test.ts  # Address book
│   ├── tasks.test.ts         # Tasks
│   ├── memos.test.ts         # Memos
│   ├── notifications.test.ts # Notifications
│   ├── search.test.ts        # Search
│   ├── dashboard.test.ts     # Dashboard
│   ├── gantt.test.ts         # Gantt chart
│   ├── admin-org.test.ts     # Admin - organisation
│   ├── admin-scheduler.test.ts # Admin - scheduler
│   ├── admin-logs.test.ts    # Admin - logs
│   └── cleanup.test.ts       # Cleanup
└── README.md             # This document
```

---

## 🚀 Quick start

### 1. Install dependencies

```bash
cd test/api
npm install
```

### 2. Make sure the backend is running

The backend server must be running before the tests:

```bash
# Dev server (port 8000)
./scripts/web-dev.sh

# Or build and run the production binary
./scripts/web-build.sh && ./scripts/web-run.sh
```

### 3. Run the tests

```bash
# Run everything
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# UI mode (view results in a browser)
npm run test:ui

# Coverage report
npm run test:coverage

# Type check only
npm run typecheck
```

---

## ⚙️ Environment variables

Configure through a `.env` file or the environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:8000` | Backend API base URL |
| `ADMIN_USER` | `admin` | Admin login |
| `ADMIN_PASS` | `admin123` | Admin password |
| `TEST_USER` | `testuser` | Test user login |
| `TEST_PASS` | `testpass123` | Test user password |

**Example `.env`:**

```env
API_BASE_URL=http://localhost:8000
ADMIN_USER=admin
ADMIN_PASS=your_secure_password
TEST_USER=testuser
TEST_PASS=testpass123
```

---

## 📝 Writing tests

### Basic structure

```typescript
// tests/projects.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { testContext, factories, expectSuccess, assertHasId } from './setup';

describe('Projects API', () => {
  let projectId: number | string;

  it('should create a project', async () => {
    const response = await testContext.api!.createProject(
      factories.project({ name: 'My Test Project' })
    );
    const project = expectSuccess(response, 'Create project');
    assertHasId(project, 'Create project');
    projectId = project.id;
  });

  it('should list projects', async () => {
    const response = await testContext.api!.listProjects();
    const projects = expectSuccess(response, 'List projects');
    expect(projects.length).toBeGreaterThan(0);
  });

  it('should get project by id', async () => {
    const response = await testContext.api!.getProject(projectId);
    const project = expectSuccess(response, 'Get project');
    expect(project.id).toBe(projectId);
  });

  it('should update project', async () => {
    const response = await testContext.api!.updateProject(projectId, {
      name: 'Updated Project Name',
    });
    const project = expectSuccess(response, 'Update project');
    expect(project.name).toBe('Updated Project Name');
  });

  it('should delete project', async () => {
    const response = await testContext.api!.deleteProject(projectId);
    expectSuccess(response, 'Delete project');
  });
});
```

### Using factories

```typescript
import { factories } from './setup';

// Generates a unique random name
const project = factories.project({
  name: 'Custom Name',  // override only name; the rest is generated
  identifier: 'custom-id',
});

// Creating an issue requires a project ID
const issue = factories.issue(projectId, {
  subject: 'Critical Bug',
  priority: 'high',
});
```

### Helper functions

```typescript
import {
  expectSuccess,      // assert a successful response and return its data
  assertHasId,        // assert the object has an id
  assertArrayNotEmpty, // assert the array is not empty
  assertFieldExists,  // assert a specific field exists
  generateRandomString, // generate a unique string
  generateRandomEmail,  // generate a unique email
} from './setup';
```

---

## 🔧 Using the API client

### Direct use (outside of tests)

```typescript
import { ApiClient } from './src/client/api-client';

const api = new ApiClient({ baseUrl: 'http://localhost:8000' });

// Sign in
const login = await api.login('admin', 'admin123');
if (login.success) {
  api.setToken(login.data!.token);

  // Create a project
  const project = await api.createProject({
    name: 'New Project',
    identifier: 'newproj',
  });
}
```

### Main methods (all 19 domains)

| Domain | Methods |
|--------|---------|
| **Auth** | `login()`, `register()`, `getCurrentUser()` |
| **Users** | `listUsers()`, `getUser()`, `createUser()`, `updateUser()`, `deleteUser()` |
| **Projects** | `listProjects()`, `getProject()`, `createProject()`, `updateProject()`, `deleteProject()`, `listProjectMembers()`, `addProjectMember()` |
| **Issues** | `listIssues()`, `getIssue()`, `createIssue()`, `updateIssue()`, `deleteIssue()` |
| **Custom Fields** | `listCustomFields()`, `createCustomField()`, `updateCustomField()`, `deleteCustomField()`, `getCustomValues()`, `saveCustomValues()` |
| **Milestones** | `listMilestones()`, `getMilestone()`, `createMilestone()`, `updateMilestone()`, `deleteMilestone()` |
| **Wiki** | `listWikiPages()`, `getWikiPage()`, `createWikiPage()`, `updateWikiPage()`, `deleteWikiPage()`, `listWikiVersions()`, `restoreWikiVersion()` |
| **Posts** | `listPosts()`, `getPost()`, `createPost()`, `updatePost()`, `deletePost()` |
| **Comments** | `listPostComments()`, `createPostComment()`, `updatePostComment()`, `deletePostComment()`, `listIssueComments()`, `createIssueComment()`, `updateIssueComment()`, `deleteIssueComment()` |
| **Groups** | `listGroups()`, `getGroup()`, `createGroup()`, `updateGroup()`, `deleteGroup()`, `transferGroup()`, `listGroupMembers()`, `addGroupMember()`, `updateGroupMember()`, `removeGroupMember()`, `listGroupShares()`, `createGroupShare()`, `deleteGroupShare()`, `createGroupChatRoom()` |
| **Address Book** | `listAddressBookGroups()`, `getAddressBookGroup()`, `createAddressBookGroup()`, `updateAddressBookGroup()`, `deleteAddressBookGroup()`, `listAddressBookMembers()`, `addAddressBookMembers()`, `removeAddressBookMember()` |
| **Tasks** | `listTasks()`, `getTask()`, `createTask()`, `updateTask()`, `deleteTask()` |
| **Memos** | `listReceivedMemos()`, `listSentMemos()`, `getMemo()`, `createMemo()`, `updateMemo()`, `deleteMemo()` |
| **Notifications** | `listNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()` |
| **Search** | `search()` |
| **Dashboard** | `getDashboard()` |
| **Gantt** | `getGanttData()` |
| **Admin - Org** | `getOrganizationSettings()`, `updateOrganizationSettings()`, `listDepartments()`, `getDepartment()`, `createDepartment()`, `updateDepartment()`, `deleteDepartment()`, `listDepartmentMembers()` |
| **Admin - Scheduler** | `getSchedulerStatus()`, `triggerSchedulerJob()` |
| **Admin - Logs** | `listLogFiles()`, `getLogFile()`, `getLogConfig()`, `updateLogConfig()` |
| **Admin - Groups** | `adminListGroups()`, `adminGetGroup()`, `adminDeleteGroup()` |
| **Attachments** | `uploadAttachment()`, `deleteAttachment()` |

---

## 🧪 Run options

### Run a single test file

```bash
# Projects only
npx vitest run tests/projects.test.ts

# Pattern matching
npx vitest run -t "should create"
```

### Control parallelism

```bash
# Serial execution (for debugging)
npx vitest run --pool=forks --poolOptions.forks.singleFork

# Cap the number of threads
npx vitest run --poolOptions.threads.maxThreads=4
```

### Change the reporter

```bash
# Default reporter
npx vitest run --reporter=verbose

# JSON report (for CI)
npx vitest run --reporter=json --outputFile=results.json

# JUnit XML (Jenkins and friends)
npx vitest run --reporter=junit --outputFile=junit.xml
```

---

## 🔍 Debugging tips

### 1. VS Code debugger

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug API Tests",
  "program": "${workspaceFolder}/test/api/node_modules/vitest/vitest.mjs",
  "args": ["run", "tests/projects.test.ts"],
  "cwd": "${workspaceFolder}/test/api",
  "console": "integratedTerminal"
}
```

### 2. Console logging

```typescript
it('should debug response', async () => {
  const response = await testContext.api!.createProject(factories.project());
  console.log('Response:', JSON.stringify(response, null, 2));
  // ...
});
```

### 3. Adjusting timeouts

```typescript
// Per test
it('slow test', async () => {
  // ...
}, 60000); // 60 seconds

// Globally (vitest.config.ts)
testTimeout: 30000,
hookTimeout: 30000,
```

---

## 📊 CI/CD integration

### GitHub Actions example

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      # Add service containers (such as a database) if needed
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: test/api/package-lock.json

      - name: Install dependencies
        run: cd test/api && npm ci

      - name: Start backend
        run: |
          # Build and run the backend (a separate job is recommended)
          cd ${{ github.workspace }}
          ./scripts/web-build.sh
          ./scripts/web-run.sh &
          sleep 10  # wait for the server to start

      - name: Run API tests
        run: cd test/api && npm test
        env:
          API_BASE_URL: http://localhost:8000
          ADMIN_USER: admin
          ADMIN_PASS: ${{ secrets.ADMIN_PASSWORD }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: test/api/coverage/lcov.info
```

---

## 🐛 Known issues and fixes

### 1. `vitest/config` module not found

```bash
npm install -D vitest@latest
```

### 2. Type error: cannot find `ApiResponse` and friends

```bash
# Check the paths in tsconfig.json
# "baseUrl": ".", "paths": { "@/*": ["src/*"] }
```

### 3. Backend connection failure

- Confirm the backend is running (`curl http://localhost:8000/api/auth/login`)
- Check the `API_BASE_URL` environment variable
- Check firewall and proxy settings

### 4. Inter-test dependencies

- Manage shared state (`testContext`) in `beforeAll`/`afterAll`
- Each test must be able to run independently
- Clean up in `cleanup.test.ts` when necessary

---

## 📚 References

- [Vitest documentation](https://vitest.dev/)
- [TypeScript handbook](https://www.typescriptlang.org/docs/)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [ProjectHub backend routes](backend/src/routes/)

---

## 🤝 Contributing

1. When adding a new API endpoint:
   - Add the type definitions to `src/types/index.ts`
   - Add the method to `src/client/api-client.ts`
   - Create a test file under `tests/`

2. Keep it type-safe:
   - Avoid `any`
   - Use generics
   - Keep strict null checks

3. Test naming convention:
   - `should <behaviour> when <condition>`
   - Example: `should create project when valid data provided`

---

## 📄 License

Same license as the ProjectHub project.
