# Backend Development Standards (backend/CLAUDE.md)

This document defines the guidelines that keep the **Rust Axum backend** consistent, the database stable, and the single-binary deployment requirement intact.

---

## 1. Database and Query Rules

- **Database engines**: `sqlx::AnyPool` is used so that SQLite, MySQL, MariaDB, and PostgreSQL are all supported.
- **Engine detection**: `db::get_kind()` distinguishes the engine from the `database_url` scheme (`postgres://`/`postgresql://`, `mysql://`, `mariadb://`, `sqlite://`). MariaDB resolves to `DbKind::MariaDb`, and its SQL dialect is translated the same way as MySQL. Connecting to a MariaDB server through `mysql://` behaves identically.
- **Writing queries**: Every query must be built with the `sea_query::Query` builder.
- **Executing queries**: Run queries through `crate::db::fetch_all`, `crate::db::fetch_optional`, `crate::db::execute`, and friends.
- **Date/time**: Do not use `NOW()` in SQL. Use `crate::db::now_string()` in Rust instead.
- **String concatenation**: Do not use SQL `||` concatenation. Select the individual columns and use `crate::routes::utils::display_name()` in Rust instead.

---

## 2. Routing and Asset Serving

- **Route module layout**: Routes are split into domain modules under `backend/src/routes/` (for example `auth.rs`, `posts.rs`, `chat.rs`, `issues.rs`). To add a new route:
  1. Define the handlers and `pub fn router() -> Router` in `backend/src/routes/<name>.rs`,
  2. Register it in `backend/src/routes/mod.rs` with `pub mod <name>;` and `.merge(<name>::router())` inside `api_router()`,
  3. Mount it from `main.rs` as `Router::new().nest("/api", routes::api_router())`.
- **404 rule for API paths**: The frontend SPA fallback serves `index.html` for undefined paths, but unmatched requests under `/api` or `/api/*` must never return HTML — they must return a **404 NotFound** status (see the SPA fallback handler in `main.rs`).

---

## 3. Runtime Environment and Paths

- **Development**: Start with `./scripts/web-dev.sh` from the repository root. The backend runs as `cargo run --manifest-path backend/Cargo.toml` from the root directory, so `config.toml` and `data/` must live at the root.
- **Deployment**: Build the single binary with `./scripts/web-build.sh` and run it directly with `./scripts/web-run.sh`.
- **Database URL**: `database_url` in `config.toml` takes precedence. When it is absent, the bootstrap logic in `main.rs` decides dynamically based on whether `./data/` exists.
- **Attachment path**: Use `upload_dir` from `config.toml` (default `./data/attachments`) as the single source of truth. Never hardcode the path.

---

## 4. API Response Format

- Every API response must be returned consistently as JSON, generally shaped as `Result<Json<Value>, String>` or a form that can specify an HTTP status code (for example `Status::Created`).
- To keep frontend parsing predictable, follow `{ "success": true, "data": ... }` on success and `{ "success": false, "error": "message" }` on failure.

---

## 5. Authentication (JWT)

- Tokens are issued and verified through `create_jwt()` / `verify_jwt()` in `auth.rs`, and clients send them in the `Authorization: Bearer <token>` header.
- Protected routes take the `AuthUser` extractor as a handler argument. `AuthUser` unpacks `Claims` (sub=user_id, role, exp) to provide the user context.
- The signing key is `jwt_secret` in `config.toml` and **must be replaced with a strong secret in production**.

---

## 6. Logging

- `tracing` + `file-rotate` write rotating logs to `./logs/pms.log`. The rotation policy is controlled by `log_max_size_mb` and `log_max_files` in `config.toml`.
- Adjust the log level with the `RUST_LOG` environment variable (for example `RUST_LOG=info,backend=debug`).

---

## 7. Sonyflake ID Handling ⚠️

> **Every API handler must follow these rules.**

The project uses 63-bit Sonyflake IDs, which exceed JavaScript number precision (`Number.MAX_SAFE_INTEGER` = 2^53 - 1). IDs exchanged with the frontend **must therefore always be strings**.

### 7.1 Request structs (JSON body)

Annotate every i64 ID field with `#[serde(deserialize_with = "...")]`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateIssueRequest {
    // Required ID: accepts a string or a number
    #[serde(deserialize_with = "crate::serde_utils::string_or_number")]
    pub project_id: i64,

    // Optional ID
    #[serde(default, deserialize_with = "crate::serde_utils::optional_string_or_number")]
    pub assignee_id: Option<i64>,

    // Doubly nullable (absent = None, null = Some(None), value = Some(Some(id)))
    #[serde(default, deserialize_with = "crate::serde_utils::nullable_string_or_number")]
    pub assigned_to_id: Option<Option<i64>>,

    // Array of IDs
    #[serde(default, deserialize_with = "crate::serde_utils::opt_vec_string_or_number")]
    pub attachment_ids: Option<Vec<i64>>,
}
```

**Available deserializers** (`backend/src/serde_utils.rs`):
| Function | Target type | Accepted values |
|----------|-------------|-----------------|
| `string_or_number` | `i64` | `"123"`, `123` |
| `optional_string_or_number` | `Option<i64>` | `null`, `""`, `"123"`, `123` |
| `nullable_string_or_number` | `Option<Option<i64>>` | `null`, `""`, `"123"`, `123` |
| `vec_string_or_number` | `Vec<i64>` | `["1", 2, "3"]` |
| `opt_vec_string_or_number` | `Option<Vec<i64>>` | `null`, `["1", 2]` |

### 7.2 Path parameters

Replace every `Path<i64>` extractor with `Path<String>` + `parse_path_id()`:

```rust
// ✅ Correct pattern
async fn handler(
    Path(id_str): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = crate::serde_utils::parse_path_id(&id_str)?;
    // use id as i64
}

// ✅ Tuple pattern
async fn handler(
    Path((group_id_str, user_id_str)): Path<(String, String)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let group_id = crate::serde_utils::parse_path_id(&group_id_str)?;
    let user_id = crate::serde_utils::parse_path_id(&user_id_str)?;
}

// ❌ Wrong pattern (fails on string IDs)
async fn handler(Path(id): Path<i64>) -> ... { }
```

### 7.3 Serializing API responses

Serialize every ID with `.to_string()`:

```rust
Ok(Json(json!({
    "success": true,
    "data": {
        "id": id.to_string(),
        "project_id": project_id.to_string(),
    }
})))
```

### 7.4 Checklist

When adding a new API endpoint:
- [ ] Every i64 ID field in the request struct has `#[serde(deserialize_with = "...")]`
- [ ] Path parameters use `Path<String>` + `parse_path_id()`
- [ ] IDs in the response are serialized with `.to_string()`
- [ ] The frontend build still passes

---

## 8. Build and Test Execution Limits ⚠️

> **These rules take priority over everything else.**

- **Do not run `scripts/web-build.sh`**: Unless the user explicitly asks to build or deploy, **never** run `./scripts/web-build.sh` automatically.
  - Verify changes with the already-running `./scripts/web-dev.sh` dev server or a `cargo check`-level syntax check instead.
- **Do not run E2E tests**: Unless the user explicitly asks to run E2E tests, **never** run them automatically.
- **Allowed verification methods**:
  - Rust syntax and type check: `cargo check --manifest-path backend/Cargo.toml`
  - Behaviour check through the dev server: `./scripts/web-dev.sh` (no restart needed if it is already running)
