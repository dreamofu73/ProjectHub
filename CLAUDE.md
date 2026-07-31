# Project Hub (PMS) Development Standards (CLAUDE.md)

This project is a project management system built with a **Rust (Axum) backend** and **React Vite (TypeScript) frontends (Web/Desktop)**. To keep code quality consistent and preserve single-binary build compatibility, the standards are split per area.

> [!IMPORTANT]
> Always consult the area-specific guidelines below:
> - **Backend rules**: [backend/CLAUDE.md](backend/CLAUDE.md)
> - **Web frontend rules**: [apps/web/CLAUDE.md](apps/web/CLAUDE.md)
> - **Desktop app rules**: [apps/desktop/CLAUDE.md](apps/desktop/CLAUDE.md)

---

## 1. Agent Behaviour and Task Management

### ⚡ Autonomous code changes
- **No pre-approval**: When source changes or file creation are required, do not ask for permission or wait for approval each time. Call the tools directly, apply the change, and report the result concisely.
- **Implement autonomously**: When you are confident about the implementation details, skip the clarification step and update the code according to modern web standards and techniques.

### 🔍 Code search and navigation (CodeGraph)
- **Prefer CodeGraph over plain text search**: Before running text-based `grep`, `find`, `cat`, or reading whole files (`Read`) to understand the codebase or locate a symbol (function, class, variable), **analyse dependencies and call relationships structurally with CodeGraph first**.
- **MCP tool**: `codegraph_explore` takes a natural-language question or symbol name and returns the source of the relevant code together with call paths and blast radius in a single call, which avoids the context waste of scattershot text search.
- **Shell command**: When the MCP tool is unavailable, `codegraph explore "<query>"` in the terminal produces the same result.

### 🧪 Minimise browser testing
- **Browser testing is a last resort.** Verify changes in this order:
  1. **Static analysis first**: Vite build (`npm run build --workspaces`) for the frontend and `cargo check` for the backend — compile and type checks come first.
  2. **Logs and terminal**: Verify backend API behaviour with `curl` or terminal logs.
  3. **When browser testing is allowed**: Only in these cases.
     - Visual UI layout or animation must be confirmed
     - Complex user interactions (drag, multi-step flows) need verification
- **Skip it when**: Logic bug fixes, type errors, minor style tweaks, or API wiring changes whose correctness can be judged from the code alone.

### 📝 Commit message rules
- **Write in English**: All git commit messages (subject and body) are written in **English**. Conversations, reports, and `docs/` artifacts remain in Korean.
- **Format**: Follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`) and use the body to list the reason and scope of the change.
- **Authorship**: The commit author and committer come from the repository-local git configuration (`dreamofu <dreamofu73@gmail.com>`).
- **No attribution trailers**: Do not leave trailers such as `Co-Authored-By: ...` or references to agents, models, or sessions in commit messages.

### 📁 Artifact management
- **Where artifacts go**: Every artifact produced during a session (`walkthrough.md`, `task.md`, `plan.md`, and so on) belongs under this workspace's [docs](docs) directory, one file per request, updated as the work proceeds — never in a global directory. Create the directory if it does not exist.
- **Document language**: Guideline documents committed to the repository (this file, `backend/CLAUDE.md`, `apps/*/CLAUDE.md`, `PROJECT.md`, `apps/web/docs/guides/*`, `test/*/README.md`) are written in **English**. Session artifacts under `docs/` are written in **Korean**.
- **Keep both READMEs in sync**: `README.md` (English) and `README.ko.md` (Korean) are translations of the same content. Whenever one changes, update the other in the same commit so they never drift apart.
- **Throwaway scripts**: Temporary code for data migration, refactoring, or automation must be created inside the project root's `tmp/` directory (create it if needed). Delete those files once the work is done so the project root stays clean.

---

## 2. Running and Configuring the Project

### 🌐 Web app scripts

| Stage | Script (canonical) | Wrapper (legacy) | Description |
|-------|--------------------|------------------|-------------|
| Dev server | `./scripts/web/dev.sh` | `./scripts/web-dev.sh` | Starts backend + Vite dev together (with HMR) |
| Build | `./scripts/web/build.sh` | `./scripts/web-build.sh` | Frontend build → Rust release build → produces `dist/web/pms` |
| Run | `./scripts/web/run.sh` | `./scripts/web-run.sh` | Runs the `dist/web/pms` production binary in the foreground |
| Release package | `./scripts/web/release.sh [VERSION]` | `./scripts/web-release.sh [VERSION]` | Produces `release/pms-web-<ver>-<os>-<arch>.tgz/.zip` |

```bash
# Development workflow
./scripts/web/dev.sh                         # start the dev server

# Build → run workflow
./scripts/web/build.sh                       # build (produces dist/web/pms)
./scripts/web/run.sh                         # run

# Create a release package
VERSION=1.2.0 ./scripts/web/release.sh      # writes an archive into release/
```

---

### 🖥️ Desktop app scripts (Tauri)

| Stage | Script (canonical) | Wrapper (legacy) | Description |
|-------|--------------------|------------------|-------------|
| Dev server | `./scripts/desktop/dev.sh` | `./scripts/desktop-dev.sh` | Starts backend + Tauri dev together |
| Build | `./scripts/desktop/build.sh` | `./scripts/desktop-build.sh` | Frontend build → Tauri release bundle → produces `dist/desktop/bundle/` |
| Run | `./scripts/desktop/run.sh` | `./scripts/desktop-run.sh` | Runs the built native app |
| Release package | `./scripts/desktop/release.sh [VERSION]` | `./scripts/desktop-release.sh [VERSION]` | Produces `release/pms-desktop-<ver>.[tgz\|zip\|dmg\|deb\|msi]` |

```bash
# Development workflow
./scripts/desktop/dev.sh                         # start the Tauri dev server

# Build → run workflow
./scripts/desktop/build.sh                       # build the Tauri bundle (dist/desktop/bundle/)
./scripts/desktop/run.sh                         # run the native app

# Create a release package
VERSION=1.2.0 ./scripts/desktop/release.sh      # per-platform installer + archive
```

> [!NOTE]
> Desktop builds require the Rust toolchain plus platform-specific native build tools.
> macOS: Xcode Command Line Tools / Linux: libwebkit2gtk-4.0-dev, libssl-dev

---

### ⚙️ Configuration file (config.toml)
- If the root `config.toml` is missing, the backend creates it during bootstrap.
- **Key settings**: `port`, `jwt_secret`, `database_url`, `upload_dir`, `admin_username`, `admin_password`, `allowed_extensions`, `log_max_size_mb`, `log_max_files`.
- **Security requirement**: Before deploying to a real server, `jwt_secret` and `admin_password` **must** be replaced with strong random values.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
