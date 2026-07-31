# 05. Compilation, Build, and Test

## 1. Compilation and build stability

- **Remove unused code**: Strict type checking fails the `npm run build` when unused variables or imports remain after TypeScript compilation.
  - Clean up unnecessary imports and unused variables completely before finishing a change or committing.
- **Use custom hooks**: Extract complex state management and business logic into custom hooks under `src/hooks/` or the feature's component directory to keep components lightweight.

### Verify before deleting state variables or hooks
- When deleting a state variable (`useState`), a custom hook, or a type, always confirm that **no leftover code still references the deleted identifier**.
- Grepping for the deleted name before running `npm run build` is a cheap first check that prevents `ReferenceError`.
- Clean up the now-unnecessary `import` statements and type definitions as well.

## 2. Build and test execution limits ⚠️

> **These rules take priority over everything else.**

- **Run `./scripts/web/dev.sh`**: After writing or modifying code, start the dev server with `./scripts/web/dev.sh` and verify in the browser.
  - When the dev server is already running, verify changes through that instance rather than restarting it.
- **Do not run E2E tests**: Unless the user explicitly asks to run E2E tests, **never** run them automatically.
- **Allowed verification methods**:
  - Frontend build check: `npm run build` (the Vite build surfaces type errors and confirms the build succeeds)
  - Dev server check: `./scripts/web-dev.sh` (restart only if it is not already running)
  - UI verification through browser screenshots or DOM inspection
