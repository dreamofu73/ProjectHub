# Desktop Development Standards (apps/desktop/CLAUDE.md)

This document defines the guidelines that keep the **React Vite (TypeScript) frontend** high quality, compile-stable, and smoothly integrated with the backend for deployment.

See the area-specific guides below:

- [01. Architecture and routing](../web/docs/guides/01_architecture_and_routing.md)
- [02. UI development workflow and styling](../web/docs/guides/02_ui_development_workflow.md)
- [03. Internationalisation (i18n)](../web/docs/guides/03_i18n_rules.md)
- [04. Screen patterns](../web/docs/guides/04_screen_patterns.md)
- [05. Compilation, build, and test](../web/docs/guides/05_build_and_test.md)
- [06. Typography](../web/docs/guides/06_typography_rules.md)

---

> [!IMPORTANT]
> Every developer must follow the guidelines above. Pay particular attention to the constraints such as **no modal dialogs** and **running `./scripts/desktop/dev.sh`**.

---

## Mandatory Frontend Principles 🚨

The three rules below apply to **every** screen, component, inline panel, and toast — no exceptions.

### 1. Internationalisation (i18n) — MANDATORY

- **Never hardcode user-facing text** (Korean, English, or any other language) in source files.
- Read every string through the shared `useLanguage()` hook and its `t('key')` helper.
- **Feature Enhancements & New Features**: When adding or enhancing any frontend component, audit all UI text and register new keys in **all four** locale dictionaries in the same change:
  - `packages/shared/src/locales/ko.ts` (Korean)
  - `packages/shared/src/locales/en.ts` (English)
  - `packages/shared/src/locales/ja.ts` (Japanese)
  - `packages/shared/src/locales/es.ts` (Spanish)
- **Terminology Standards**:
  - Menu items: Prefer concise single-word terms in English/Spanish (`Admin`, `Projects`, `Tasks`, `Ajustes`, `Registros`).
  - Korean terminology: Follow project standards (`멤버` ➔ `구성원`, `리스트` ➔ `목록`, member addition ➔ `추가`).

```tsx
import { useLanguage } from '../context/LanguageContext'; // re-exports shared/hooks/LanguageContext

export function MyComponent() {
  const { t } = useLanguage();
  return <Button>{t('save')}</Button>;
}
```

Full rules & enhancement workflow: [03. Internationalisation (i18n)](../web/docs/guides/03_i18n_rules.md)

### 2. Global theme sync — MANDATORY

Every component must follow the app-wide theme (Dark/Light × Default/Warm/Lavender/Ocean/Amber) automatically. That only works when styling goes through the **semantic design tokens** defined in `src/index.css`:

| Purpose | Token |
|---------|-------|
| Surface background | `bg-[var(--bg-surface)]`, `bg-[var(--bg-surface-2)]` |
| Border | `border-[var(--border)]` |
| Accent / primary | `bg-[var(--primary)]`, `text-[var(--primary)]` |
| Text | `text-[var(--text-primary)]`, `text-[var(--text-secondary)]`, `text-[var(--text-muted)]` |

- **Hardcoded colour utilities are forbidden**: `bg-white`, `bg-slate-50`, `border-gray-200`, `text-black`, and the like do not react to the theme. Use the CSS variables instead.

### 3. Theme-aware scrollbars

- Every scrollable area must apply the global scrollbar rule — add the `custom-scrollbar` class (defined in `src/index.css`) or rely on the standard `scrollbar-color` variables. Do not restyle scrollbars per component.

---

## Component Development Rules

- **Share before duplicating**: When the same behaviour is needed in more than one place (for example the issue/task Kanban board), build a **generic component in `packages/ui`** (`KanbanBoard<T>`, `TasksGanttChart`, …) and reuse it from both apps instead of copying screen code.
- **Monorepo package boundaries**:
  - `packages/shared` — shared hooks, data types, API client, and i18n locales
  - `packages/ui` — shared UI components (buttons, cards, tables, Gantt chart, Kanban board, …)
  - `apps/web`, `apps/desktop` — page-level composition for the web and desktop apps
- Keep app-specific screens in `apps/*`; anything reused by both apps belongs in `packages/*`.
- CSS class vs utility ownership: unlayered CSS classes in `src/index.css` (e.g. `.card`) override Tailwind utilities. Do not add duplicate utilities for properties a CSS class already sets (border/radius/background on `.card`, etc.) — they are dead code that silently loses to the CSS class. Pick one owner per property.

---

## Verification

After finishing a change, the whole monorepo must build and type-check cleanly:

```bash
npm run build --workspaces
```

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
