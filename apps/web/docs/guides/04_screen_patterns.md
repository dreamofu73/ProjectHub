# 04. Screen Patterns

Every list screen must be designed and implemented using the **Memos screen** as the reference standard.

> Reference implementation: `frontend/src/pages/memos/Memos.tsx`, `MemoList.tsx`, `MemoToolbar.tsx`

## 1. Common rules for list screens

### 1.1. Server-side pagination
- **10 items per page by default**: `pageSize = 10` on initial load; users can switch between `[10, 20, 30, 50, 100]`.
- **Separate state**: Keep `page` and `pageSize` in component state (or a custom hook) and pass them as API parameters. Screens that need `searchParams` integration reflect `page`/`limit` in the URL.
- **Shared component**: Place the `<Pagination>` component at the bottom of the list area and separate it visually with `border-t border-[var(--border)] shrink-0`.
- **blockSize**: Use `blockSize={10}` or larger so that `pageSizeOptions` fits. Only reduce it to `blockSize={5}` when `pageSize` is small (5 or less).

### 1.2. Master-detail split layout
Showing the list and the detail on the same screen — the **master-detail pattern** — is the default.

- **Three split modes**, selected through an icon toggle group on the right side of the toolbar:
  - **`columns` (vertical split)**: list (left) + detail (right) — the default. Uses the `<Columns>` icon.
  - **`rows` (horizontal split)**: list (top) + detail (bottom). Uses the `<Rows>` icon.
  - **`list` (list + right panel)**: the list takes the full width, and clicking an item slides a detail panel in from the right. Uses the `<Menu>` icon.
- **Drag resizer**: In `columns`/`rows` mode, render a `1px` resizer bar between list and detail. The split ratio (%) is adjusted by dragging, implemented with `mousedown → mousemove → mouseup`.
- **Persist the ratio**: Store `leftWidth` (columns ratio), `topHeight` (rows ratio), and `splitLayout` in `localStorage` and restore them when the page is revisited.
- **Detail panel in `list` mode**:
  - `position: fixed` on the right, width `w-1/2` (50% of the screen), with content outside the panel clipped by `overflow-hidden`.
  - The panel is a `flex-col`: the title/metadata area stays pinned with `shrink-0`, while the description/comments area scrolls with `flex-1 overflow-y-auto min-h-0`.
  - **Modal-less behaviour**: There is no backdrop, so the list stays interactive while the panel is open (checkbox selection, search, filter changes, pagination).
  - **Close button**: Place a close (X) button at the top right of the detail panel.
  - **Slide-in animation**: Use the `animate-slide-in-right` class.
  - **DOM unmount**: The panel is removed from the DOM entirely when closed (conditional rendering).
- **Block page overflow**: When a split-view page mounts, set `document.body.style.overflow = 'hidden'` and restore the previous value on unmount.

### 1.3. Search and client-side filtering
- **Category + text search**: Place the category `<select>` and the text `<input>` side by side.
- **Quick filter select**: Place a `<select>` on the right of the toolbar for one-click filtering.

### 1.4. Grouped bulk-action toolbar
Combine multi-select checkboxes with a dropdown that groups the bulk actions, rendered inline on the left of the toolbar. Do not use a bottom slide-up bar (BulkActionBar).

### 1.5. Table scroll container
Give the table component `table-container` + `max-h-[calc(100vh-290px)] overflow-y-auto` so the page header and toolbar stay fixed while only the table rows scroll.

## 2. Detail screen rules

- **Right panel integration**: Clicking a list item shows the detail in a right-hand slide-over panel. The panel is 50% of the screen (`w-1/2`) with vertical spacing (`top-[calc(var(--header-height)+1rem)] bottom-4`) to give it a floating feel. It uses a `flex-col` layout: the title/metadata area is pinned at the top (`shrink-0`) while the description/comments area scrolls (`flex-1 overflow-y-auto min-h-0`).
- **Translated detail screens**: Every piece of text must be rendered through `t()`.
- **Data display**: API data is not passed through `t()`; dates and times use `formatDate()` or `formatDateTime()`.

## 3. Feature-specific patterns

- **Address book**: Use an inline form so an entry can be selected and edited immediately.
- **Logs**: Use polling to refresh log data periodically and render it on screen.
- **Scheduler**: Use the split view with the schedule list on the left and the detail plus edit form on the right.
