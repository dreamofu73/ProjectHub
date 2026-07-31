# ProjectHub (PMS)

이슈, 칸반, 위키, 채팅, 게시판을 하나로 통합한 프로젝트 관리 시스템입니다.
Rust(Axum) + React(Vite) + Tauri로 만들어졌으며, Web과 Desktop을 동시에 지원합니다.

> **English version:** [README.en.md](README.en.md)

---

## Tech Stack

### Backend
- **Framework:** [Axum](https://github.com/tokio-rs/axum) 0.7 (WebSocket, Multipart 지원)
- **Language:** Rust (Edition 2024)
- **ORM/Query Builder:** [SeaQuery](https://github.com/SeaQL/sea-query) 1.0 + [sqlx](https://github.com/launchbadge/sqlx) 0.9 (`AnyPool`)
- **Database:** SQLite3 · PostgreSQL · MySQL · MariaDB (멀티 DB 지원)
- **인증:** JWT (`jsonwebtoken`)
- **비밀번호 해싱:** Argon2
- **API 문서:** Swagger UI (`utoipa`)
- **로깅:** `tracing` + `file-rotate` (회전 로그)

### Frontend (Web & Desktop)
- **Framework:** [React](https://react.dev/) 19 (Vite 8)
- **Language:** TypeScript 6
- **Desktop App:** [Tauri](https://tauri.app/) (Rust 기반 네이티브)
- **UI 라이브러리:** [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/) 4
- **Rich Text Editor:** [Tiptap](https://tiptap.dev/) 3 (위키, 게시판)
- **Drag & Drop:** [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) (칸반 보드)
- **Icons:** [Lucide React](https://lucide.dev/)
- **E2E 테스트:** [Playwright](https://playwright.dev/) 1.60

---

## Features

| 영역 | 기능 |
|------|------|
| **프로젝트 관리** | 프로젝트 생성/설정, 멤버 초대/권한 관리 |
| **이슈 트래킹** | 이슈 생성/편집, 상태·우선순위·담당자 관리, 타임라인 |
| **일감 관리** | 태스크 생성/할당, 프로젝트별 일감 목록 |
| **칸반 보드** | 드래그 앤 드롭 기반 상태별 일감 보드 |
| **위키** | 프로젝트별 + 글로벌 위키, Markdown 에디터, 댓글 |
| **게시판** | 프로젝트별 + 글로벌(공지/자유/질문) 게시판, 댓글·첨부파일 |
| **대시보드** | 전체 프로젝트 현황, 최근 활동 피드, 통계 위젯 |
| **채팅** | 프로젝트별 실시간 채팅방 (WebSocket) |
| **쪽지(Memos)** | 사용자 간 쪽지, 휴지통·스팸 차단·폴더 관리 |
| **주소록** | 부서/그룹 기반 연락처 관리 |
| **관리자** | 사용자 관리, 조직도(부서), 스케줄러, 시스템 로그 |
| **사용자 인증** | 로그인/로그아웃, JWT 기반 인증 |
| **다국어(i18n)** | 한국어 · 영어 · 일본어 · 중국어 지원 |
| **테마** | Light / Dark / System 테마, 컬러 스와치 |
| **첨부파일** | 파일 업로드/다운로드, 이미지·문서 미리보기 |

---

## Project Structure

```
ProjectHub/
├── apps/
│   ├── web/                    웹 브라우저용 프런트엔드 (React Vite)
│   │   ├── src/
│   │   │   ├── pages/          페이지 컴포넌트
│   │   │   ├── components/     기능별 UI 컴포넌트
│   │   │   ├── context/        React Context (Theme, Language)
│   │   │   ├── locales/        다국어 (ko, en, ja, zh)
│   │   │   ├── hooks/          커스텀 React 훅
│   │   │   └── constants/      설정 상수
│   │   └── vite.config.ts
│   │
│   └── desktop/                Tauri 기반 데스크톱 앱
│       ├── src/                데스크톱 전용 UI
│       ├── src-tauri/          Tauri Rust 백엔드
│       └── vite.config.ts
│
├── packages/
│   ├── ui/                     공통 UI 컴포넌트 패키지
│   └── shared/                 공통 타입, API 클라이언트, 비즈니스 로직
│       └── src/types/          TypeScript 인터페이스
│
├── backend/                    Rust Axum REST API 서버
│   ├── src/
│   │   ├── main.rs             서버 진입점
│   │   ├── routes/             도메인별 라우트 핸들러
│   │   │   ├── auth.rs         인증 (JWT 발급/검증)
│   │   │   ├── projects.rs     프로젝트 CRUD
│   │   │   ├── issues.rs       이슈 CRUD
│   │   │   ├── tasks.rs        일감 CRUD
│   │   │   ├── wiki.rs         위키 CRUD
│   │   │   ├── posts.rs        게시판 CRUD
│   │   │   ├── chat.rs         실시간 채팅 (WebSocket)
│   │   │   ├── memos.rs        쪽지 기능
│   │   │   ├── attachments.rs  첨부파일 업로드/다운로드
│   │   │   ├── dashboard.rs    대시보드 통계
│   │   │   └── ...             그 외 도메인 모듈
│   │   └── db/
│   │       ├── schema.rs       DB 스키마 마이그레이션 (SeaQuery)
│   │       ├── pool.rs         연결 풀 관리
│   │       └── bind.rs         멀티 DB 바인딩 브리지
│   ├── examples/               예제 유틸리티 (gen_hash 등)
│   └── Cargo.toml
│
├── test/
│   ├── api/                    API 통합 테스트 (Vitest)
│   └── playwright/             E2E 테스트 (Playwright)
│       ├── tests/              테스트 스펙
│       └── fixtures/           글로벌 설정, 헬퍼
│
├── scripts/
│   ├── web/                    웹 앱 스크립트 (dev · build · run · release)
│   ├── desktop/                데스크톱 앱 스크립트 (dev · build · run · release)
│   └── web-*.sh / desktop-*.sh 하위 호환 래퍼
│
├── docs/                       개발 가이드 및 문서
├── LICENSE                     MIT 라이선스
├── README.en.md                영문 README
├── CLAUDE.md                   AI 에이전트 표준 가드레일
├── Cargo.toml                  Rust workspace 루트
└── package.json                npm workspace 루트
```

---

## Development & Build Scripts

스크립트는 **앱 유형 × 작업** 기준으로 `scripts/web/` · `scripts/desktop/` 하위에 분류되어 있습니다.
루트의 `scripts/web-*.sh` · `scripts/desktop-*.sh` 파일은 하위 호환 래퍼입니다.

### 🌐 웹 앱

| 작업 | 스크립트 (정식) | 래퍼 (하위 호환) | 설명 |
|------|----------------|-----------------|------|
| 개발 서버 | `./scripts/web/dev.sh` | `./scripts/web-dev.sh` | 백엔드 + Vite dev HMR 동시 기동 |
| 빌드 | `./scripts/web/build.sh` | `./scripts/web-build.sh` | 프런트엔드 + Rust 릴리즈 → `dist/web/pms` |
| 실행 | `./scripts/web/run.sh` | `./scripts/web-run.sh` | `dist/web/pms` 프로덕션 바이너리 실행 |
| 배포 패키지 | `./scripts/web/release.sh [VERSION]` | `./scripts/web-release.sh [VERSION]` | `release/pms-web-<ver>-<os>-<arch>.tgz/.zip` 생성 |

```bash
# 개발 워크플로우
./scripts/web/dev.sh

# 빌드 → 실행 워크플로우
./scripts/web/build.sh          # dist/web/pms 생성
./scripts/web/run.sh            # 서버 실행

# 배포 패키지 생성
VERSION=1.2.0 ./scripts/web/release.sh   # release/ 디렉터리에 아카이브 생성
```

### 🖥️ 데스크톱 앱 (Tauri)

| 작업 | 스크립트 (정식) | 래퍼 (하위 호환) | 설명 |
|------|----------------|-----------------|------|
| 개발 서버 | `./scripts/desktop/dev.sh` | `./scripts/desktop-dev.sh` | 백엔드 + Tauri dev 동시 기동 |
| 빌드 | `./scripts/desktop/build.sh` | `./scripts/desktop-build.sh` | 프런트엔드 + Tauri 번들 → `dist/desktop/bundle/` |
| 실행 | `./scripts/desktop/run.sh` | `./scripts/desktop-run.sh` | 빌드된 네이티브 앱 실행 |
| 배포 패키지 | `./scripts/desktop/release.sh [VERSION]` | `./scripts/desktop-release.sh [VERSION]` | `.dmg` / `.deb` / `.msi` + `.tgz/.zip` 생성 |

```bash
# 개발 워크플로우
./scripts/desktop/dev.sh

# 빌드 → 실행 워크플로우
./scripts/desktop/build.sh      # dist/desktop/bundle/ 생성
./scripts/desktop/run.sh        # 네이티브 앱 실행

# 배포 패키지 생성
VERSION=1.2.0 ./scripts/desktop/release.sh   # 플랫폼별 인스톨러 + 아카이브 생성
```

> **데스크톱 빌드 사전 조건**
> Rust 툴체인 필수 | macOS: Xcode Command Line Tools | Linux: `libwebkit2gtk-4.0-dev`, `libssl-dev`

### 🐳 Docker 배포

| 작업 | 스크립트 | 설명 |
|------|----------|------|
| 빌드 | `./scripts/docker-build.sh` | `pms-web:latest` Docker 이미지 빌드 |
| 실행 | `./scripts/docker-run.sh [PORT]` | 빌드된 이미지를 컨테이너로 실행 (기본 포트: 8000) |

```bash
./scripts/docker-build.sh           # 이미지 빌드
./scripts/docker-run.sh             # 기본 8000 포트로 실행
./scripts/docker-run.sh 8080        # 커스텀 포트로 실행
```

---

## 빌드 결과물 경로

| 앱 타입 | 결과물 경로 | 설명 |
|---------|------------|------|
| 웹 앱 | `dist/web/pms` | 백엔드 + 웹 프런트엔드 통합 단일 바이너리 |
| 데스크톱 앱 | `dist/desktop/bundle/` | Tauri 플랫폼별 번들 (`.dmg` / `.deb` / `.msi` 등) |
| 배포 아카이브 | `release/` | `.tgz` / `.zip` / `.dmg` / `.deb` / `.msi` |

---

## 데이터베이스

`sqlx::AnyPool` 기반으로 아래 DBMS를 지원합니다. 사용할 엔진은 설정 파일의 `database_url` 스킴으로 결정되며,
`DATABASE_URL` 환경변수가 있으면 그 값이 우선합니다.

| DBMS | `database_url` 예시 | 개발용 설정 파일 | compose 프로필 |
|------|--------------------|-----------------|----------------|
| SQLite (기본값) | `sqlite://./data/project-hub.db` | `config.sqlite.toml` | — |
| PostgreSQL | `postgres://pms_user:pms_password@localhost:5432/pms_db` | `config.postgres.toml` | `postgres` |
| MySQL | `mysql://pms_user:pms_password@localhost:3306/pms_db` | `config.mysql.toml` | `mysql` |
| MariaDB | `mariadb://pms_user:pms_password@localhost:3307/pms_db` | `config.mariadb.toml` | `mariadb` |

```bash
# DB 컨테이너와 함께 백엔드 개발 서버 기동
./scripts/dev-with-db.sh sqlite
./scripts/dev-with-db.sh postgres
./scripts/dev-with-db.sh mysql
./scripts/dev-with-db.sh mariadb
```

> MariaDB는 SQL 방언이 MySQL과 동일하게 처리됩니다. MariaDB 컨테이너는 호스트 **3307** 포트를 사용합니다.

---

## 설정 (config.toml)

루트의 `config.toml`이 없으면 백엔드 부트스트랩 시 자동 생성됩니다.

| 키 | 설명 | 기본값 |
|----|------|--------|
| `port` | 서버 포트 | `8000` |
| `jwt_secret` | JWT 서명 키 | (자동 생성) |
| `database_url` | DB 연결 문자열 | SQLite |
| `upload_dir` | 첨부파일 저장 경로 | `./data/attachments` |
| `admin_username` | 초기 관리자 아이디 | `admin` |
| `admin_password` | 초기 관리자 비밀번호 | `admin` |
| `log_max_size_mb` | 로그 회전 크기 | `50` |
| `log_max_files` | 로그 보존 파일 수 | `5` |

> **보안 필수 조치:** 운영 환경 배포 시 `jwt_secret`과 `admin_password`를 **반드시 안전한 임의의 값으로 변경**해야 합니다.

---

## 개발 가이드라인

이 프로젝트는 역할별 표준 가드레일을 별도 파일로 관리합니다. 모든 기여자는 반드시 숙지하십시오.

| 문서 | 경로 | 내용 |
|------|------|------|
| **AI 에이전트 가드레일** | `CLAUDE.md` | 프로젝트 전체 행동 규칙, 코드 수정 자율성, 검색 규칙 |
| **백엔드 가이드** | `backend/CLAUDE.md` | DB 쿼리 규칙 (SeaQuery), 라우팅, JWT, 빌드 제한 |
| **프런트엔드 가이드** | `apps/web/CLAUDE.md` | 아키텍처, UI 개발, i18n, 화면 패턴, 빌드 규칙 |
| **데스크톱 가이드** | `apps/desktop/CLAUDE.md` | 데스크톱 전용 규칙 (웹 가이드 공유) |

### 핵심 개발 규칙 요약

- **쿼리 작성:** 모든 SQL은 SeaQuery 빌더로 작성 (raw SQL 금지)
- **쿼리 실행:** `crate::db::{fetch_all, fetch_optional, execute}` 사용
- **라우트 등록:** `routes/mod.rs` → `ProtectedRoutes` / `PublicRoutes` 타입 사용
- **다국어:** `apps/web/src/locales/{ko,en,ja,zh}.ts` + `apps/desktop/src/locales/` 동기화
- **UI 스타일:** Tailwind CSS + CSS 변수 (Design Tokens), 모달 다이얼로그 사용 금지
- **빌드 실행:** `scripts/web-build.sh` 자동 실행 금지 (사용자 명시 요청 시에만)
- **E2E 테스트:** 자동 실행 금지 (사용자 명시 요청 시에만)

---

## E2E 테스트

Playwright 기반 E2E 테스트는 `test/playwright/` 디렉터리에 위치합니다.

```bash
# 테스트 실행
cd test/playwright
npx playwright install chromium    # 브라우저 설치 (최초 1회)
npx playwright test                # 전체 테스트 실행
npx playwright test --ui           # UI 모드로 실행
npx playwright test --headed       # 브라우저 창 표시
npx playwright show-report report  # HTML 리포트 열기
```

---

## 라이선스

이 프로젝트는 **MIT 라이선스** 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
