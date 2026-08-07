export { TextCellEditor } from './TextCellEditor';
export { SelectCellEditor } from './SelectCellEditor';
export { DateCellEditor } from './DateCellEditor';
export { NumberCellEditor } from './NumberCellEditor';

import type { Project } from 'shared/types';
import type { Member } from 'shared/hooks/useProjectMembers';
import { getStatusLabel } from '../taskStatus';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function memberName(m: Member): string {
  const fullName = [m.firstname, m.lastname].filter(Boolean).join(' ').trim();
  return fullName || m.login;
}

export type CellEditorType = 'text' | 'select' | 'date' | 'number';

export interface ColumnEditorConfig {
  type: CellEditorType;
  /** For single fields: the Task field key. For date pairs: [startField, endField]. */
  field: string | [string, string];
  getOptions?: (project: Project, members: Member[], t?: (key: string) => string) => { value: string; label: string }[];
  /** Whether an empty value is allowed in select (e.g., assignee = unassigned) */
  allowEmpty?: boolean;
  /** Whether this field is required (e.g., title) */
  required?: boolean;
}

/**
 * Maps column keys to their editor configuration.
 * Column keys match TASK_COLUMNS in Tasks.tsx.
 */
export const COLUMN_EDITOR_CONFIG: Record<string, ColumnEditorConfig> = {
  title: {
    type: 'text',
    field: 'title',
    required: true,
  },
  task_type: {
    type: 'select',
    field: 'task_type',
    getOptions: (project) => {
      const types = safeJsonParse<string[]>(project.task_types, ['Design', 'Development', 'Testing']);
      return types.map((t) => ({ value: t, label: t }));
    },
  },
  task_category: {
    type: 'select',
    field: 'task_category',
    getOptions: (project) => {
      const cats = safeJsonParse<string[]>(project.task_categories, ['General', 'Feature', 'Bug']);
      return cats.map((c) => ({ value: c, label: c }));
    },
  },
  status: {
    type: 'select',
    field: 'status',
    getOptions: (project, _members, t) => {
      const statuses = safeJsonParse<string[]>(project.task_statuses, ['New', 'In Progress', 'Done']);
      return statuses.map((s) => ({ value: s, label: t ? getStatusLabel(s, t) : s }));
    },
  },
  assignee: {
    type: 'select',
    field: 'assignee_id',
    allowEmpty: true,
    getOptions: (_project, members, _t) =>
      members.map((m) => ({ value: m.user_id, label: memberName(m) })),
  },
  planned_dates: {
    type: 'date',
    field: ['planned_start_date', 'planned_end_date'],
  },
  actual_dates: {
    type: 'date',
    field: ['actual_start_date', 'actual_end_date'],
  },
  progress: {
    type: 'number',
    field: 'progress',
  },
};

/**
 * Build assignee options from project members.
 * This is separate because the assignee column isn't a default column yet —
 * it can be added in the future. For now, the select editor uses it when
 * editing assignee_id inline if such a column is added.
 */
export function getAssigneeOptions(members: Member[], unassignedLabel: string): { value: string; label: string }[] {
  return [
    { value: '', label: unassignedLabel },
    ...members.map((m) => ({ value: m.user_id, label: memberName(m) })),
  ];
}
