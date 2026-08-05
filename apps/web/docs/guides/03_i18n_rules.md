# 03. Internationalisation (i18n) ⭐ **[MANDATORY]**

Every user-facing string (UI text) — screens, components, inline panels, toasts, and error messages — **must** be translated. Hardcoding literal text in the source is forbidden. Four languages are supported today: Korean (`ko`), English (`en`), Japanese (`ja`), and Spanish (`es`).

## 1. Translation system

The i18n system is implemented as a **custom React context**; no external library is used.

- **Context file**: `packages/shared/src/hooks/LanguageContext.tsx` (each app re-exports it from `src/context/LanguageContext.tsx`, so `import { useLanguage } from '../context/LanguageContext'` keeps working)
- **Translation data**: `packages/shared/src/locales/{ko,en,ja,zh}.ts` — TypeScript objects (`Record<string, string>`)
- **Values provided** by the `useLanguage()` hook:
  - `t(key: string): string` — look up a string by translation key
  - `formatDate(date, options?)` — date formatting (locale-aware)
  - `formatDateTime(date, options?)` — date and time formatting
  - `formatTime(date, options?)` — time formatting
  - `language: Language` — current language (`'ko' | 'en' | 'ja' | 'zh'`)
  - `timezone: string` — default timezone for the current language

## 2. Using `t()`

**Use the `useLanguage()` hook** in pages and top-level components:
```tsx
import { useLanguage } from '../../context/LanguageContext';

function MyPage() {
  const { t, formatDate } = useLanguage();
  return <div>{t('hello')}</div>;
}
```

**Pass through props** in reusable components:
- When a child component needs `t()` or `formatDate`, the parent obtains them from `useLanguage()` and **passes them down as props**.
- This keeps unit testing simple and makes the context dependency explicit.
```tsx
// Parent page
function ParentPage() {
  const { t, formatDate } = useLanguage();
  return <ChildComponent t={t} formatDate={formatDate} />;
}

// Child component
interface ChildProps { t: (key: string) => string; formatDate: (date: string) => string; }
function ChildComponent({ t, formatDate }: ChildProps) {
  return <span>{t('hello')} — {formatDate(date)}</span>;
}
```

**⚠️ Never hardcode strings in the DOM**:
```tsx
// ❌ Wrong
<button>수정</button>
<span>2026-07-02</span>

// ✅ Correct
<button>{t('edit') || '수정'}</button>
<span>{formatDate(date)}</span>
```

## 3. Fallback pattern

When `t()` cannot find a key it falls back to the Korean (`ko`) dictionary, and if the key is missing there too it returns the key name itself.

Recommended extra safety net:
```tsx
// Provide a fallback string in case t('key') is missing
{t('edit') || '수정'}
```

This pattern:
- Guarantees that default text is visible for new features whose keys have not been added yet.
- Keeps the UI from breaking during development.

## 4. Adding translation keys

When adding new UI text, **the same key must be added to all four files in the same change**:

1. `packages/shared/src/locales/ko.ts` — Korean
2. `packages/shared/src/locales/en.ts` — English
3. `packages/shared/src/locales/ja.ts` — Japanese
4. `packages/shared/src/locales/es.ts` — Spanish

**Key naming rules**:
- Use **camelCase** (for example `loginTitle`, `noUsersFound`)
- Prefix by feature or page:
  - `login*` — sign in
  - `chat*` — chat
  - `memo*` — memos
  - `issue*` / `bug*` — issues
  - `wiki*` — wiki
  - `group*` — groups
  - `user*` / `bulk*` — user management
  - `pagination*` — pagination
  - Common actions (`edit`, `delete`, `save`, `cancel`, `search`) stay short and unprefixed
- Group related keys together and separate the groups with comments

**Translations with parameters**:
```ts
// locales/<lang>.ts
totalIssues: '총 {count}개의 이슈',
selectedIssuesCount: '{count}개 선택됨',

// In a component
t('totalIssues').replace('{count}', items.length.toString())
```

## 5. Date and time formatting

- Use `formatDate()` to display a date.
- Use `formatDateTime()` to display a date and time.
- These helpers apply the per-language locale (ko-KR, en-US, ja-JP, es-ES) and timezone automatically.
- UTC date strings returned by the API are converted automatically through `parseUTCDate()`.

---

## 6. Frontend Feature Enhancement Guidelines (i18n Mandatory Workflow) 🚀

When adding new features or enhancing existing components, follow this mandatory workflow to guarantee full internationalisation support:

1. **Audit All User-Facing UI Strings**:
   - Before writing component code, list all user-facing strings (labels, menu items, table headers, placeholder text, tooltips, action buttons, confirm/cancel dialogs, empty state messages, error toasts).
2. **Reuse Existing Locale Keys First**:
   - Check `packages/shared/src/locales/ko.ts` to see if a matching key already exists (e.g., `add`, `save`, `cancel`, `delete`, `all`, `search`, `processing`, `confirm`, `settings`, `permissionDenied`).
3. **Register New Keys Across All 4 Locale Dictionaries**:
   - When introducing new UI text, register the new key simultaneously in **all 4 locale files**:
     - `packages/shared/src/locales/ko.ts` (Korean)
     - `packages/shared/src/locales/en.ts` (English)
     - `packages/shared/src/locales/ja.ts` (Japanese)
     - `packages/shared/src/locales/es.ts` (Spanish)
4. **Follow Concise Terminology Standards**:
   - **Menu items**: Use concise single-word terms in English and Spanish (e.g., `Admin`, `Projects`, `Tasks`, `Memos`, `Ajustes`, `Registros`).
   - **Korean terminology**: Adhere to project standards (`멤버` ➔ `구성원`, `리스트` ➔ `목록`, member addition ➔ `추가`).
5. **Hook and Prop Passing Patterns**:
   - Top-level screens & pages: Call `const { t, formatDate } = useLanguage();`.
   - Reusable child components: Declare `t` and `formatDate` in component props interface (`interface ComponentProps { t: (key: string) => string; ... }`) and pass them down from parent.
6. **Compile Verification**:
   - Run `npm run build --workspaces` to verify that all locale imports and TypeScript types compile without errors.

