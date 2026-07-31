# Typography Rules

## 1. Type scale (design tokens)

Every font size follows the **seven-step token scale** below. Arbitrary `text-[Npx]` values are forbidden — always use a defined token. `text-xs` is the smallest size.

| Token class | Actual size | Semantic role | Examples |
|:--|:--|:--|:--|
| `text-xs` | 12px | Smallest labels | Status badges, inline counts inside tables, very small supplementary information, table cell values, body text, labels, muted text, input values |
| `text-sm` | 14px | Body — emphasised | Section headers, button labels, navigation items, input labels |
| `text-base` | 16px | Card/panel titles | Card titles, panel titles, form section titles |
| `text-lg` | 18px | Dialog titles | Modal/dialog titles, section page titles |
| `text-xl` | 20px | Page titles | Top-level page headings |
| `text-2xl` | 24px | Hero/landing | Dashboard welcome message, empty-state page titles |
| `text-3xl` | 30px | Top-level hero | Error pages, brand pages |

> `text-xs` is Tailwind v4's default of **12px**.

---

## 2. Rules per component

### 2.1 Table

| Element | Token | Weight | Colour | Notes |
|:--|:--|:--|:--|:--|
| Header row (`<th>`) | `text-xs` | `font-bold` | `text-[var(--text-muted)]` | No uppercase needed |
| Cell value (`<td>`) | `text-xs` | `font-medium` | `text-[var(--text-secondary)]` | — |
| Muted value (date/ID) | `text-xs` | `font-normal` | `text-[var(--text-muted)]` | Monospace recommended |
| Status badge | `text-xs` | `font-bold` | (semantic colour) | 0.5 vertical padding |
| Pagination | `text-xs` | `font-bold` | `text-[var(--text-muted)]` | — |

**Example:**
```tsx
<thead>
  <tr className="text-xs font-bold text-[var(--text-muted)]">
    <th>이름</th>
    <th>아이디</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td className="text-xs font-medium text-[var(--text-secondary)]">홍길동</td>
    <td className="text-xs text-[var(--text-muted)]">hong</td>
  </tr>
</tbody>
```

### 2.2 Button

| Size variant | Token | Weight | Notes |
|:--|:--|:--|:--|
| `size="sm"` | `text-xs` | `font-bold` | Icon + label |
| `size="md"` (default) | `text-sm` | `font-bold` | Default button |
| `size="lg"` | `text-sm` | `font-bold` | Wide padding |

### 2.3 Badge

| Use | Token | Weight | Notes |
|:--|:--|:--|:--|
| Inline badge inside a table | `text-xs` | `font-bold` | `px-1.5 py-0.5 rounded-full` |
| Filter/tab badge | `text-xs` | `font-bold` | Shows a count |
| Card/panel badge | `text-xs` | `font-semibold` | General status |

### 2.4 Form

| Element | Token | Weight | Notes |
|:--|:--|:--|:--|
| Field label | `text-sm` | `font-bold` | `text-[var(--text-primary)]` |
| Input value | `text-sm` | `font-normal` | `text-[var(--text-primary)]` |
| Placeholder | `text-sm` | `font-normal` | `text-[var(--text-muted)]` |
| Help/error text | `text-xs` | `font-medium` | `text-[var(--danger)]` |

### 2.5 Headers and titles

| Element | Token | Weight | Notes |
|:--|:--|:--|:--|
| Page title (`<h1>`) | `text-xl` | `font-extrabold` | Top of the page |
| Section title (`<h2>`) | `text-lg` | `font-bold` | Section inside a card/panel |
| Card title | `text-sm` | `font-bold` | Card header |
| Dialog title | `text-base` | `font-bold` | Modal dialog |

### 2.6 Navigation and sidebar

| Element | Token | Weight | Notes |
|:--|:--|:--|:--|
| Sidebar link | `text-sm` | `font-medium` | `text-[var(--sidebar-link-color)]` |
| Sidebar section label | `text-xs` | `font-bold` | Uppercase, `tracking-wider` |
| User name | `text-sm` | `font-medium` | `text-[var(--sidebar-user-name-color)]` |
| User role | `text-xs` | `font-normal` | `text-[var(--sidebar-user-role-color)]` |

### 2.7 Memos

| Element | Token | Weight | Notes |
|:--|:--|:--|:--|
| List title | `text-xs` | `font-semibold` | Unread |
| List title (read) | `text-xs` | `font-normal` | Read |
| Sender/recipient name | `text-xs` | `font-medium` | `text-[var(--text-secondary)]` |
| Date/time | `text-xs` | `font-normal` | `text-[var(--text-muted)]` |
| Status badge (scheduled/sent) | `text-xs` | `font-bold` | `inline-flex items-center gap-1` |

### 2.8 Chat

| Element | Token | Weight | Notes |
|:--|:--|:--|:--|
| Message sender name | `text-xs` | `font-bold` | `text-[var(--text-primary)]` |
| Message body | `text-sm` | `font-normal` | `text-[var(--text-primary)]` |
| Message timestamp | `text-xs` | `font-normal` | `text-[var(--text-muted)]` |
| Channel name | `text-sm` | `font-semibold` | `text-[var(--text-primary)]` |
| Unread count | `text-xs` | `font-bold` | `bg-[var(--primary)] text-white rounded-full` |

### 2.9 Board

| Element | Token | Weight | Notes |
|:--|:--|:--|:--|
| Post title | `text-xs` | `font-semibold` | In the list |
| Author | `text-xs` | `font-medium` | `text-[var(--text-secondary)]` |
| View count/date | `text-xs` | `font-normal` | `text-[var(--text-muted)]` |
| Post body | `text-sm` | `font-normal` | Detail view |

---

## 3. Notes

1. **Forbidden**: arbitrary pixel values such as `text-[10px]`, `text-[11px]`, `text-[8px]`. Always use a defined token.
2. **`font-bold` vs `font-semibold`**: table headers, buttons, badges → `font-bold`. Emphasis in regular body text → `font-semibold` or `font-medium`.
3. **Colour pairing**: the same token takes different colours depending on its role (primary/secondary/muted).
4. **Consistency first**: when building a new component, follow the rules of the closest matching component in the tables above.

---

## 4. Migration history

| Date | Change |
|:--|:--|
| 2026-07-07 | Removed `text-micro` and `text-tiny`, consolidating them into `text-xs` |
