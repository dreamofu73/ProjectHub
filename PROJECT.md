# Project: PMS Frontend Refactoring & Monorepo Migration

## Architecture
- **Monorepo**: `npm workspaces` 기반의 모노레포 구조.
- **Frontend (Web)**: React Vite (TypeScript) SPA (`apps/web`).
- **Frontend (Desktop)**: Tauri 기반 데스크톱 앱 (`apps/desktop`).
- **Shared Packages**:
  - `packages/ui`: 공통 UI 컴포넌트.
  - `packages/shared`: 공통 비즈니스 로직, API 클라이언트, 타입 정의.
- **Backend**: Rust (Axum) API (`backend`).
  - API 포트: 8000
  - 프론트엔드 Vite 개발 서버 프록시: 5173 -> 8000
  - 통신 모듈: `packages/shared/src/lib/api.ts`

## Code Layout
- `apps/web/src/pages/`: 웹 라우트 페이지 컴포넌트
- `apps/desktop/src/pages/`: 데스크톱 라우트 페이지 컴포넌트
- `packages/ui/src/`: 공통 UI 컴포넌트 (Badge, Button, Card 등)
- `packages/shared/src/types/`: 글로벌 타입 정의 폴더
- `packages/shared/src/lib/`: 공통 유틸리티 및 API 클라이언트

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | 컴파일 빌드 오류 해결 및 코드 베이스 위생 정비 | locales 파일 중복 키 제거, Chat.tsx 'Check' 아이콘 추가, memos filesize 타입 접근 수정, 미사용 임포트 정리 | None | DONE |
| 2 | 글로벌 타입 정의 도입 및 any 타입 제거 | 글로벌 타입 index 파일 개설, any / any[] / as any 타입 점검 및 정적 타입 치환 | M1 | DONE |
| 3 | 인라인 스타일 제거 및 다크모드 디자인 토큰 일관성 확보 | style={{ ... }} 인라인 제거 후 Tailwind 전환, Hex 하드코딩 컬러 제거 및 CSS 테마 변수 매핑 | M2 | DONE |
| 4 | 대형 컴포넌트 분해 및 Custom Hooks 추출 | UsersManagement.tsx, Issues.tsx, Memos.tsx, IssueDetail.tsx 대상 Custom Hooks 및 하위 컴포넌트 분리 (라인수 500줄 이하 달성) | M3 | DONE |
| 5 | 라우트 지연 로딩, 웹 접근성 포커스 제어 및 반응형 최종 검증 | App.tsx React.lazy/Suspense 도입, Radix UI Dialog 도입을 통한 Focus Trap 구축, aria-label 보강, 반응형 카드뷰 전환 및 전체 빌드 검증 | M4 | DONE |
| 6 | 모노레포 아키텍처 전환 | 웹 앱과 데스크톱 앱 분리, 공통 UI 및 로직 패키지화 (`packages/ui`, `packages/shared`) | M5 | DONE |

## Interface Contracts
### API ↔ Frontend (Strict Read-only)
- 백엔드 API와의 타입 스키마는 고정되어 있으므로, 프론트엔드의 `packages/shared/src/lib/api.ts` 스펙 및 실제 Payload 필드를 임의로 변경하지 않아야 함.
- Memos API Attachment의 용량 필드는 `size`가 아닌 `filesize`임.
