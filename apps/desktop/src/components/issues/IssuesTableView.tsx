import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Clock, User } from 'lucide-react';

import type { Issue } from 'shared/types';

export interface ColumnDef {
  key: string;
  labelKey: string;
  width?: string;
  sortable: boolean;
  alwaysShow?: boolean; // checkbox always shows
}

interface RenderProps {
  formatDate: (date: string, options?: Intl.DateTimeFormatOptions) => string;
  t: (key: string) => string;
  isOverdue: (date: string | null) => boolean;
  isDueSoon: (date: string | null) => boolean;
  getAvatarColor: (name: string) => string;
  getInitials: (name: string) => string;
  STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }>;
  TRACKER_CONFIG: Record<string, { emoji: string; color: string }>;
  PRIORITY_CONFIG: Record<string, { color: string; label: string }>;
  trackerLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  onOpenDetail?: (issue: Issue) => void;
  selectedIssueId?: string | null;
}

interface IssuesTableViewProps {
  issues: Issue[];
  selectedIssues: string[];
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectIssue: (id: string) => void;
  onOpenDetail?: (issue: Issue) => void;
  selectedIssueId?: string | null;
  sortKey: string;
  sortOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
  projectId?: string;
  renderProps: RenderProps;
  columnKeys: string[];
  onReorderColumns: (newKeys: string[]) => void;
}

const headerBaseClass = 'select-none py-2 px-3 text-left font-bold text-xs uppercase tracking-wider sticky top-0 z-10 bg-[var(--bg-surface-2)]';

function SortHeader({
  column,
  sortKey,
  sortOrder,
  onSort,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  className,
}: {
  column: ColumnDef;
  sortKey: string;
  sortOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  className: string;
}) {
  const isSorted = sortKey === column.key;
  return (
    <th
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`${column.width || ''} ${headerBaseClass} ${className} cursor-pointer relative group`}
      onClick={() => onSort(column.key)}
    >
      <div className="flex items-center gap-1.5 justify-start">
        <span className="text-secondary group-hover:text-primary transition-colors">{column.labelKey}</span>
        <span className={`shrink-0 ${isSorted ? 'text-[var(--primary)] opacity-100' : 'text-[var(--text-muted)] opacity-50'}`}>
          {isSorted
            ? (sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
            : <ArrowUpDown size={11} />}
        </span>
      </div>
    </th>
  );
}

