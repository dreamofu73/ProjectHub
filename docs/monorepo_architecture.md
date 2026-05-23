# 웹 & 데스크톱 앱 모노레포(Monorepo) 아키텍처 가이드

이 문서는 PMS 프로젝트의 프론트엔드를 **웹 앱(Web)**과 **데스크톱 앱(Desktop, Tauri)**으로 분리하면서도, 코드 재사용성과 유지보수성을 극대화하기 위한 **모노레포(Monorepo)** 구조 및 개발 가이드라인을 정의합니다.

---

## 1. 모노레포 도입 목적

- **코드 중복 제거**: UI 컴포넌트, API 클라이언트, 비즈니스 로직, 타입 정의를 한 곳(`packages/`)에서 관리하여 웹과 데스크톱 양쪽에 동일하게 적용합니다.
- **독립적인 빌드 환경**: 웹(SPA)과 데스크톱(Tauri)은 요구하는 빌드 설정과 보안 정책이 다릅니다. 이를 `apps/` 하위에서 완벽히 분리하여 충돌을 방지합니다.
- **유지보수성 향상**: 공통 로직의 버그를 수정하면 웹과 데스크톱 모두에 즉시 반영되며, 특정 플랫폼(예: 데스크톱 트레이 아이콘)의 버그는 해당 앱 코드만 수정하면 됩니다.

---

## 2. 권장 디렉토리 구조

`npm workspaces`를 활용하여 아래와 같이 구성되어 있습니다.

```text
ProjectHub/
├── apps/                         # 🚀 실행 가능한 애플리케이션 영역
│   ├── web/                      # [웹 앱 전용]
│   │   ├── src/                  # 웹 전용 라우팅, 페이지, 로직
│   │   ├── index.html
│   │   ├── package.json          # 의존성: "ui": "*", "shared": "*"
│   │   └── vite.config.ts        # 웹 전용 빌드 설정
│   │
│   └── desktop/                  # [데스크톱 앱 전용] (Tauri 기반)
│       ├── src/                  # 데스크톱 전용 UI (타이틀바, 네이티브 메뉴 연동 등)
│       ├── src-tauri/            # Tauri Rust 백엔드 (OS 네이티브 연동)
│       ├── index.html
│       ├── package.json          # 의존성: "ui": "*", "shared": "*"
│       └── vite.config.ts        # 데스크톱 전용 빌드 설정
│
├── packages/                     # 📦 공유 패키지 영역 (웹/데스크톱 공통 사용)
│   ├── ui/                       # 공통 UI 컴포넌트 (Button, Modal, Table 등)
│   │   ├── src/
│   │   └── package.json
│   └── shared/                   # 공통 비즈니스 로직, API 클라이언트 (api.ts), 타입 정의
│       ├── src/
│       └── package.json
│
├── backend/                      # ⚙️ Rust Axum API 서버
│   ├── src/
│   └── Cargo.toml
│
├── scripts/                      # 🔧 빌드·실행·배포 스크립트
│   ├── web/                      # 웹 앱 전용 (dev · build · run · release)
│   ├── desktop/                  # 데스크톱 앱 전용 (dev · build · run · release)
│   └── web-*.sh / desktop-*.sh  # 하위 호환 래퍼
│
├── dist/                         # 📦 빌드 결과물 (gitignore됨)
│   ├── web/                      # 웹 빌드 결과물
│   │   └── pms                  # 통합 단일 바이너리 (백엔드 + 프런트엔드)
│   └── desktop/
│       └── bundle/              # Tauri 플랫폼별 번들 (.dmg / .deb / .msi 등)
│
├── release/                      # 🚀 배포 아카이브 (.tgz / .zip / .dmg / .deb / .msi)
│
├── package.json                  # 최상위 Workspace 설정 (npm)
├── Cargo.toml                    # 최상위 Rust Workspace 설정
└── config.toml                   # 통합 설정 파일 (포트 · DB · JWT 등)
```

