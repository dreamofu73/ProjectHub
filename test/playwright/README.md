# ProjectHub E2E 테스트 가이드

이 디렉터리는 [Playwright](https://playwright.dev/)를 사용하여 ProjectHub 웹 애플리케이션의 End-to-End 테스트를 수행합니다.

---

## 사전 요구 사항

### 1. 필수 소프트웨어

| 소프트웨어 | 버전 | 설치 방법 |
|-----------|------|----------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Node.js에 포함 |
| 백엔드 서버 | - | `./scripts/web/dev.sh` 또는 `./scripts/dev-with-db.sh postgres` |

### 2. 개발 서버 실행

테스트를 실행하려면 **백엔드 서버**(포트 8000)와 **프론트엔드 개발 서버**(포트 5173)가 모두 실행 중이어야 합니다.

```bash
# 터미널 1: 백엔드 + 프론트엔드 동시 실행
./scripts/web/dev.sh

# 또는 PostgreSQL 사용 시
./scripts/dev-with-db.sh postgres
```

> **참고:** `playwright.config.ts`에 `webServer` 설정이 포함되어 있어, Vite 개발 서버는 테스트 시작 시 자동으로 기동됩니다. 단, 이미 실행 중인 dev 서버가 있다면 이를 재사용합니다.

---

## 설치 및 설정

```bash
# 1. 테스트 의존성 설치
cd test/playwright
npm install

# 2. Playwright 브라우저 설치 (최초 1회)
npx playwright install chromium
```

---

## 테스트 실행

### 전체 테스트 실행

```bash
cd test/playwright
npm test
```

### 특정 스펙만 실행

```bash
npm test -- auth.spec.ts           # 인증 테스트
npm test -- dashboard.spec.ts      # 대시보드 테스트
npm test -- projects.spec.ts       # 프로젝트 관리 테스트
npm test -- issues.spec.ts         # 이슈 트래킹 테스트
npm test -- wiki.spec.ts           # 위키 테스트
npm test -- boards.spec.ts         # 게시판 테스트
npm test -- admin.spec.ts          # 관리자 테스트
```

### 브라우저 창 표시 (디버깅)

```bash
npm test -- --headed               # 브라우저 창을 보면서 실행
npm test -- --debug                # 디버그 모드 (Paused)
npm test -- --ui                   # Playwright UI 모드
```

### 특정 테스트만 실행

```bash
npm test -- -g "로그인"            # 테스트 이름으로 필터링
npm test -- -g "프로젝트 생성"      # 한국어 테스트 이름 지원
```

---

## 테스트 구조

```
test/playwright/
├── playwright.config.ts      # Playwright 설정
├── package.json              # 테스트 의존성
├── fixtures/
│   ├── global.setup.ts       # 글로벌 인증 설정 (admin 로그인)
│   └── helpers.ts            # 유틸리티 함수
├── tests/
│   ├── auth.spec.ts          # 인증 (로그인/로그아웃)
│   ├── dashboard.spec.ts     # 대시보드 위젯 및 내비게이션
│   ├── projects.spec.ts      # 프로젝트 CRUD
│   ├── issues.spec.ts        # 이슈 트래킹
│   ├── wiki.spec.ts          # 위키 (글로벌/프로젝트)
│   ├── boards.spec.ts        # 게시판 (공지/자유/질문)
│   ├── admin.spec.ts         # 관리자 페이지
│   ├── other-features.spec.ts    # 채팅, 쪽지, 주소록
│   └── project-features.spec.ts  # 칸반, 일감, 멤버
└── README.md                 # 이 문서
```

---

## 인증 방식

모든 테스트는 `fixtures/global.setup.ts`에 의해 자동으로 인증됩니다.

1. `setup` 프로젝트가 먼저 실행되어 admin 계정으로 로그인
2. 로그인 성공 시 인증 상태(`storageState`)를 `fixtures/.auth/admin.json`에 저장
3. `chromium` 프로젝트의 모든 테스트는 저장된 인증 상태를 자동으로 로드

> **기본 자격 증명:** `admin` / `urpsys12!@`

---

## 리포트 확인

```bash
npm run report    # HTML 리포트를 브라우저에서 열기
```

리포트는 `test/playwright/report/` 디렉터리에 생성됩니다.

---

## 커스터마이징

### 새 테스트 추가

`tests/` 디렉터리에 새 `.spec.ts` 파일을 생성하면 자동으로 인식됩니다.

```typescript
import { test, expect } from '@playwright/test';

test.describe('내 기능 테스트', () => {
  test('기본 동작 테스트', async ({ page }) => {
    await page.goto('/my-page');
    await expect(page.getByRole('heading', { name: '제목' })).toBeVisible();
  });
});
```

### 유틸리티 함수 사용

`fixtures/helpers.ts`에 정의된 유틸리티를 사용할 수 있습니다.

```typescript
import { randomString, waitForPageLoad } from '../fixtures/helpers';

test('데이터 생성 테스트', async ({ page }) => {
  const uniqueName = `Test ${randomString()}`;
  // ...
});
```

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `CI` | CI 환경에서 실행 시 재시도 및 직렬 실행 활성화 | `false` |

---

## 문제 해결

### 브라우저 설치 오류

```bash
npx playwright install --with-deps chromium
```

### 서버 연결 오류

```bash
# 백엔드 서버 확인
curl http://localhost:8000/api/auth/login

# 프론트엔드 서버 확인
curl http://localhost:5173
```

### 테스트 실패 시

1. `--headed` 모드로 실행하여 브라우저 화면 확인
2. `--debug` 모드로 실행하여 단계별 디버깅
3. `report/` 디렉터리의 HTML 리포트에서 스크린샷 및 트레이스 확인
