# Frontend Development Standards (apps/web/CLAUDE.md)

This document defines the guidelines that keep the **React Vite (TypeScript) frontend** high quality, compile-stable, and smoothly integrated with the backend for deployment.

See the area-specific guides below:

- [01. Architecture and routing](docs/guides/01_architecture_and_routing.md)
- [02. UI development workflow and styling](docs/guides/02_ui_development_workflow.md)
- [03. Internationalisation (i18n)](docs/guides/03_i18n_rules.md)
- [04. Screen patterns](docs/guides/04_screen_patterns.md)
- [05. Compilation, build, and test](docs/guides/05_build_and_test.md)
- [06. Typography](docs/guides/06_typography_rules.md)

---

> [!IMPORTANT]
> Every developer must follow the guidelines above. Pay particular attention to the constraints such as **no modal dialogs** and **running `./scripts/web/dev.sh`**.

---

## Sonyflake ID Handling ⚠️

The project uses 63-bit integer Sonyflake IDs so that it works in a distributed environment. Those values can exceed JavaScript number precision (`Number.MAX_SAFE_INTEGER` = 2^53 - 1), so **IDs exchanged with the backend must always be strings**.

### 1. Type definitions
Declare every ID field as `string`, never `number`.

```typescript
// ✅ Correct
interface Issue {
  id: string;
  project_id: string;
  author_id: string;
}

// ❌ Wrong
interface Issue {
  id: number;
}
```

### 2. IDs in URL paths
Use the ID as-is when calling the API; do not convert it with `Number()`.

```typescript
// ✅ Correct
await api.delete(`/api/issues/${issueId}`);

// ❌ Wrong
await api.delete(`/api/issues/${Number(issueId)}`);
```

### 3. Comparing IDs
Compare IDs as strings in conditionals, without numeric conversion.

```typescript
// ✅ Correct
if (item.id === selectedId) { ... }

// ❌ Wrong
if (Number(item.id) === Number(selectedId)) { ... }
```
