import React, { useMemo } from 'react';
import type { Task } from 'shared/types/index';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { KanbanBoard, type KanbanColumnDef, getWorkflowStatusRank } from './KanbanBoard';

export interface TasksKanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  onNewTaskClick?: () => void;
  readOnly?: boolean;
  statusOptions?: string[];
  wipLimits?: Record<string, number>;
}

const DEFAULT_STATUS_COLUMN_DEFS = [
  { id: 'New', labelKey: 'kanbanColNew', color: 'bg-indigo-500', defaultWip: 10 },
  { id: 'In Progress', labelKey: 'kanbanColInProgress', color: 'bg-blue-500', defaultWip: 5 },
  { id: 'Feedback', labelKey: 'kanbanColFeedback', color: 'bg-amber-500', defaultWip: 5 },
  { id: 'Resolved', labelKey: 'kanbanColResolved', color: 'bg-emerald-500', defaultWip: 10 },
  { id: 'Closed', labelKey: 'kanbanColClosed', color: 'bg-slate-500', defaultWip: 20 },
] as const;

export const TasksKanbanBoard: React.FC<TasksKanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  onNewTaskClick,
  readOnly = false,
  statusOptions,
  wipLimits = {},
}) => {
  const { t } = useLanguage();

  const columns = useMemo<KanbanColumnDef[]>(() => {
    const defaultColumns: KanbanColumnDef[] = DEFAULT_STATUS_COLUMN_DEFS.map(c => ({
      id: c.id,
      label: t(c.labelKey),
      color: c.color,
      defaultWip: c.defaultWip,
    }));
    let rawColumns: KanbanColumnDef[] = [];
    if (!statusOptions || statusOptions.length === 0) {
      rawColumns = defaultColumns;
    } else {
      rawColumns = statusOptions.map(st => {
        const match = defaultColumns.find(c => (c.id ?? '').toLowerCase() === st.toLowerCase());
        return {
          id: st,
          label: st,
          color: match?.color || 'bg-slate-500',
          defaultWip: match?.defaultWip || 10,
        };
      });
    }

    return [...rawColumns].sort((a, b) => {
      const rankA = getWorkflowStatusRank(a.id || a.label);
      const rankB = getWorkflowStatusRank(b.id || b.label);
      if (rankA !== rankB) return rankA - rankB;
      return a.label.localeCompare(b.label);
    });
  }, [statusOptions, t]);

  return (
    <KanbanBoard<Task>
      items={tasks}
      columns={columns}
      getItemId={task => String(task.id)}
      getItemStatus={task => task.status || 'New'}
      getItemCardProps={task => ({
        id: String(task.id),
        title: task.title,
        badgeText: task.task_category || task.task_type || 'Task',
        badgeVariant: task.task_type || 'default',
        progress: task.progress || 0,
        subtitle: task.planned_end_date
          ? t('dueDateSubtitle').replace('{date}', task.planned_end_date.slice(5))
          : undefined,
      })}
      onItemClick={onTaskClick}
      onStatusChange={onStatusChange}
      onNewItemClick={onNewTaskClick ? () => onNewTaskClick() : undefined}
      readOnly={readOnly}
      wipLimits={wipLimits}
      emptyMessage={t('noTasksRegistered')}
    />
  );
};
