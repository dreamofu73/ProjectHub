# ProjectHub API Test Suite (TypeScript)

TypeScript/Vitest 기반의 백엔드 API 통합 테스트 스위트입니다. 기존 Bash 스크립트(`run.sh`)를 TypeScript로 재작성하여 타입 안전성, IDE 지원, 더 나은 디버깅을 제공합니다.

---

## 📁 구조

```
test/api/
├── package.json          # 의존성 및 스크립트
├── tsconfig.json         # TypeScript 설정
├── vitest.config.ts      # Vitest 설정
├── src/
│   ├── types/
│   │   └── index.ts      # 백엔드 API 응답 타입 정의 (전체 19개 도메인)
│   ├── client/
│   │   └── api-client.ts # 타입 안전한 API 클라이언트
│   └── utils/
│       └── helpers.ts    # 테스트 헬퍼 함수들
├── tests/
│   ├── setup.ts          # 전역 설정/티어다운, 팩토리, 모킹
│   ├── auth.test.ts      # 인증 테스트
│   ├── users.test.ts     # 사용자 관리
│   ├── projects.test.ts  # 프로젝트 CRUD
│   ├── issues.test.ts    # 이슈 CRUD
│   ├── custom-fields.test.ts  # 커스텀 필드
│   ├── milestones.test.ts     # 마일스톤
│   ├── wiki.test.ts          # 위키
│   ├── posts.test.ts         # 게시글
│   ├── comments.test.ts      # 댓글 (게시글/이슈)
│   ├── groups.test.ts        # 그룹
│   ├── address-book.test.ts  # 주소록
│   ├── tasks.test.ts         # 태스크
│   ├── memos.test.ts         # 메모
│   ├── notifications.test.ts # 알림
│   ├── search.test.ts        # 검색
│   ├── dashboard.test.ts     # 대시보드
│   ├── gantt.test.ts         # 간트 차트
│   ├── admin-org.test.ts     # 관리자 - 조직도
│   ├── admin-scheduler.test.ts # 관리자 - 스케줄러
│   ├── admin-logs.test.ts    # 관리자 - 로그
│   └── cleanup.test.ts       # 정리 테스트
└── README.md             # 이 문서
```

---

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd test/api
npm install
```

### 2. 백엔드 서버 실행 확인

테스트 전 백엔드 서버가 실행 중이어야 합니다:

```bash
# 개발 서버 (포트 8000)
./scripts/web-dev.sh

# 또는 프로덕션 빌드 후 실행
./scripts/web-build.sh && ./scripts/web-run.sh
```

### 3. 테스트 실행

```bash
# 전체 테스트 실행
npm test

# 감시 모드 (파일 변경 시 재실행)
npm run test:watch

# UI 모드 (브라우저에서 테스트 결과 확인)
npm run test:ui

# 커버리지 리포트
npm run test:coverage

# 타입 체크만
npm run typecheck
```

---

## ⚙️ 환경 변수

`.env` 파일 또는 환경 변수로 설정 가능:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `API_BASE_URL` | `http://localhost:8000` | 백엔드 API 베이스 URL |
| `ADMIN_USER` | `admin` | 관리자 아이디 |
| `ADMIN_PASS` | `admin123` | 관리자 비밀번호 |
| `TEST_USER` | `testuser` | 테스트 사용자 아이디 |
| `TEST_PASS` | `testpass123` | 테스트 사용자 비밀번호 |

**예시 `.env` 파일:**

```env
API_BASE_URL=http://localhost:8000
ADMIN_USER=admin
ADMIN_PASS=your_secure_password
TEST_USER=testuser
TEST_PASS=testpass123
```

---

## 📝 테스트 작성 가이드

### 기본 테스트 구조

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

### 팩토리 사용

```typescript
import { factories } from './setup';

// 랜덤한 고유 이름 생성
const project = factories.project({ 
  name: 'Custom Name',  // name만 오버라이드, 나머지는 자동 생성
  identifier: 'custom-id',
});

// 이슈 생성 시 프로젝트 ID 필수
const issue = factories.issue(projectId, { 
  subject: 'Critical Bug',
  priority: 'high',
});
```

### 헬퍼 함수

