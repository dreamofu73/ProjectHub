import React, { useMemo } from 'react';
import type { Task } from 'shared/types/index';
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

const DEFAULT_STATUS_COLUMNS: KanbanColumnDef[] = [
  { id: 'New', label: '신규 (New)', color: 'bg-indigo-500', defaultWip: 10 },
  { id: 'In Progress', label: '진행중 (In Progress)', color: 'bg-blue-500', defaultWip: 5 },
  { id: 'Feedback', label: '피드백 (Feedback)', color: 'bg-amber-500', defaultWip: 5 },
  { id: 'Resolved', label: '해결됨 (Resolved)', color: 'bg-emerald-500', defaultWip: 10 },
  { id: 'Closed', label: '완료 (Closed)', color: 'bg-slate-500', defaultWip: 20 },
];

export const TasksKanbanBoard: React.FC<TasksKanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  onNewTaskClick,
  readOnly = false,
  statusOptions,
  wipLimits = {},
}) => {
  const columns = useMemo<KanbanColumnDef[]>(() => {
    let rawColumns: KanbanColumnDef[] = [];
    if (!statusOptions || statusOptions.length === 0) {
      rawColumns = DEFAULT_STATUS_COLUMNS;
    } else {
      rawColumns = statusOptions.map(st => {
        const match = DEFAULT_STATUS_COLUMNS.find(c => c.id.toLowerCase() === st.toLowerCase());
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
  }, [statusOptions]);

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
        subtitle: task.planned_end_date ? `${task.planned_end_date.slice(5)} 마감` : undefined,
      })}
      onItemClick={onTaskClick}
      onStatusChange={onStatusChange}
      onNewItemClick={onNewTaskClick ? () => onNewTaskClick() : undefined}
      readOnly={readOnly}
      wipLimits={wipLimits}
      emptyMessage="등록된 일감이 없습니다"
    />
  );
};
