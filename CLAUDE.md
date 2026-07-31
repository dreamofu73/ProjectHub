# Project Hub (PMS) 개발 표준 가드레일 (CLAUDE.md)

이 프로젝트는 **Rust (Axum) 백엔드**와 **React Vite (TypeScript) 프런트엔드(Web/Desktop)**로 구성된 프로젝트 관리 시스템입니다. 프로젝트의 일관된 코드 품질과 단일 바이너리 빌드 호환성을 유지하기 위해 표준 가드레일을 역할별로 분리하여 관리합니다.

> [!IMPORTANT]
> 분야별 구체적인 개발 가이드라인은 다음 개별 파일을 반드시 참조하십시오:
> - **백엔드 개발 규칙**: [backend/CLAUDE.md](backend/CLAUDE.md)
> - **웹 프런트엔드 개발 규칙**: [apps/web/CLAUDE.md](apps/web/CLAUDE.md)
> - **데스크톱 앱 개발 규칙**: [apps/desktop/CLAUDE.md](apps/desktop/CLAUDE.md)

---

## 1. AI 에이전트 행동 및 작업 관리 규칙

### ⚡ 코드 수정 자율성 규칙
- **사전 승인 생략**: 소스코드 수정이나 파일 생성/변경이 필요한 경우, 매번 사용자에게 변경 허가를 묻거나 승인을 대기하지 않고 **직접 툴을 호출하여 즉시 코드를 반영**한 뒤 결과만 간결하게 보고하세요.
- **자율적 구현**: 구현 세부 사항에 대한 확신이 있는 경우, 질문 단계를 생략하고 현대적 모던 웹 표준 및 기법에 따라 자율적으로 코드를 갱신합니다.

### 🔍 코드 검색 및 탐색 규칙 (CodeGraph)
- **단순 텍스트 검색 지양 및 CodeGraph 우선 사용**: 코드베이스를 파악하거나 특정 심볼(함수, 클래스, 변수 등)을 찾을 때, 단순 텍스트 기반의 `grep`, `find`, `cat` 또는 파일 전체 읽기(`Read`)를 수행하기 **전에 반드시 CodeGraph를 사용하여 함수의 의존성과 호출 관계를 먼저 구조적으로 분석**하세요.
- **MCP 툴 활용**: `codegraph_explore` 툴을 사용하여 자연어 질문이나 심볼 이름을 검색하면, 관련 코드의 원문과 더불어 호출 경로(Call path) 및 의존성(Blast radius)을 한 번에 파악할 수 있어 무분별한 텍스트 검색으로 인한 컨텍스트 낭비를 막아줍니다.
- **쉘 명령어 활용**: MCP 툴 사용이 여의치 않은 경우, 터미널에서 `codegraph explore "<검색어>"` 명령어를 실행하여 동일한 결과를 얻을 수 있습니다.

### 🧪 브라우저 테스트 최소화 규칙
- **브라우저 테스트는 최후 수단으로만 사용**합니다. 코드 변경 후 검증은 아래 우선순위에 따라 수행합니다:
  1. **정적 분석 우선**: 프론트엔드는 Vite 빌드(`npm run build --workspaces`), 백엔드는 Rust(`cargo check`) 등 컴파일·타입 검사로 1차 검증합니다.
  2. **로그/터미널 확인**: 백엔드 API 동작은 `curl` 또는 터미널 로그로 확인합니다.
  3. **브라우저 테스트 허용 범위**: 다음 경우에만 제한적으로 사용합니다.
     - 시각적 UI 레이아웃·애니메이션 확인이 반드시 필요한 경우
     - 복잡한 사용자 인터랙션(드래그, 멀티스텝 플로우 등) 검증이 필요한 경우
- **생략 가능 케이스**: 로직 버그 수정, 타입 오류 수정, 스타일 소폭 조정, API 연동 로직 변경 등 코드 분석만으로 정확성을 판단할 수 있는 작업은 브라우저 없이 완료합니다.

