import { useCallback, useMemo, useRef, useEffect } from 'react';
import { Plus, CornerDownRight } from 'lucide-react';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { useInlineEdit } from 'shared/hooks/useInlineEdit';
import { TaskStatusBadge } from './TaskStatusBadge';
import {
  TextCellEditor,
  SelectCellEditor,
  DateCellEditor,
  NumberCellEditor,
  COLUMN_EDITOR_CONFIG,
} from './cell-editors';
import type { TaskTreeNode } from 'shared/lib/taskTree';
import type { Task, Project } from 'shared/types';
import type { Member } from 'shared/hooks/useProjectMembers';
import type { CellSaveState } from 'shared/hooks/useInlineEdit';

interface InlineEditableTableProps {
  rows: TaskTreeNode[];
  columnKeys: string[];
  project: Project;
  members: Member[];
  isArchived: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onSave: (taskId: string, patch: Record<string, unknown>) => Promise<boolean>;
  onTitleClick: (taskId: string) => void;
  onAddSubtask: (taskId: string) => void;
}

function memberName(m: Member): string {
  const fullName = [m.firstname, m.lastname].filter(Boolean).join(' ').trim();
  return fullName || m.login;
}

function getCellSaveClass(state: CellSaveState | undefined): string {
  if (!state) return '';
  if (state === 'saving') return 'animate-pulse bg-[var(--primary)]/5';
  if (state === 'success') return 'inline-edit-flash-success';
  if (state === 'error') return 'inline-edit-flash-error';
  return '';
}

