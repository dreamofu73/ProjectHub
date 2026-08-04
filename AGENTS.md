# AGENTS.md — Compact agent guide for ProjectHub

## What this is

Rust (Axum) backend + React Vite (TypeScript) frontends (Web + Desktop via Tauri). Monorepo managed with npm workspaces.

## Area-specific rules — read before editing

| Area | Rules file |
|------|-----------|
| Backend | `backend/CLAUDE.md` |
| Web frontend | `apps/web/CLAUDE.md` + `apps/web/docs/guides/` |
| Desktop | `apps/desktop/CLAUDE.md` (mirrors web guide) |
| Project-wide | `CLAUDE.md` |

## Critical gotchas

### i18n is mandatory
- Never hardcode user-facing text. Use `useLanguage()` / `t('key')`.
- New keys must be registered in **all 5 locale files** in the same change:
  - `packages/shared/src/locales/{ko,en,ja,zh,es}.ts`

### Theme tokens — no hardcoded colors
- Style through CSS variables: `bg-[var(--bg-surface)]`, `border-[var(--border)]`, `text-[var(--text-primary)]`, etc.
- Forbidden: `bg-white`, `border-gray-200`, `text-black`, any hardcoded Tailwind color utility.

### Sonyflake IDs — string everywhere
- Backend uses 63-bit Sonyflake IDs. JS `Number` loses precision above 2^53.
- Frontend: declare IDs as `string`, never `number`. Compare as strings. Never `Number(id)`.
- Backend: use `Path<String>` + `parse_path_id()` for path params. Serialize IDs with `.to_string()`.
- Backend: annotate i64 request fields with `#[serde(deserialize_with = "crate::serde_utils::string_or_number")]`.

### Backend queries — no raw SQL
- All queries via `sea_query::Query` builder. Execute through `crate::db::{fetch_all, fetch_optional, execute}`.
- No `NOW()` in SQL — use `crate::db::now_string()`. No `||` concatenation — use `display_name()` in Rust.

## Verification commands

```bash
# Frontend type-check + build (whole monorepo)
npm run build --workspaces

# Backend syntax/type check only
cargo check --manifest-path backend/Cargo.toml
```

**Do NOT run automatically:**
- `scripts/web-build.sh` — only on explicit user request
- E2E tests (`npx playwright test`) — only on explicit user request

## Dev servers

| What | Command |
|------|---------|
| Web (backend + Vite) | `./scripts/web/dev.sh` |
| Desktop (backend + Tauri) | `./scripts/desktop/dev.sh` |
| Backend only | `cargo run --manifest-path backend/Cargo.toml` |

Dev server runs from repo root. `config.toml` and `data/` must be at root.

## Monorepo layout

```
packages/shared/   → hooks, types, API client, i18n locales
packages/ui/       → shared UI components (KanbanBoard<T>, etc.)
apps/web/          → Web SPA (React Vite)
apps/desktop/      → Tauri desktop app
backend/           → Rust Axum REST API
```

Rule: reuse both apps → `packages/*`. App-specific → `apps/*`.

## Adding a backend route

1. Create handler + `pub fn router() -> Router` in `backend/src/routes/<name>.rs`
2. Register in `backend/src/routes/mod.rs`: `pub mod <name>;` + `.merge(<name>::router())`
3. Mounted automatically via `main.rs` → `nest("/api", routes::api_router())`
4. Unmatched `/api/*` must 404 (not serve SPA fallback HTML).

## Session artifacts

- Working artifacts (`docs/` session files) → Korean language
- Committed guideline docs → English
- Throwaway scripts → `tmp/` (delete after use)

## Commits

- English only. Conventional Commits format (`feat:`, `fix:`, `refactor:`, etc.)
- No `Co-Authored-By` or agent/model attribution trailers.
- `README.md` and `README.ko.md` must be kept in sync.

## CodeGraph

Repo is indexed (`.codegraph/` exists). Use `codegraph_explore` (MCP) or `codegraph explore "<query>"` (shell) **before** grep/find when locating symbols or understanding call paths.

## Config

`config.toml` at repo root, auto-generated if missing. Key settings: `port` (8000), `jwt_secret`, `database_url` (SQLite default), `admin_username`, `admin_password`. Change secrets before deploying.
