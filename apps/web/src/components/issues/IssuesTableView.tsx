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
  STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }>;
  TRACKER_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }>;
  PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }>;
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

const headerBaseClass = 'select-none py-1.5 px-3 text-left font-bold text-xs uppercase tracking-wider sticky top-0 z-10 bg-[var(--bg-surface-2)]';

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
    const trackerCfg = TRACKER_CONFIG[issue.tracker] || { emoji: '•', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' };
    const statusCfg = STATUS_CONFIG[issue.status] || { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)', dot: '#64748b' };
    const priorityCfg = PRIORITY_CONFIG[issue.priority] || { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', label: issue.priority };

    switch (col.key) {
      case 'task_type':
        return <span className="text-xs text-[var(--text-secondary)] font-medium">{issue.task_type || '-'}</span>;
      case 'planned_start_date':
        return <span className="text-xs text-[var(--text-muted)] tabular-nums">{issue.planned_start_date ? formatDate(issue.planned_start_date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '-'}</span>;
      case 'actual_start_date':
        return <span className="text-xs text-[var(--text-muted)] tabular-nums">{issue.actual_start_date ? formatDate(issue.actual_start_date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '-'}</span>;
      case 'actual_end_date':
        return <span className="text-xs text-[var(--text-muted)] tabular-nums">{issue.actual_end_date ? formatDate(issue.actual_end_date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '-'}</span>;
      case 'id':
        return (
          <span className="text-xs font-bold text-[var(--text-muted)] font-mono tabular-nums bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            #{issue.id}
          </span>
        );
      case 'tracker':
        return (
          <span
            className="inline-flex items-center gap-1.5 text-[0.725rem] font-bold px-2 py-0.5 rounded-md border transition-all shadow-2xs"
            style={{ color: trackerCfg.color, backgroundColor: trackerCfg.bg, borderColor: trackerCfg.border }}
          >
            <span className="text-xs">{trackerCfg.emoji}</span>
            {trackerLabels[issue.tracker] || issue.tracker}
          </span>
        );
      case 'priority':
        return (
          <span
            className="inline-flex items-center gap-1.5 text-[0.725rem] font-semibold px-2 py-0.5 rounded border"
            style={{ color: priorityCfg.color, backgroundColor: priorityCfg.bg, borderColor: priorityCfg.border }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: priorityCfg.color }} />
            {priorityLabels[issue.priority] || issue.priority}
          </span>
        );
      case 'status':
        return (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.75 rounded-full border shadow-2xs transition-all"
            style={{ color: statusCfg.color, backgroundColor: statusCfg.bg, borderColor: statusCfg.border }}
          >
            <span className="w-1.75 h-1.75 rounded-full inline-block shrink-0 animate-pulse" style={{ background: statusCfg.dot }} />
            {statusLabels[issue.status] || issue.status}
          </span>
        );
      case 'project_name':
        return (
          <span className="text-xs">
            <Link
              to={`/projects/${issue.project_identifier}/dashboard`}
              className="font-bold text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
            >
              {issue.project_name}
            </Link>
          </span>
        );
      case 'subject': {
        // Clean bracket tracker prefixes like [SUPPORT] if present in subject string for cleaner display
        const displaySubject = issue.subject.replace(/^\[(SUPPORT|FEATURE|BUG|TASK|ENHANCEMENT)\]\s*/i, '');
        return (
          <div className="flex items-center gap-2">
            {!columnKeys.includes('tracker') && (
              <span
                className="inline-flex items-center text-[0.65rem] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0"
                style={{ color: trackerCfg.color, backgroundColor: trackerCfg.bg, borderColor: trackerCfg.border }}
              >
                {trackerLabels[issue.tracker] || issue.tracker}
              </span>
            )}
            {onOpenDetail ? (
              <span className="issue-link text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors cursor-pointer leading-snug">
                {displaySubject}
              </span>
            ) : (
              <Link
                to={`/projects/${issue.project_identifier}/issues/${issue.id}`}
                className="issue-link text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors leading-snug"
              >
                {displaySubject}
              </Link>
            )}
            {overdue && (
              <span title={t('overdue')} className="inline-flex items-center text-[var(--danger)] shrink-0 bg-red-50 dark:bg-red-950/30 p-1 rounded-full border border-red-200 dark:border-red-900">
                <AlertCircle size={13} />
              </span>
            )}
            {dueSoon && !overdue && (
              <span title={t('dueSoon')} className="inline-flex items-center text-[var(--warning)] shrink-0 bg-amber-50 dark:bg-amber-950/30 p-1 rounded-full border border-amber-200 dark:border-amber-900">
                <Clock size={13} />
              </span>
            )}
          </div>
        );
      }
      case 'assigned_name':
        return issue.assigned_name ? (
          <div className="flex items-center gap-2">
            <span
              className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-white text-[0.65rem] font-extrabold shrink-0 shadow-xs border border-white/20"
              style={{ background: getAvatarColor(issue.assigned_name) }}
            >
              {getInitials(issue.assigned_name)}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-semibold">
              {issue.assigned_name}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] text-[0.7rem] font-medium border border-slate-200/50 dark:border-slate-700/50">
            <User size={12} className="opacity-60" /> {t('unassigned')}
          </span>
        );
      case 'author_name':
        return (
          <span className="text-xs text-[var(--text-secondary)] font-medium">
            {issue.author_name || issue.author_login || '-'}
          </span>
        );
      case 'created_at':
        return (
          <span className="text-[0.75rem] text-[var(--text-muted)] tabular-nums">
            {formatDate(issue.created_at, { year: 'numeric', month: 'numeric', day: 'numeric' })}
          </span>
        );
      case 'updated_at':
        return (
          <span className="text-[0.75rem] text-[var(--text-muted)] tabular-nums">
            {formatDate(issue.updated_at, { year: 'numeric', month: 'numeric', day: 'numeric' })}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full flex-1 overflow-auto custom-scrollbar">
      <table className="table w-full border-collapse">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-[var(--border)]">
            <th className="w-11 min-w-[44px] max-w-[44px] text-center bg-[var(--bg-surface-2)] sticky top-0 z-10 py-1.5">
              <input
                type="checkbox"
                checked={issues.length > 0 && selectedIssues.length === issues.length}
                onChange={onSelectAll}
                className="accent-[var(--primary)] cursor-pointer"
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
        <tbody className="divide-y divide-[var(--border)]/60">
          {issues.map((issue, idx) => {
            const isSelected = selectedIssues.includes(issue.id);
            const isDetailSelected = selectedIssueId === issue.id;
            const clickable = !!onOpenDetail;
            return (
              <tr
                key={issue.id}
                onClick={clickable ? () => onOpenDetail(issue) : undefined}
                className={`transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                  isSelected ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : isDetailSelected ? 'bg-[var(--primary)]/10' : 'bg-transparent'
                } ${clickable ? 'cursor-pointer' : ''}`}
                style={{
                  animation: `slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.02}s both`,
                }}
              >
                <td className="text-center py-1.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); onSelectIssue(issue.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-[var(--primary)] cursor-pointer"
                  />
                </td>
                {visibleColumns.map(col => (
                  <td key={col.key} className="py-1.5 px-3 align-middle">
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
  { key: 'tracker', labelKey: 'tracker', width: 'w-28', sortable: true },
  { key: 'task_type', labelKey: 'task_type', width: 'w-28', sortable: true },
  { key: 'priority', labelKey: 'priority', width: 'w-28', sortable: true },
  { key: 'status', labelKey: 'progressStatus', width: 'w-28', sortable: true },
  { key: 'project_name', labelKey: 'projectName', sortable: true },
  { key: 'subject', labelKey: 'issueName', sortable: true },
  { key: 'assigned_name', labelKey: 'assignee', width: 'w-36', sortable: true },
  { key: 'planned_start_date', labelKey: 'plannedStartDate', width: 'w-32', sortable: true },
  { key: 'actual_start_date', labelKey: 'actualStartDate', width: 'w-32', sortable: true },
  { key: 'actual_end_date', labelKey: 'actualEndDate', width: 'w-32', sortable: true },
  { key: 'author_name', labelKey: 'author', width: 'w-28', sortable: true },
  { key: 'created_at', labelKey: 'createdDate2', width: 'w-32', sortable: true },
  { key: 'updated_at', labelKey: 'updatedDate2', width: 'w-32', sortable: true },
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
    tracker: t('tracker'),
    task_type: t('task_type'),
    priority: t('priority'),
    status: t('status'),
    project_name: t('project'),
    subject: t('title'),
    assigned_name: t('assignee'),
    planned_start_date: t('planned_start_date'),
    actual_start_date: t('actual_start_date'),
    actual_end_date: t('actual_end_date'),
    author_name: t('author'),
    created_at: t('created_at'),
    updated_at: t('updated_at'),
  };
  return map[key] || key;
}
