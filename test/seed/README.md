# ProjectHub Sample Data Seeder

A TypeScript seeder that populates ProjectHub with demo data **through the REST
API** (no direct database access). It replaces the removed Rust `--seed-sample`
flag and is **idempotent** — running it multiple times never creates duplicates.

## Why API-based?

- Sonyflake 63-bit IDs and password hashing are handled by the backend, so the
  seeder never needs to touch the DB or reimplement ID generation.
- Every call also exercises the real API, so a successful seed doubles as a
  smoke test of the write endpoints.

## Usage

Prerequisites: Node.js 18+ (uses built-in `fetch`, `FormData`, `Blob`).

```bash
# 1. Install dependencies (first time only)
npm install --prefix test/seed

# 2. Run the seeder against a running backend
npm run seed --prefix test/seed

# Options
npm run seed --prefix test/seed -- --base-url http://localhost:8000 \
  --admin-login admin --admin-password admin123 \
  --count 120 --reset
```

- `--count N` (default `120`): number of generated items per content type
  (users, projects, milestones, tasks, issues, wiki, posts, memos). Recommended
  range is `100`–`150`; values are clamped to `1`–`200`.
- `--reset`: delete existing sample data through the REST API before seeding.
  Scope and limitations:
  - Deletes sample users (`alice`/`bob`/`carol` + `user001`..), sample projects
    (`PHWEB`/`PHMOB`/`LEGACY` + `SAMP001`..) and their content, memos, chat
    messages, the user group, and the address book group.
  - Departments (`개발팀`/`디자인팀`) and the chat room are **kept** — they are
    idempotently reused on reseed.
  - Sent memos go to the sender's trash instead of a hard delete (acceptable for
    reset purposes).
  - Requires admin credentials (deleting users/projects needs admin role).

Type-check without running:

```bash
npm run typecheck --prefix test/seed
```

## What it creates

| Area | Items |
|------|-------|
| Organization | 개발팀 / 디자인팀 departments |
| Users | alice (admin), bob, carol — password `SamplePass123!` — plus `user001`..`user{N}` (`[샘플]`-prefixed generated users) |
| Projects | PHWEB (public), PHMOB, LEGACY — with members — plus `SAMP001`..`SAMP{N}` (`[샘플] 프로젝트`) |
| Milestones | 4 curated + `[샘플] 마일스톤 {N}` across the projects |
| Tasks | 4 curated + FS task dependencies on PHWEB, plus `[샘플] 일감 {N}` |
| Custom fields | 요구사항 링크 (string), 긴급도 (text) on PHWEB |
| Issues | 5 curated with custom values and comments on PHWEB, plus `[샘플] 이슈 {N}` |
| Wiki | 3 curated pages with comments on PHWEB, plus `[샘플] 위키 페이지 {N}` |
| Board | notice (pinned), resource, general posts + comments + attachment, plus `[샘플] 게시글 {N}` |
| Memos | 2 curated memos, 1 folder, folder move, plus `[샘플] 쪽지 {N}` |
| Chat | 1 room with 3 members and messages |
| Groups | 1 user group with project share, 1 address book group |

`N` is the `--count` value (default 120). All generated items carry the
`[샘플]` prefix so `--reset` can match and remove them.

## Idempotency

Each item is looked up by a stable marker (login, identifier, name, title)
before creation. If it already exists, the existing record is reused. Members,
shares, and task dependencies are added through endpoints that skip existing
rows, so re-runs are safe.