---

## 3. 유지보수를 위한 핵심 설계 원칙

### 3.1. 의존성(Dependency) 관리 원칙
- **공통 라이브러리**: `react`, `lucide-react` 등 웹과 데스크톱이 공통으로 사용하는 라이브러리는 최상위 루트 또는 `packages/ui`, `packages/shared`에서 관리합니다.
- **플랫폼 종속 라이브러리**: `@tauri-apps/api`와 같은 데스크톱 전용 라이브러리는 **반드시 `apps/desktop/package.json`에만 설치**해야 합니다. 웹 앱 빌드에 네이티브 모듈이 섞여 들어가는 것을 방지합니다.

### 3.2. 라우팅 (Routing) 전략 — 풀페이지 새로고침 지원

웹과 데스크톱은 브라우저 히스토리 처리 방식이 다르지만, **모두 풀페이지 새로고침(F5/Cmd+R)을 지원**하도록 설계합니다.

| 항목 | Web (`apps/web`) | Desktop (`apps/desktop`, Tauri) |
|------|------------------|--------------------------------|
| 라우터 | `BrowserRouter` | `HashRouter` |
| URL 형태 | `/projects/1/board` | `/#/projects/1/board` |
| 새로고침 | ✅ 네이티브 지원 | ✅ 해시 기반 지원 |
| SEO 친화 | ✅ | ❌ (데스크톱 앱이므로 불필요) |

#### 왜 HashRouter인가?

Tauri 데스크톱 앱은 로컬 파일 시스템(`tauri://localhost/`)에서 실행됩니다. `BrowserRouter`를 사용하면 새로고침 시 서버가 해당 경로의 `index.html`을 반환해야 하지만, Tauri의 asset 서버는SPA 라우팅을 지원하지 않습니다. 반면 `HashRouter`는 URL의 해시 부분(`#/...`)만 클라이언트가 처리하므로, 새로고침 시에도 현재 경로가 그대로 유지되어 안정적으로 동작합니다.

#### 새로고침 동작 원리

```
[Web - BrowserRouter]
사용자 F5 → 브라우저가 /projects/1/board 요청 → 서버가 index.html 반환 → React라우터가 /projects/1 매칭

[Desktop - HashRouter]  
사용자 F5 → Tauri가 tauri://localhost/ 요청 → index.html 반환 → React라우터가 #/projects/1 매칭
```

#### 주의사항
- 데스크톱 앱에서 `BrowserRouter`로 전환하려면, Tauri 설정에서 asset 프로토콜의 SPA 폴백을 활성화해야 합니다 (현재 미지원).
- URL에 해시(`#`)가 포함되는 것이 싫다면, Tauri v2의 커스텀 프로토콜 기능을 활용할 수 있지만 복잡도가 높아져 현재 구조를 유지합니다.

### 3.3. API 클라이언트 (`api.ts`) 및 환경 변수 처리
`packages/shared/src/lib/api.ts`에 공통 API 호출 로직을 둡니다. 단, Base URL은 환경에 따라 주입받아야 합니다.
- **Web**: 동일 도메인(또는 프록시)을 사용하므로 상대 경로(`/api/...`)를 사용할 수 있습니다.
- **Desktop**: 데스크톱 앱은 `localhost`나 `file://` 프로토콜에서 실행되므로, 백엔드 서버의 절대 경로(예: `http://localhost:8000`)를 명시적으로 주입해야 합니다.
  ```typescript
  // packages/shared/src/lib/api.ts
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  export const api = (path: string) => fetch(`${BASE_URL}${path}`);
  ```

