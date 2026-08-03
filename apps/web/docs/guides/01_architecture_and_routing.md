# 01. Architecture and Routing

This document defines the project structure, how API calls are made, and the routing rules.

## 1. Project structure

### 1.1. Monorepo packages

```
packages/
├── shared/      # Shared hooks, data types, API client, i18n locales
│   └── src/
│       ├── hooks/     # LanguageContext, useTasks, useMilestones, ...
│       ├── locales/   # ko.ts, en.ts, ja.ts, zh.ts (single source of truth)
│       ├── types/     # Shared TypeScript types
│       └── lib/       # Shared utilities
└── ui/          # Shared UI components (Button, Card, Pagination,
                 #   TasksGanttChart, KanbanBoard<T>, ...)

apps/
├── web/         # Web app pages and app-specific components
└── desktop/     # Tauri desktop app pages and app-specific components
```

Anything used by both apps belongs in `packages/*`; only app-specific screens stay in `apps/*`.

### 1.2. App structure (`apps/web`, `apps/desktop`)

```
src/
├── App.tsx                           # Route definitions (react-router-dom)
├── main.tsx                          # Entry point (LanguageProvider → App)
├── index.css                         # Design tokens, Tailwind CSS setup
├── context/
│   ├── LanguageContext.tsx            # Re-export of shared/hooks/LanguageContext (t, formatDate, etc.)
│   └── ThemeContext.tsx               # Theme context (Dark/Light × Default/Warm/Lavender/Ocean/Amber)
├── pages/                            # Page components (one per route)
├── components/                       # Reusable components
│   ├── ui/                           # Shared UI components
│   ├── layout/                       # Layout components
│   └── <feature>/                    # Feature-specific components
├── hooks/                            # Custom hooks
├── types/                            # TypeScript type definitions
└── lib/                              # Utility functions
```

## 2. API call rules

- **Use relative paths**: When calling the API from frontend source (for example a `fetch` call), never hardcode an absolute URL that includes a host (such as `http://localhost:8000/api/...`). Always use the **relative path `/api/...`**.
- This keeps API communication working regardless of the port or host once everything is deployed as a single binary.
- **API helper**: Call the API consistently through the `api()` function defined in `src/lib/api.ts`.

## 3. Routing rules

- **SPA client-side routing**: The frontend uses client-side routing based on `react-router-dom`.
- Avoid `<a href="...">` for internal navigation because it triggers a full page reload. Use the `<Link to="...">` component or the `useNavigate` hook instead.
- **Lazy loading**: Load every page component lazily with `lazy()` and handle the loading state with `Suspense`.
- **Auth protection**: Routes wrapped in `ProtectedRoute` check the `user` value in `localStorage` and redirect unauthenticated users to `/login`.

### 3.1. Route list

| Path | Page component | Description |
|------|----------------|-------------|
| `/login` | `Login` | Sign in |
| `/register` | `Register` | Sign up |
| `/server-setup` | `ServerSetup` | Server setup (Tauri desktop) |
| `/dashboard` | `Dashboard` | Dashboard |
| `/projects` | `Projects` | Project list |
| `/projects/new` | `NewProject` | Create a project |
| `/projects/:id` | `ProjectDetail` | Project detail |
| `/projects/:id/members` | `ProjectMembers` | Project member management |
| `/projects/:id/wiki` | `ProjectWiki` | Project wiki |
| `/projects/:id/board` | `Board` | Project board |
| `/projects/:id/board/new` | `PostForm` | Create a post |
| `/projects/:id/board/:postId/edit` | `PostForm` | Edit a post |
| `/projects/:id/board/:postId` | `PostDetail` | Post detail |
| `/projects/:id/issues` | `Issues` | Project issue list |
| `/projects/:id/kanban` | `Kanban` | Kanban board |
| `/projects/:id/issues/new` | `NewIssue` | Create an issue |
| `/projects/:id/issues/:issueId` | `IssueDetail` | Issue detail |
| `/issues` | `Issues` | Global issue list |
| `/chat` | `Chat` | Realtime chat |
| `/memos` | `Memos` | Memo list |
| `/memos/:id` | `MemoDetail` | Memo detail |
| `/wiki` | `ProjectWiki` | Global wiki |
| `/users` | `UsersManagement` | User management |
| `/contacts` | `AddressBook` | Address book |
| `/admin/groups` | `AdminGroups` | Group management |
| `/admin/organization` | `Organization` | Organisation settings |
| `/admin/scheduler` | `Scheduler` | Scheduler |
| `/admin/logs` | `Logs` | Logs |
| `/boards` | → redirects to `/boards/notice` | Board list |
| `/boards/:boardType` | `BoardList` | List per board type |
| `/boards/:boardType/new` | `PostForm` | Create a board post |
| `/boards/:boardType/:postId/edit` | `PostForm` | Edit a board post |
| `/boards/:boardType/:postId` | `PostDetail` | Board post detail |
