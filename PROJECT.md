# Project: PMS Frontend Refactoring & Monorepo Migration

## Architecture
- **Monorepo**: Monorepo layout based on `npm workspaces`.
- **Frontend (Web)**: React Vite (TypeScript) SPA (`apps/web`).
- **Frontend (Desktop)**: Tauri-based desktop app (`apps/desktop`).
- **Shared Packages**:
  - `packages/ui`: Shared UI components.
  - `packages/shared`: Shared business logic, API client, type definitions.
- **Backend**: Rust (Axum) API (`backend`).
  - API port: 8000
  - Frontend Vite dev server proxy: 5173 -> 8000
  - Communication module: `packages/shared/src/lib/api.ts`

## Code Layout
- `apps/web/src/pages/`: Web route page components
- `apps/desktop/src/pages/`: Desktop route page components
- `packages/ui/src/`: Shared UI components (Badge, Button, Card, etc.)
- `packages/shared/src/types/`: Global type definitions
- `packages/shared/src/lib/`: Shared utilities and the API client

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Fix build errors and clean up the codebase | Remove duplicate keys from locale files, add the 'Check' icon to Chat.tsx, fix the memos filesize type access, clean up unused imports | None | DONE |
| 2 | Introduce global type definitions and remove `any` | Add a global type index file, audit `any` / `any[]` / `as any` and replace them with static types | M1 | DONE |
| 3 | Remove inline styles and align dark mode design tokens | Replace `style={{ ... }}` with Tailwind, remove hardcoded hex colours and map them to CSS theme variables | M2 | DONE |
| 4 | Split large components and extract custom hooks | Extract custom hooks and subcomponents from UsersManagement.tsx, Issues.tsx, Memos.tsx, IssueDetail.tsx (target: under 500 lines each) | M3 | DONE |
| 5 | Route lazy loading, accessibility focus control, responsive verification | Adopt React.lazy/Suspense in App.tsx, build a focus trap with Radix UI Dialog, strengthen aria-labels, switch to a responsive card view, verify the full build | M4 | DONE |
| 6 | Migrate to a monorepo architecture | Separate the web and desktop apps, package shared UI and logic (`packages/ui`, `packages/shared`) | M5 | DONE |

## Interface Contracts
### API ↔ Frontend (Strict Read-only)
- The type schema shared with the backend API is fixed. Do not change the `packages/shared/src/lib/api.ts` spec or the actual payload fields on the frontend side.
- The size field of a Memos API attachment is `filesize`, not `size`.