### 3.4. UI 컴포넌트 (`packages/ui`) 설계
- `packages/ui` 내부의 컴포넌트는 **순수(Pure) 컴포넌트**로 작성합니다.
- 컴포넌트 내부에서 직접 API를 호출하거나 전역 상태(Redux, Zustand 등)에 강하게 결합되지 않도록 하고, 필요한 데이터와 콜백은 `props`로 전달받도록 설계합니다.
- 데스크톱 전용 UI(예: 커스텀 창 닫기/최소화 버튼)는 `packages/ui`가 아닌 `apps/desktop/src/components`에 위치시킵니다.

---

## 4. 스크립트 체계

스크립트는 **앱 유형 × 작업** 기준으로 `scripts/web/` · `scripts/desktop/` 하위에 분류되어 있습니다.  
루트의 `scripts/web-*.sh` · `scripts/desktop-*.sh` 파일은 **하위 호환 래퍼**로, 내부에서 정식 스크립트를 호출합니다.

### 🌐 웹 앱

| 작업 | 스크립트 (정식) | 래퍼 (하위 호환) | 설명 |
|------|----------------|-----------------|------|
| 개발 서버 | `./scripts/web/dev.sh` | `./scripts/web-dev.sh` | 백엔드 + Vite dev HMR 동시 기동 |
| 빌드 | `./scripts/web/build.sh` | `./scripts/web-build.sh` | 프런트엔드 + Rust 릴리즈 → `dist/web/pms` |
| 실행 | `./scripts/web/run.sh` | `./scripts/web-run.sh` | `dist/web/pms` 프로덕션 실행 |
| 배포 패키지 | `./scripts/web/release.sh [VERSION]` | `./scripts/web-release.sh [VERSION]` | `release/pms-web-<ver>-<os>-<arch>.tgz/.zip` |

### 🖥️ 데스크톱 앱 (Tauri)

| 작업 | 스크립트 (정식) | 래퍼 (하위 호환) | 설명 |
|------|----------------|-----------------|------|
| 개발 서버 | `./scripts/desktop/dev.sh` | `./scripts/desktop-dev.sh` | 백엔드 + Tauri dev 동시 기동 |
| 빌드 | `./scripts/desktop/build.sh` | `./scripts/desktop-build.sh` | 프런트엔드 + Tauri 릴리즈 → `dist/desktop/bundle/` |
| 실행 | `./scripts/desktop/run.sh` | `./scripts/desktop-run.sh` | 빌드된 네이티브 앱 실행 |
| 배포 패키지 | `./scripts/desktop/release.sh [VERSION]` | `./scripts/desktop-release.sh [VERSION]` | `.dmg` / `.deb` / `.msi` + `.tgz/.zip` |

---

## 5. 빌드 결과물 경로

| 앱 타입 | 빌드 결과물 | 배포 아카이브 |
|---------|------------|--------------|
| 웹 앱 | `dist/web/pms` (단일 바이너리) | `release/pms-web-<ver>-<os>-<arch>.tgz` |
| 데스크톱 앱 | `dist/desktop/bundle/` | `release/pms-desktop-<ver>-<os>-<arch>.<ext>` |

> **Tauri 빌드 중간 산출물**(`build/release/bundle/`)은 빌드 후 자동으로 `dist/desktop/bundle/`에 복사됩니다.

---

## 6. 마이그레이션(전환) 완료 상태

현재 프로젝트는 위 가이드라인에 따라 모노레포 구조로 전환 완료되었습니다.

- `npm install`을 통해 전체 워크스페이스의 의존성을 한 번에 설치할 수 있습니다.
- `./scripts/web/dev.sh` 또는 `./scripts/desktop/dev.sh`로 앱 유형별 개발 서버를 기동합니다.
- `./scripts/web/build.sh` / `./scripts/desktop/build.sh`로 앱 유형별 빌드를 수행합니다.
- 빌드 결과물은 모두 `dist/` 하위에 모입니다: `dist/web/pms` · `dist/desktop/bundle/`.
- `./scripts/web/release.sh` / `./scripts/desktop/release.sh`로 배포 패키지를 `release/`에 생성합니다.