export function IssuesTableView({
  issues,
  selectedIssues,
  onSelectAll,
  onSelectIssue,
  sortKey,
  sortOrder,
  onSort,
  projectId,
  renderProps,
  onOpenDetail,
  selectedIssueId,
  columnKeys,
  onReorderColumns,
}: IssuesTableViewProps) {
  const { formatDate, t, isOverdue, isDueSoon, getAvatarColor, getInitials,
    STATUS_CONFIG, TRACKER_CONFIG, PRIORITY_CONFIG,
    trackerLabels, priorityLabels, statusLabels } = renderProps;

  const columns: ColumnDef[] = ALL_COLUMNS
    .filter(col => columnKeys.includes(col.key))
    .sort((a, b) => columnKeys.indexOf(a.key) - columnKeys.indexOf(b.key))
    .map(col => ({ ...col, labelKey: getColumnLabel(col.key, t) }));

  // visible columns filtering out project column when inside a project
  const visibleColumns = columns.filter(col => {
    if (col.key === 'project_name' && projectId) return false;
    return true;
  });

  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  const handleColumnDragStart = (key: string) => (e: React.DragEvent) => {
    setDraggedColKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };

  const handleColumnDragOver = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetKey !== draggedColKey) {
      setDragOverColKey(targetKey);
    }
  };

  const handleColumnDrop = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('text/plain') || draggedColKey;
    if (sourceKey && sourceKey !== targetKey) {
      const newKeys = [...columnKeys];
      const fromIdx = newKeys.indexOf(sourceKey);
      const toIdx = newKeys.indexOf(targetKey);
      if (fromIdx !== -1 && toIdx !== -1) {
        newKeys.splice(fromIdx, 1);
        newKeys.splice(toIdx, 0, sourceKey);
        // 부모(Issues.tsx)에서 전달받은 핸들러가 없으므로, 
        // 여기서는 로컬 상태만 업데이트하거나 부모에 onReorderColumns prop을 추가해야 함.
        // 일단 로컬 상태 업데이트를 위해 부모에 onReorderColumns prop을 추가하겠습니다.
        onReorderColumns(newKeys);
      }
    }
    setDraggedColKey(null);
    setDragOverColKey(null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColKey(null);
    setDragOverColKey(null);
  };

  const renderCell = (col: ColumnDef, issue: Issue) => {
    const overdue = isOverdue(issue.due_date) && issue.status !== 'closed' && issue.status !== 'resolved';
    const dueSoon = isDueSoon(issue.due_date) && issue.status !== 'closed' && issue.status !== 'resolved';
    const trackerCfg = TRACKER_CONFIG[issue.tracker] || { emoji: '•', color: '#6b7280' };
    const priorityCfg = PRIORITY_CONFIG[issue.priority] || { color: '#6b7280', label: issue.priority };

    switch (col.key) {
      case 'task_type':
        return <span className="text-xs text-[var(--text-secondary)]">{issue.task_type || '-'}</span>;
      case 'planned_start_date':
        return <span className="text-xs text-[var(--text-muted)]">{issue.planned_start_date ? formatDate(issue.planned_start_date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '-'}</span>;
      case 'actual_start_date':
        return <span className="text-xs text-[var(--text-muted)]">{issue.actual_start_date ? formatDate(issue.actual_start_date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '-'}</span>;
      case 'actual_end_date':
        return <span className="text-xs text-[var(--text-muted)]">{issue.actual_end_date ? formatDate(issue.actual_end_date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '-'}</span>;
      case 'id':
        return (
          <span className="text-xs font-bold text-[var(--text-muted)] font-mono">
            #{issue.id}
          </span>
        );
      case 'tracker':
        return (
          <span className="inline-flex items-center gap-1.25 text-xs font-semibold" style={{ color: trackerCfg.color }}>
            <span>{trackerCfg.emoji}</span>
            {trackerLabels[issue.tracker] || issue.tracker}
          </span>
        );
      case 'priority':
        return (
          <span className="inline-flex items-center gap-1.25">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: priorityCfg.color }} />
            <span className="text-xs font-semibold" style={{ color: priorityCfg.color }}>
              {priorityLabels[issue.priority] || issue.priority}
            </span>
          </span>
        );
      case 'status':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: STATUS_CONFIG[issue.status]?.color || 'var(--text-secondary)' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: STATUS_CONFIG[issue.status]?.dot || 'var(--text-muted)' }} />
            {statusLabels[issue.status] || issue.status}
          </span>
        );
      case 'project_name':
        return (
          <span className="text-xs">
            <Link
              to={`/projects/${issue.project_identifier}/dashboard`}
              className="font-semibold text-[var(--text-secondary)] hover:text-[var(--primary)]"
            >
              {issue.project_name}
            </Link>
          </span>
        );
      case 'subject':
        return (
          <div className="flex items-center gap-2">
            {onOpenDetail ? (
              <span className="issue-link text-sm cursor-pointer">
                {issue.subject}
              </span>
            ) : (
              <Link
                to={`/projects/${issue.project_identifier}/issues/${issue.id}`}
                className="issue-link text-sm"
              >
                {issue.subject}
              </Link>
            )}
            {overdue && (
              <span title={t('overdue')} className="inline-flex items-center text-[var(--danger)] shrink-0">
                <AlertCircle size={13} />
              </span>
            )}
            {dueSoon && !overdue && (
              <span title={t('dueSoon')} className="inline-flex items-center text-[var(--warning)] shrink-0">
                <Clock size={13} />
              </span>
            )}
          </div>
        );
      case 'assigned_name':
        return issue.assigned_name ? (
          <div className="flex items-center gap-1.75">
            <span
              className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-white text-[0.65rem] font-bold shrink-0"
              style={{ background: getAvatarColor(issue.assigned_name) }}
            >
              {getInitials(issue.assigned_name)}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              {issue.assigned_name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.25">
            <User size={13} className="opacity-40" /> {t('unassigned')}
          </span>
        );
      case 'author_name':
        return (
          <span className="text-xs text-[var(--text-secondary)]">
            {issue.author_name || issue.author_login || '-'}
          </span>
        );
      case 'created_at':
        return (
          <span className="text-[0.75rem] text-[var(--text-muted)]">
            {formatDate(issue.created_at, { year: 'numeric', month: 'numeric', day: 'numeric' })}
          </span>
        );
      case 'updated_at':
        return (
          <span className="text-[0.75rem] text-[var(--text-muted)]">
            {formatDate(issue.updated_at, { year: 'numeric', month: 'numeric', day: 'numeric' })}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <table className="table">
        <thead>
          <tr className="sticky top-0 z-10">
            <th className="w-11 min-w-[44px] max-w-[44px] text-center bg-[var(--bg-surface-2)] sticky top-0 z-10">
              <input
                type="checkbox"
                checked={issues.length > 0 && selectedIssues.length === issues.length}
                onChange={onSelectAll}
                className="accent-[var(--primary)]"
              />
            </th>
            {visibleColumns.map(col => {
              const isDragging = draggedColKey === col.key;
              const isDragOver = dragOverColKey === col.key;
              const headerProps = {
                draggable: true,
                onDragStart: handleColumnDragStart(col.key),
                onDragOver: handleColumnDragOver(col.key),
                onDrop: handleColumnDrop(col.key),
                onDragEnd: handleColumnDragEnd,
                className: `${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'bg-[var(--primary-bg)]' : ''} cursor-grab active:cursor-grabbing`,
              };
              return col.sortable ? (
                <SortHeader key={col.key} column={col} sortKey={sortKey} sortOrder={sortOrder} onSort={onSort} {...headerProps} />
              ) : (
                <th key={col.key} {...headerProps} className={`${col.width || ''} ${headerBaseClass} relative group`}>
                  {col.labelKey}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, idx) => {
            const isSelected = selectedIssues.includes(issue.id);
            const isDetailSelected = selectedIssueId === issue.id;
            const clickable = !!onOpenDetail;
            return (
              <tr
                key={issue.id}
                onClick={clickable ? () => onOpenDetail(issue) : undefined}
                className={`transition-colors duration-150 ${
                  isSelected ? 'bg-indigo-50/5 dark:bg-indigo-950/5' : isDetailSelected ? 'bg-[var(--primary)]/5' : 'bg-transparent'
                } ${clickable ? 'cursor-pointer' : ''}`}
                style={{
                  animation: `slideUpFade 0.3s ease ${idx * 0.03}s both`,
                }}
              >
                <td className="text-center py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); onSelectIssue(issue.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-[var(--primary)]"
                  />
                </td>
                {visibleColumns.map(col => (
                  <td key={col.key} className="py-2 px-3">
                    {renderCell(col, issue)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** All available column definitions with defaults */
export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'id', labelKey: '#', width: 'w-16', sortable: true },
  { key: 'tracker', labelKey: '유형', width: 'w-28', sortable: true },
  { key: 'task_type', labelKey: '작업유형', width: 'w-28', sortable: true },
  { key: 'priority', labelKey: '우선순위', width: 'w-28', sortable: true },
  { key: 'status', labelKey: '진행상태', width: 'w-28', sortable: true },
  { key: 'project_name', labelKey: '프로젝트명', sortable: true },
  { key: 'subject', labelKey: '이슈명', sortable: true },
  { key: 'assigned_name', labelKey: '담당자', width: 'w-36', sortable: true },
  { key: 'planned_start_date', labelKey: '계획시작일', width: 'w-32', sortable: true },
  { key: 'actual_start_date', labelKey: '실제시작일', width: 'w-32', sortable: true },
  { key: 'actual_end_date', labelKey: '실제종료일', width: 'w-32', sortable: true },
  { key: 'author_name', labelKey: '생성자', width: 'w-28', sortable: true },
  { key: 'created_at', labelKey: '생성일자', width: 'w-32', sortable: true },
  { key: 'updated_at', labelKey: '수정일자', width: 'w-32', sortable: true },
];

/** Default visible columns and order */
export const DEFAULT_COLUMN_KEYS = [
  'project_name',
  'subject',
  'status',
  'assigned_name',
  'created_at',
];

/** Resolve i18n labels for column headers */
export function getColumnLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    id: '#',
    tracker: t('tracker') || '유형',
    task_type: t('task_type') || '작업유형',
    priority: t('priority') || '우선순위',
    status: t('status') || '진행상태',
    project_name: t('project') || '프로젝트명',
    subject: t('title') || '이슈명',
    assigned_name: t('assignee') || '담당자',
    planned_start_date: t('planned_start_date') || '계획시작일',
    actual_start_date: t('actual_start_date') || '실제시작일',
    actual_end_date: t('actual_end_date') || '실제종료일',
    author_name: t('author') || '생성자',
    created_at: t('created_at') || '생성일자',
    updated_at: t('updated_at') || '수정일자',
  };
  return map[key] || key;
}
