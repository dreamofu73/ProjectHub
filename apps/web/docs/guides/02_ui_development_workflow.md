# 02. UI Development Workflow and Styling

## 1. Frontend UI development workflow

Always follow this three-step flow when building a new screen or a complex UI component.

**[User UI requirements]**
- **Requirement documents**: Markdown (`.md`) files that define user UI requirements and screen composition must live in the project root's `uiux/` directory and be kept up to date.
- **Step 1**: Mermaid MCP generates the flow chart and component structure (Mermaid text) very quickly, keeping token usage low.
- **Step 2**: The agent reads the generated Mermaid spec and fully understands the layout and hierarchy.
- **Step 3**: Based on that structure, implement the actual screen with Tailwind CSS and Magic UI code, without errors.

## 2. Styling and UI rules

- **Tailwind CSS v4**: Use Tailwind CSS for styling.
- **Follow the design tokens**: Shared branding, tone, and theme styles come from the design token variables defined in `src/index.css` (`var(--bg-surface)`, `var(--text-primary)`, `var(--border)`, `var(--primary)`, and so on). Avoid hardcoded colours and ad-hoc layout utilities.
- **Shared components and icons**:
  - When building UI, reuse the components in `frontend/src/components/ui/` (`Button`, `Input`, `Card`, `Toast`, `Pagination`, `FileUploader`, `HTMLEditor`, and others) as much as possible.
  - Use `lucide-react` consistently for icons.
- **Shared layout**: Use `src/components/Layout.tsx` (main shell) together with `src/components/layout/` (Header, Sidebar, ProfileDialog, PreferencesDialog).
- **No modal dialogs** ⚠️:
  - In-screen actions (create, edit, delete, settings) must **never** use a modal dialog (a `fixed inset-0 bg-black/50` overlay). Use one of the two approaches below instead.
  - **Inline form**: In a master-detail split view, switch the right-hand detail panel into a form so input happens on the same screen. Example: adding or editing a department in organisation management.
  - **Popup screen**: Navigate to a `react-router-dom` route (`/new`, `/edit`, `/:id/settings`, and so on), take input full-screen, and return to the list with `navigate(-1)` or `navigate('/list')`.
  - Exception: Modals are allowed only for system-level urgent notices (session expiry, fatal errors).
  - Remove modal dialogs from existing code incrementally, converting them into inline forms or popup screens.
  - This rule exists for mobile support, accessibility, and a consistent UX.
- **Close inline panels on outside click** ⚠️:
  - Inline forms and panels (address book picker, dropdown menu, search result panel, and so on) must **close automatically when the user clicks outside the panel**.
  - Implementation: register `document.addEventListener('click', handler)` in a `useEffect` and detect outside clicks with `contains()` against the panel container `ref`.
  - Exception: If the panel contains an input that needs focus, losing focus along with the close is acceptable.
  - Exception: A panel used as the primary input surface — such as the right-hand detail panel (inline form) of a master-detail split view — does not close on outside click; it closes only through its own Cancel button.
  - Since inline panels replace modals, this rule ensures users can dismiss an unintentionally opened panel easily.
- **ESC key behaviour** ⌨️:
  - While an inline form, panel, popup screen, or dropdown is open, pressing **ESC must behave exactly like the Cancel button** (close or go back).
  - Implementation: register a `keydown` listener in `useEffect` and call the cancel handler when `e.key === 'Escape'`.
  - For route-based popup screens, run `navigate(-1)`.
  - Exception: Cases where ESC conflicts with a native browser behaviour (such as exiting full screen).
  - This rule exists for keyboard accessibility and a consistent user experience.