export function InlineEditableTable({
  rows,
  columnKeys,
  project,
  members,
  isArchived,
  selectedIds,
  onToggleSelect,
  allSelected,
  onToggleSelectAll,
  onSave,
  onTitleClick,
  onAddSubtask,
}: InlineEditableTableProps) {
  const { t } = useLanguage();
  const tableRef = useRef<HTMLDivElement>(null);

  // Build column configs list (only visible columns)
  const visibleConfigs = useMemo(() => {
    return columnKeys
      .map((key) => ({ key, config: COLUMN_EDITOR_CONFIG[key] }))
      .filter((c) => c.config !== undefined);
  }, [columnKeys]);

  const handleCellSave = useCallback(
    async (rowIdx: number, colIdx: number, value: unknown): Promise<boolean> => {
      const row = rows[rowIdx];
      if (!row) return false;
      const colEntry = visibleConfigs[colIdx];
      if (!colEntry) return false;

      const { config } = colEntry;
      let patch: Record<string, unknown>;

      if (Array.isArray(config.field)) {
        // Date pair
        const v = value as { start: string; end: string };
        patch = {
          [config.field[0]]: v.start || null,
          [config.field[1]]: v.end || null,
        };
      } else {
        patch = { [config.field]: value };
      }

      return onSave(row.task.id, patch);
    },
    [rows, visibleConfigs, onSave],
  );

  const inlineEdit = useInlineEdit({
    rowCount: rows.length,
    colCount: visibleConfigs.length,
    onSave: handleCellSave,
    readOnly: isArchived,
  });

  // Scroll focused cell into view
  useEffect(() => {
    if (!inlineEdit.focusedCell) return;
    const { row, col } = inlineEdit.focusedCell;
    const cell = tableRef.current?.querySelector(
      `[data-row="${row}"][data-col="${col}"]`,
    ) as HTMLElement | null;
    cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [inlineEdit.focusedCell]);

  // Get the current field value from the task for a specific column
  const getTaskFieldValue = useCallback(
    (task: Task, colKey: string) => {
      const config = COLUMN_EDITOR_CONFIG[colKey];
      if (!config) return null;
      if (Array.isArray(config.field)) {
        return {
          start: (task as unknown as Record<string, unknown>)[config.field[0]] as string ?? '',
          end: (task as unknown as Record<string, unknown>)[config.field[1]] as string ?? '',
        };
      }
      return (task as unknown as Record<string, unknown>)[config.field as string];
    },
    [],
  );

  const handleCellClick = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (isArchived) return;
      inlineEdit.setFocusedCell({ row: rowIdx, col: colIdx });
    },
    [isArchived, inlineEdit],
  );

  const handleCellDoubleClick = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (isArchived) return;
      const row = rows[rowIdx];
      if (!row) return;
      const colEntry = visibleConfigs[colIdx];
      if (!colEntry) return;
      const value = getTaskFieldValue(row.task, colEntry.key);
      inlineEdit.startEditing(rowIdx, colIdx, value);
    },
    [isArchived, rows, visibleConfigs, getTaskFieldValue, inlineEdit],
  );

  // When Enter/F2 triggers startEditing without initial value from key press,
  // we need to load the current task value
  const handleKeyboardStartEdit = useCallback(() => {
    if (!inlineEdit.editingCell) return;
    const { row, col } = inlineEdit.editingCell;
    const rowData = rows[row];
    const colEntry = visibleConfigs[col];
    if (!rowData || !colEntry) return;

    if (inlineEdit.editValue === undefined || inlineEdit.editValue === null) {
      const value = getTaskFieldValue(rowData.task, colEntry.key);
      inlineEdit.setEditValue(value);
    }
  }, [inlineEdit, rows, visibleConfigs, getTaskFieldValue]);

  useEffect(() => {
    handleKeyboardStartEdit();
  }, [handleKeyboardStartEdit]);

  // Render a cell's display (non-editing) content
  const renderDisplayContent = useCallback(
    (task: Task, colKey: string, depth: number) => {
      switch (colKey) {
        case 'title':
          return (
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 18 }}>
              {depth > 0 && <CornerDownRight size={12} className="text-[var(--text-muted)] shrink-0" />}
              <span
                className="truncate text-sm font-medium text-[var(--primary)] hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onTitleClick(task.id);
                }}
              >
                {task.title}
              </span>
              {!isArchived && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSubtask(task.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-surface-2)] transition-all shrink-0 cursor-pointer"
                  title={t('addSubtask')}
                  aria-label={t('addSubtask')}
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
          );
        case 'task_type':
          return <span className="text-xs text-[var(--text-secondary)]">{task.task_type || '-'}</span>;
        case 'task_category':
          return <span className="text-xs text-[var(--text-secondary)]">{task.task_category || '-'}</span>;
        case 'status':
          return <TaskStatusBadge status={task.status} />;
        case 'assignee': {
          const member = members.find((m) => m.user_id === task.assignee_id);
          return (
            <span className="text-xs text-[var(--text-secondary)]">
              {member ? memberName(member) : t('unassigned')}
            </span>
          );
        }
        case 'planned_dates':
          return (
            <span className="text-xs text-[var(--text-muted)]">
              {task.planned_start_date ?? '-'} ~ {task.planned_end_date ?? '-'}
            </span>
          );
        case 'actual_dates':
          return (
            <span className="text-xs text-[var(--text-muted)]">
              {task.actual_start_date ?? '-'} ~ {task.actual_end_date ?? '-'}
            </span>
          );
        case 'progress':
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                  style={{ width: `${task.progress ?? 0}%` }}
                />
              </div>
              <span className="text-xs text-[var(--text-muted)] tabular-nums min-w-[2.5rem] text-right">
                {task.progress ?? 0}%
              </span>
            </div>
          );
        default:
          return null;
      }
    },
    [isArchived, onTitleClick, onAddSubtask, t, members],
  );

  // Render an editor for the given column
  const renderEditor = useCallback(
    (colKey: string) => {
      const config = COLUMN_EDITOR_CONFIG[colKey];
      if (!config) return null;

      switch (config.type) {
        case 'text':
          return (
            <TextCellEditor
              value={String(inlineEdit.editValue ?? '')}
              onChange={(v) => inlineEdit.setEditValue(v)}
              onCommit={inlineEdit.commitEdit}
              onCancel={inlineEdit.cancelEdit}
              required={config.required}
              placeholder={config.required ? t('inlineEditTitleRequired') : undefined}
            />
          );
        case 'select': {
          const options = config.getOptions?.(project, members, t) ?? [];
          return (
            <SelectCellEditor
              value={String(inlineEdit.editValue ?? '')}
              options={options}
              onChange={(v) => inlineEdit.setEditValue(v)}
              onCommit={inlineEdit.commitEdit}
              onCancel={inlineEdit.cancelEdit}
              allowEmpty={config.allowEmpty}
              emptyLabel={t('unassigned')}
            />
          );
        }
        case 'date': {
          const dateVal = inlineEdit.editValue as { start: string; end: string } | null;
          return (
            <DateCellEditor
              startValue={dateVal?.start ?? ''}
              endValue={dateVal?.end ?? ''}
              onChangeStart={(v) =>
                inlineEdit.setEditValue({ start: v, end: dateVal?.end ?? '' })
              }
              onChangeEnd={(v) =>
                inlineEdit.setEditValue({ start: dateVal?.start ?? '', end: v })
              }
              onCommit={inlineEdit.commitEdit}
              onCancel={inlineEdit.cancelEdit}
              validateOrder
              errorMessage={t('inlineEditInvalidDateOrder')}
            />
          );
        }
        case 'number':
          return (
            <NumberCellEditor
              value={Number(inlineEdit.editValue ?? 0)}
              onChange={(v) => inlineEdit.setEditValue(v)}
              onCommit={inlineEdit.commitEdit}
              onCancel={inlineEdit.cancelEdit}
            />
          );
        default:
          return null;
      }
    },
    [inlineEdit, project, members, t],
  );

  const LABEL_KEYS: Record<string, string> = {
    title: 'title',
    task_type: 'task_type',
    task_category: 'task_category',
    status: 'status',
    assignee: 'assignee',
    planned_dates: 'planned_dates',
    actual_dates: 'actual_dates',
    progress: 'progress',
  };

  return (
    <div
      ref={tableRef}
      className="table-container custom-scrollbar border-none rounded-none shadow-none"
      onKeyDown={inlineEdit.handleTableKeyDown}
      tabIndex={0}
      role="grid"
    >
      {/* CSS for save flash animations */}
      <style>{`
        @keyframes inlineEditFlashSuccess {
          0% { background-color: var(--success, #22c55e); opacity: 0.15; }
          100% { background-color: transparent; opacity: 1; }
        }
        @keyframes inlineEditFlashError {
          0% { background-color: var(--danger, #ef4444); opacity: 0.15; }
          100% { background-color: transparent; opacity: 1; }
        }
        .inline-edit-flash-success { animation: inlineEditFlashSuccess 0.8s ease-out; }
        .inline-edit-flash-error { animation: inlineEditFlashError 1.5s ease-out; }
        .inline-edit-focused {
          outline: 2px solid var(--primary);
          outline-offset: -2px;
          z-index: 1;
          position: relative;
        }
        .inline-edit-editing {
          background-color: var(--bg-surface);
          outline: 2px solid var(--primary);
          outline-offset: -2px;
          z-index: 2;
          position: relative;
          padding: 0 !important;
        }
      `}</style>
      <table className="table">
        <thead>
          <tr className="sticky top-0 z-10">
            {!isArchived && (
              <th className="w-11 min-w-[44px] max-w-[44px] text-center bg-[var(--bg-surface-2)] sticky top-0 z-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="accent-[var(--primary)]"
                />
              </th>
            )}
            {columnKeys.map((key) => (
              <th
                key={key}
                className={`select-none py-1.5 px-3 text-left font-bold text-xs uppercase tracking-wider sticky top-0 z-10 bg-[var(--bg-surface-2)] ${
                  key === 'title' ? '' : key === 'progress' ? 'w-28' : 'w-32'
                }`}
              >
                {t(LABEL_KEYS[key] ?? key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task, depth }, rowIdx) => {
            const isSelected = selectedIds.has(task.id);
            return (
              <tr
                key={task.id}
                className={`group transition-colors duration-150 ${
                  isSelected ? 'bg-[var(--primary)]/5' : ''
                }`}
                style={{ animation: `slideUpFade 0.3s ease ${rowIdx * 0.03}s both` }}
              >
                {!isArchived && (
                  <td
                    className="text-center py-1.5"
                    onClick={(e) => onToggleSelect(task.id, e)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-[var(--primary)]"
                    />
                  </td>
                )}
                {visibleConfigs.map(({ key }, colIdx) => {
                  const focused = inlineEdit.isFocused(rowIdx, colIdx);
                  const editing = inlineEdit.isEditing(rowIdx, colIdx);
                  const saveState = inlineEdit.cellSaveStates.get(`${rowIdx}:${colIdx}`);
                  const saveClass = getCellSaveClass(saveState);

                  return (
                    <td
                      key={key}
                      data-row={rowIdx}
                      data-col={colIdx}
                      tabIndex={-1}
                      className={`py-1.5 px-3 cursor-default transition-all duration-100 ${
                        editing
                          ? 'inline-edit-editing'
                          : focused
                            ? 'inline-edit-focused'
                            : ''
                      } ${saveClass}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCellClick(rowIdx, colIdx);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleCellDoubleClick(rowIdx, colIdx);
                      }}
                      title={!isArchived ? t('clickToEdit') : undefined}
                    >
                      {editing ? renderEditor(key) : renderDisplayContent(task, key, depth)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
