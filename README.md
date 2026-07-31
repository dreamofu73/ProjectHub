# ProjectHub (PMS)

An integrated project management system combining Issues, Kanban, Wiki, Chat, and Bulletin Board.
Built with Rust (Axum) + React (Vite) + Tauri, supporting both Web and Desktop.

> **한국어 버전:** [README.ko.md](README.ko.md)

---

## Tech Stack

### Backend
- **Framework:** [Axum](https://github.com/tokio-rs/axum) 0.7 (WebSocket, Multipart support)
- **Language:** Rust (Edition 2024)
- **ORM/Query Builder:** [SeaQuery](https://github.com/SeaQL/sea-query) 1.0 + [sqlx](https://github.com/launchbadge/sqlx) 0.9 (`AnyPool`)
- **Database:** SQLite3 · PostgreSQL · MySQL · MariaDB (Multi-DB support)
- **Authentication:** JWT (`jsonwebtoken`)
- **Password Hashing:** Argon2
- **API Documentation:** Swagger UI (`utoipa`)
- **Logging:** `tracing` + `file-rotate` (rotating logs)

### Frontend (Web & Desktop)
- **Framework:** [React](https://react.dev/) 19 (Vite 8)
- **Language:** TypeScript 6
- **Desktop App:** [Tauri](https://tauri.app/) (Rust-based native)
- **UI Library:** [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/) 4
- **Rich Text Editor:** [Tiptap](https://tiptap.dev/) 3 (Wiki, Boards)
- **Drag & Drop:** [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) (Kanban Board)
- **Icons:** [Lucide React](https://lucide.dev/)
- **E2E Testing:** [Playwright](https://playwright.dev/) 1.60

---

## Features

| Area | Features |
|------|----------|
| **Project Management** | Create/configure projects, invite members, role-based permissions |
| **Issue Tracking** | Create/edit issues, status/priority/assignee management, timeline |
| **Task Management** | Create/assign tasks, project-scoped task lists |
| **Kanban Board** | Drag-and-drop board by status |
| **Wiki** | Project-scoped + global wiki, Markdown editor, comments |
| **Boards** | Project-scoped + global (Announcements/Free/Q&A) boards, comments & attachments |
| **Dashboard** | Project overview, recent activity feed, statistics widgets |
| **Chat** | Real-time project chat rooms (WebSocket) |
| **Memos** | User-to-user messaging, trash/spam/folder management |
| **Address Book** | Department/group-based contact management |
| **Admin** | User management, org chart (departments), scheduler, system logs |
| **Authentication** | Login/logout, JWT-based auth |
| **i18n** | Korean · English · Japanese · Chinese |
| **Theming** | Light / Dark / System themes, color swatches |
| **Attachments** | File upload/download, image/document preview |

---

## Project Structure

```
ProjectHub/
├── apps/
│   ├── web/                    Web frontend (React Vite)
│   │   ├── src/
│   │   │   ├── pages/          Page components
│   │   │   ├── components/     Feature-specific UI components
│   │   │   ├── context/        React Context (Theme, Language)
│   │   │   ├── locales/        i18n (ko, en, ja, zh)
│   │   │   ├── hooks/          Custom React hooks
│   │   │   └── constants/      Configuration constants
│   │   └── vite.config.ts
│   │
│   └── desktop/                Tauri-based desktop app
│       ├── src/                Desktop-specific UI
│       ├── src-tauri/          Tauri Rust backend
│       └── vite.config.ts
│
├── packages/
│   ├── ui/                     Shared UI component package
│   └── shared/                 Shared types, API client, business logic
│       └── src/types/          TypeScript interfaces
│
├── backend/                    Rust Axum REST API server
│   ├── src/
│   │   ├── main.rs             Server entry point
│   │   ├── routes/             Domain-specific route handlers
│   │   │   ├── auth.rs         Auth (JWT issue/verify)
│   │   │   ├── projects.rs     Project CRUD
│   │   │   ├── issues.rs       Issue CRUD
│   │   │   ├── tasks.rs        Task CRUD
│   │   │   ├── wiki.rs         Wiki CRUD
│   │   │   ├── posts.rs        Board CRUD
│   │   │   ├── chat.rs         Real-time chat (WebSocket)
│   │   │   ├── memos.rs        Memo feature
│   │   │   ├── attachments.rs  File upload/download
│   │   │   ├── dashboard.rs    Dashboard statistics
│   │   │   └── ...             Other domain modules
│   │   └── db/
│   │       ├── schema.rs       DB schema migrations (SeaQuery)
│   │       ├── pool.rs         Connection pool management
│   │       └── bind.rs         Multi-DB binding bridge
│   ├── examples/               Example utilities (gen_hash, etc.)
│   └── Cargo.toml
│
├── test/
│   ├── api/                    API integration tests (Vitest)
│   └── playwright/             E2E tests (Playwright)
│       ├── tests/              Test specs
│       └── fixtures/           Global setup, helpers
│
├── scripts/
│   ├── web/                    Web app scripts (dev · build · run · release)
│   ├── desktop/                Desktop app scripts (dev · build · run · release)
│   └── web-*.sh / desktop-*.sh  Backward-compatible wrappers
│
├── docs/                       Development guides & documentation
├── LICENSE                     MIT License
├── README.ko.md                Korean README
├── CLAUDE.md                   AI agent standard guardrails
├── Cargo.toml                  Rust workspace root
└── package.json                npm workspace root
```

---

## Development & Build Scripts

Scripts are organized by **app type × task** under `scripts/web/` and `scripts/desktop/`.
Root-level `scripts/web-*.sh` and `scripts/desktop-*.sh` are backward-compatible wrappers.

### 🌐 Web App

| Task | Script (Official) | Wrapper (Compat) | Description |
|------|-------------------|------------------|-------------|
| Dev Server | `./scripts/web/dev.sh` | `./scripts/web-dev.sh` | Backend + Vite dev with HMR |
| Build | `./scripts/web/build.sh` | `./scripts/web-build.sh` | Frontend + Rust release → `dist/web/pms` |
| Run | `./scripts/web/run.sh` | `./scripts/web-run.sh` | Run `dist/web/pms` production binary |
| Release Package | `./scripts/web/release.sh [VERSION]` | `./scripts/web-release.sh [VERSION]` | Create `release/pms-web-<ver>-<os>-<arch>.tgz/.zip` |

```bash
# Development workflow
./scripts/web/dev.sh

# Build → Run workflow
./scripts/web/build.sh          # Creates dist/web/pms
./scripts/web/run.sh            # Run server

# Create release package
VERSION=1.2.0 ./scripts/web/release.sh   # Archives in release/
```

### 🖥️ Desktop App (Tauri)

| Task | Script (Official) | Wrapper (Compat) | Description |
|------|-------------------|------------------|-------------|
| Dev Server | `./scripts/desktop/dev.sh` | `./scripts/desktop-dev.sh` | Backend + Tauri dev |
| Build | `./scripts/desktop/build.sh` | `./scripts/desktop-build.sh` | Frontend + Tauri bundle → `dist/desktop/bundle/` |
| Run | `./scripts/desktop/run.sh` | `./scripts/desktop-run.sh` | Run built native app |
| Release Package | `./scripts/desktop/release.sh [VERSION]` | `./scripts/desktop-release.sh [VERSION]` | `.dmg` / `.deb` / `.msi` + `.tgz/.zip` |

```bash
# Development workflow
./scripts/desktop/dev.sh

# Build → Run workflow
./scripts/desktop/build.sh      # Creates dist/desktop/bundle/
./scripts/desktop/run.sh        # Run native app

# Create release package
VERSION=1.2.0 ./scripts/desktop/release.sh   # Platform installers + archives
```

> **Desktop Build Prerequisites**
> Rust toolchain required | macOS: Xcode Command Line Tools | Linux: `libwebkit2gtk-4.0-dev`, `libssl-dev`

### 🐳 Docker Deployment

| Task | Script | Description |
|------|--------|-------------|
| Build | `./scripts/docker-build.sh` | Build `pms-web:latest` Docker image |
| Run | `./scripts/docker-run.sh [PORT]` | Run built image as container (default port: 8000) |

```bash
./scripts/docker-build.sh           # Build image
./scripts/docker-run.sh             # Run on default 8000 port
./scripts/docker-run.sh 8080        # Run on custom port
```

---

## Build Artifacts

| App Type | Artifact Path | Description |
|----------|---------------|-------------|
| Web App | `dist/web/pms` | Backend + web frontend unified single binary |
| Desktop App | `dist/desktop/bundle/` | Tauri platform bundles (`.dmg` / `.deb` / `.msi` etc.) |
| Release Archives | `release/` | `.tgz` / `.zip` / `.dmg` / `.deb` / `.msi` |

---

## Database

Powered by `sqlx::AnyPool`, supporting the following DBMS. The engine is determined by the `database_url` scheme in config; `DATABASE_URL` env var takes precedence if set.

| DBMS | `database_url` Example | Dev Config File | Compose Profile |
|------|------------------------|-----------------|-----------------|
| SQLite (default) | `sqlite://./data/project-hub.db` | `config.sqlite.toml` | — |
| PostgreSQL | `postgres://pms_user:pms_password@localhost:5432/pms_db` | `config.postgres.toml` | `postgres` |
| MySQL | `mysql://pms_user:pms_password@localhost:3306/pms_db` | `config.mysql.toml` | `mysql` |
| MariaDB | `mariadb://pms_user:pms_password@localhost:3307/pms_db` | `config.mariadb.toml` | `mariadb` |

```bash
# Start backend dev server with DB container
./scripts/dev-with-db.sh sqlite
./scripts/dev-with-db.sh postgres
./scripts/dev-with-db.sh mysql
./scripts/dev-with-db.sh mariadb
```

> MariaDB uses MySQL dialect. MariaDB container uses host port **3307**.

---

## Configuration (config.toml)

Root `config.toml` is auto-generated on backend bootstrap if missing.

| Key | Description | Default |
|-----|-------------|---------|
| `port` | Server port | `8000` |
| `jwt_secret` | JWT signing key | (auto-generated) |
| `database_url` | DB connection string | SQLite |
| `upload_dir` | Attachment storage path | `./data/attachments` |
| `admin_username` | Initial admin username | `admin` |
| `admin_password` | Initial admin password | `admin` |
| `log_max_size_mb` | Log rotation size | `50` |
| `log_max_files` | Log retention count | `5` |

> **Security Required:** In production, **must** change `jwt_secret` and `admin_password` to secure random values.

---

## Development Guidelines

This project maintains role-based standard guardrails in separate files. All contributors must follow them.

| Document | Path | Content |
|----------|------|---------|
| **AI Agent Guardrails** | `CLAUDE.md` | Project-wide behavior rules, code edit autonomy, search rules |
| **Backend Guide** | `backend/CLAUDE.md` | DB query rules (SeaQuery), routing, JWT, build restrictions |
| **Frontend Guide** | `apps/web/CLAUDE.md` | Architecture, UI development, i18n, screen patterns, build rules |
| **Desktop Guide** | `apps/desktop/CLAUDE.md` | Desktop-specific rules (shares web guide) |

### Key Development Rules Summary

- **Query Writing:** All SQL via SeaQuery builder (raw SQL prohibited)
- **Query Execution:** Use `crate::db::{fetch_all, fetch_optional, execute}`
- **Route Registration:** `routes/mod.rs` → `ProtectedRoutes` / `PublicRoutes` types
- **i18n:** `apps/web/src/locales/{ko,en,ja,zh}.ts` + `apps/desktop/src/locales/` sync
- **UI Styling:** Tailwind CSS + CSS Variables (Design Tokens), no modal dialogs
- **Build Execution:** `scripts/web-build.sh` auto-run prohibited (only on explicit user request)
- **E2E Tests:** Auto-run prohibited (only on explicit user request)

---

## E2E Testing

Playwright-based E2E tests located in `test/playwright/`.

```bash
# Run tests
cd test/playwright
npx playwright install chromium    # Install browser (first time only)
npx playwright test                # Run all tests
npx playwright test --ui           # Run with UI mode
npx playwright test --headed       # Run with visible browser
npx playwright show-report report  # Open HTML report
```

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.