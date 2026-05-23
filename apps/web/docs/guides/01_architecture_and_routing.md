# 01. 아키텍처 및 라우팅 규칙

이 문서는 프로젝트 구조, API 호출 방식, 라우팅 규칙을 정의합니다.

## 1. 프로젝트 구조

```
src/
├── App.tsx                           # 라우팅 정의 (react-router-dom)
├── main.tsx                          # 진입점 (LanguageProvider → App)
├── index.css                         # 디자인 토큰, Tailwind CSS 설정
├── context/
│   ├── LanguageContext.tsx            # 다국어(i18n) Context (t, formatDate 등)
│   └── ThemeContext.tsx               # 테마 Context
├── locales/
│   ├── ko.ts                         # 한국어 번역
│   ├── en.ts                         # 영어 번역
│   ├── ja.ts                         # 일본어 번역
│   └── zh.ts                         # 중국어 번역
├── pages/                            # 페이지 컴포넌트 (라우트 단위)
├── components/                       # 재사용 컴포넌트
│   ├── ui/                           # 공통 UI 컴포넌트
│   ├── layout/                       # 레이아웃 관련 컴포넌트
│   └── <feature>/                    # 기능별 컴포넌트
├── hooks/                            # 커스텀 훅
├── types/                            # TypeScript 타입 정의
└── lib/                              # 유틸리티 함수
```

## 2. API 호출 규칙

- **상대 경로 사용**: 프런트엔드 소스코드(예: `fetch` 호출)에서 API를 호출할 때는 절대로 호스트명이 포함된 절대 경로(예: `http://localhost:8000/api/...`)를 하드코딩하지 말고, 반드시 **상대 경로 `/api/...`**를 사용하십시오.
- 이는 단일 바이너리로 통합 배포되었을 때 실행 포트나 호스트에 무관하게 API 통신이 작동하도록 하기 위함입니다.
- **API 호출 유틸리티**: `src/lib/api.ts`에 정의된 `api()` 함수를 통해 일관된 방식으로 API를 호출합니다.

## 3. 라우팅 규칙

- **SPA 클라이언트 사이드 라우팅**: 프런트엔드는 `react-router-dom` 기반의 클라이언트 사이드 라우팅을 지원합니다.
- 내부 페이지 전환 시 전체 페이지 새로고침을 유발하는 `<a href="...">` 태그 사용을 피하고, 프런트엔드 내부 이동은 반드시 `<Link to="...">` 컴포넌트나 `useNavigate` 훅을 사용하십시오.
- **지연 로딩**: 모든 페이지 컴포넌트는 `lazy()`를 사용하여 지연 로딩하고, `Suspense`로 로딩 상태를 처리합니다.
- **인증 보호**: `ProtectedRoute` 컴포넌트로 보호된 라우트는 `localStorage`의 `user` 값을 확인하여 인증되지 않은 사용자를 `/login`으로 리다이렉트합니다.

### 3.1. 전체 라우트 목록

| 경로 | 페이지 컴포넌트 | 설명 |
|------|----------------|------|
| `/login` | `Login` | 로그인 |
| `/register` | `Register` | 회원가입 |
| `/server-setup` | `ServerSetup` | 서버 설정 (Tauri 데스크톱) |
| `/dashboard` | `Dashboard` | 대시보드 |
| `/projects` | `Projects` | 프로젝트 목록 |
| `/projects/new` | `NewProject` | 새 프로젝트 생성 |
| `/projects/:id` | `ProjectDetail` | 프로젝트 상세 |
| `/projects/:id/members` | `ProjectMembers` | 프로젝트 멤버 관리 |
| `/projects/:id/wiki` | `ProjectWiki` | 프로젝트 위키 |
| `/projects/:id/board` | `Board` | 프로젝트 게시판 |
| `/projects/:id/board/new` | `PostForm` | 게시글 작성 |
| `/projects/:id/board/:postId/edit` | `PostForm` | 게시글 수정 |
| `/projects/:id/board/:postId` | `PostDetail` | 게시글 상세 |
| `/projects/:id/issues` | `Issues` | 프로젝트 이슈 목록 |
| `/projects/:id/kanban` | `Kanban` | 칸반 보드 |
| `/projects/:id/issues/new` | `NewIssue` | 새 이슈 생성 |
| `/projects/:id/issues/:issueId` | `IssueDetail` | 이슈 상세 |
| `/issues` | `Issues` | 통합 이슈 목록 |
| `/chat` | `Chat` | 실시간 채팅 |
| `/memos` | `Memos` | 쪽지 목록 |
| `/memos/:id` | `MemoDetail` | 쪽지 상세 |
| `/wiki` | `ProjectWiki` | 통합 위키 |
| `/users` | `UsersManagement` | 사용자 관리 |
| `/contacts` | `AddressBook` | 주소록 |
| `/admin/groups` | `AdminGroups` | 그룹 관리 |
| `/admin/organization` | `Organization` | 조직 정보 관리 |
| `/admin/scheduler` | `Scheduler` | 스케줄러 |
| `/admin/logs` | `Logs` | 로그 |
| `/boards` | → `/boards/notice` 리다이렉트 | 게시판 목록 |
| `/boards/:boardType` | `BoardList` | 게시판 타입별 목록 |
| `/boards/:boardType/new` | `PostForm` | 게시판 글쓰기 |
| `/boards/:boardType/:postId/edit` | `PostForm` | 게시판 글 수정 |
| `/boards/:boardType/:postId` | `PostDetail` | 게시판 글 상세 |