```typescript
import { 
  expectSuccess,      // 성공 응답 검증 + 데이터 반환
  assertHasId,        // 객체에 id 필수 존재 확인
  assertArrayNotEmpty, // 배열이 비어있지 않음 확인
  assertFieldExists,  // 특정 필드 존재 확인
  generateRandomString, // 고유 문자열 생성
  generateRandomEmail,  // 고유 이메일 생성
} from './setup';
```

---

## 🔧 API 클라이언트 사용법

### 직접 사용 (테스트 외부에서)

```typescript
import { ApiClient } from './src/client/api-client';

const api = new ApiClient({ baseUrl: 'http://localhost:8000' });

// 로그인
const login = await api.login('admin', 'admin123');
if (login.success) {
  api.setToken(login.data!.token);
  
  // 프로젝트 생성
  const project = await api.createProject({
    name: 'New Project',
    identifier: 'newproj',
  });
}
```

### 주요 메서드 (전체 19개 도메인)

| 도메인 | 주요 메서드 |
|--------|-------------|
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

## 🧪 테스트 실행 옵션

### 특정 테스트 파일만 실행

```bash
# 프로젝트 테스트만
npx vitest run tests/projects.test.ts

# 패턴 매칭
npx vitest run -t "should create"
```

### 병렬 실행 제어

```bash
# 순차 실행 (디버깅용)
npx vitest run --pool=forks --poolOptions.forks.singleFork

# 최대 병렬 수 제한
npx vitest run --poolOptions.threads.maxThreads=4
```

### 리포터 변경

```bash
# 기본 리포터
npx vitest run --reporter=verbose

# JSON 리포트 (CI 연동용)
npx vitest run --reporter=json --outputFile=results.json

# JUnit XML (Jenkins 등)
npx vitest run --reporter=junit --outputFile=junit.xml
```

---

## 🔍 디버깅 팁

### 1. VS Code 디버거 연동

`.vscode/launch.json`에 추가:

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

### 2. 콘솔 로그 출력

```typescript
it('should debug response', async () => {
  const response = await testContext.api!.createProject(factories.project());
  console.log('Response:', JSON.stringify(response, null, 2));
  // ...
});
```

### 3. 테스트 타임아웃 조정

```typescript
// 개별 테스트
it('slow test', async () => {
  // ...
}, 60000); // 60초

// 전역 (vitest.config.ts)
testTimeout: 30000,
hookTimeout: 30000,
```

---

## 📊 CI/CD 연동

### GitHub Actions 예시

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      # 필요시 DB 등 서비스 컨테이너 추가
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
          # 백엔드 빌드 및 실행 (별도 job 권장)
          cd ${{ github.workspace }}
          ./scripts/web-build.sh
          ./scripts/web-run.sh &
          sleep 10  # 서버 시작 대기
      
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

## 🐛 알려진 이슈 및 해결

### 1. `vitest/config` 모듈 없음 에러

```bash
npm install -D vitest@latest
```

### 2. 타입 에러: `ApiResponse` 등 찾을 수 없음

```bash
# tsconfig.json의 paths 확인
# "baseUrl": ".", "paths": { "@/*": ["src/*"] }
```

### 3. 백엔드 연결 실패

- 백엔드 서버가 실행 중인지 확인 (`curl http://localhost:8000/api/auth/login`)
- `API_BASE_URL` 환경 변수 확인
- 방화벽/프록시 설정 확인

### 4. 테스트 간 의존성 문제

- `beforeAll`/`afterAll`에서 공유 상태(`testContext`) 관리
- 각 테스트는 독립적으로 실행되어야 함
- 필요시 `cleanup.test.ts`에서 정리

---

## 📚 참고 자료

- [Vitest 문서](https://vitest.dev/)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [ProjectHub 백엔드 라우트](backend/src/routes/)

---

## 🤝 기여 가이드

1. 새 API 엔드포인트 추가 시:
   - `src/types/index.ts`에 타입 정의 추가
   - `src/client/api-client.ts`에 메서드 추가
   - `tests/` 하위에 테스트 파일 생성

2. 타입 안전성 유지:
   - `any` 사용 지양
   - 제네릭 활용
   - 엄격한 null 체크

3. 테스트 명명 규칙:
   - `should <동작> when <조건>`
   - 예: `should create project when valid data provided`

---

## 📄 라이선스

ProjectHub 프로젝트와 동일 라이선스 적용.