### 📁 아티팩트 및 산출물 관리 규칙
- **산출물 저장 위치**: 세션 진행 중 생성되는 모든 `walkthrough.md`, `task.md`, `plan.md` 등 산출물 파일은 글로벌 디렉터리가 아닌, 현재 워크스페이스의 [docs](docs) 경로에 요청 별로 생성하고 지속적으로 업데이트하세요. (해당 디렉터리가 없다면 자동으로 생성한 뒤 파일을 배치하세요)
- **작성 언어**: 모든 문서는 **한국어**를 사용하여 작성합니다.
- **일회성 스크립트 및 임시 코드 관리**: 데이터 마이그레이션, 리팩토링, 자동화 스크립트 등 작업을 위해 임시로 생성하는 코드는 반드시 프로젝트 루트의 `tmp/` 디렉터리 내에 생성하여 작업하세요. (해당 디렉터리가 없다면 생성 후 사용) 작업이 완료된 이후에는 생성했던 임시 파일들을 반드시 삭제하여 프로젝트 루트를 깔끔하게 유지하세요.

---

## 2. 프로젝트 실행 및 설정 규칙

### 🌐 웹 앱 스크립트

| 단계 | 스크립트 (정식) | 래퍼 (하위 호환) | 설명 |
|------|----------------|-----------------|------|
| 개발 서버 | `./scripts/web/dev.sh` | `./scripts/web-dev.sh` | 백엔드 + Vite dev 동시 기동 (HMR 포함) |
| 소스 빌드 | `./scripts/web/build.sh` | `./scripts/web-build.sh` | frontend 빌드 → Rust release 빌드 → `dist/web/pms` 생성 |
| 실행 | `./scripts/web/run.sh` | `./scripts/web-run.sh` | `dist/web/pms` 프로덕션 바이너리 포그라운드 실행 |
| 배포 패키지 | `./scripts/web/release.sh [VERSION]` | `./scripts/web-release.sh [VERSION]` | `release/pms-web-<ver>-<os>-<arch>.tgz/.zip` 생성 |

```bash
# 개발 워크플로우
./scripts/web/dev.sh                         # 개발 서버 기동

# 빌드 → 실행 워크플로우
./scripts/web/build.sh                       # 빌드 (dist/web/pms 생성)
./scripts/web/run.sh                         # 실행

# 배포 패키지 생성
VERSION=1.2.0 ./scripts/web/release.sh      # release/ 디렉터리에 아카이브 생성
```

---

### 🖥️ 데스크톱 앱 스크립트 (Tauri)

| 단계 | 스크립트 (정식) | 래퍼 (하위 호환) | 설명 |
|------|----------------|-----------------|------|
| 개발 서버 | `./scripts/desktop/dev.sh` | `./scripts/desktop-dev.sh` | 백엔드 + Tauri dev 동시 기동 |
| 소스 빌드 | `./scripts/desktop/build.sh` | `./scripts/desktop-build.sh` | frontend 빌드 → Tauri 릴리즈 번들 → `dist/desktop/bundle/` 생성 |
| 실행 | `./scripts/desktop/run.sh` | `./scripts/desktop-run.sh` | 빌드된 네이티브 앱 실행 |
| 배포 패키지 | `./scripts/desktop/release.sh [VERSION]` | `./scripts/desktop-release.sh [VERSION]` | `release/pms-desktop-<ver>.[tgz\|zip\|dmg\|deb\|msi]` 생성 |

```bash
# 개발 워크플로우
./scripts/desktop/dev.sh                         # Tauri 개발 서버 기동

# 빌드 → 실행 워크플로우
./scripts/desktop/build.sh                       # Tauri 번들 빌드 (dist/desktop/bundle/ 생성)
./scripts/desktop/run.sh                         # 네이티브 앱 실행

# 배포 패키지 생성
VERSION=1.2.0 ./scripts/desktop/release.sh      # 플랫폼별 인스톨러 + 아카이브 생성
```

> [!NOTE]
> 데스크톱 빌드에는 Rust 툴체인과 플랫폼별 네이티브 빌드 도구가 필요합니다.
> macOS: Xcode Command Line Tools / Linux: libwebkit2gtk-4.0-dev, libssl-dev

---

### ⚙️ 설정 파일 관리 (config.toml)
- 루트 `config.toml`이 없으면 백엔드 부트스트랩 시 자동 생성됩니다.
- **주요 설정 키**: `port`, `jwt_secret`, `database_url`, `upload_dir`, `admin_username`, `admin_password`, `allowed_extensions`, `log_max_size_mb`, `log_max_files`.
- **보안 필수 조치**: 실제 운영 서버 배포 시 `jwt_secret`과 `admin_password`는 **반드시 안전한 임의의 값으로 변경**해야 합니다.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
