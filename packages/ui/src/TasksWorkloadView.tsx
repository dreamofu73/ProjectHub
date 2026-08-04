import React, { useMemo } from 'react';
import { User, AlertTriangle } from 'lucide-react';
import type { Task } from 'shared/types/index';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { TaskStatusBadge } from './TaskStatusBadge';

interface TasksWorkloadViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export const TasksWorkloadView: React.FC<TasksWorkloadViewProps> = ({
  tasks,
  onTaskClick,
}) => {
  const { t } = useLanguage();

  const workloadByAssignee = useMemo(() => {
    const map: Record<string, { assigneeName: string; total: number; active: number; closed: number; tasks: Task[] }> = {};

    map['unassigned'] = {
      assigneeName: t('unassignedAssignee') || 'Unassigned',
      total: 0,
      active: 0,
      closed: 0,
      tasks: [],
    };

    tasks.forEach(task => {
      const key = task.assignee_id ? task.assignee_id : 'unassigned';
      if (!map[key]) {
        map[key] = {
          assigneeName: `${t('assignee')} #${key}`,
          total: 0,
          active: 0,
          closed: 0,
          tasks: [],
        };
      }

      map[key].total += 1;
      map[key].tasks.push(task);
      if (task.status === 'Closed' || task.status === 'Resolved') {
        map[key].closed += 1;
      } else {
        map[key].active += 1;
      }
    });

    return Object.entries(map).filter(([_, val]) => val.total > 0);
  }, [tasks, t]);

  return (
    <div className="w-full space-y-4 pb-6">
      <div className="flex items-center justify-between bg-[var(--bg-surface-2)] p-4 rounded-xl border border-[var(--border)]">
        <div>
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">{t('resourceWorkloadTitle') || 'Resource Workload'}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t('resourceWorkloadDesc') || 'Review assigned tasks and over-allocation status per team member.'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] inline-block" />
            <span>{t('normalAllocation') || 'Normal (1-4)'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>{t('overAllocation') || 'Over-allocated (>5)'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {workloadByAssignee.map(([key, data]) => {
          const isOverAllocated = data.active >= 5;
          const completionRate = data.total > 0 ? Math.round((data.closed / data.total) * 100) : 0;

          return (
            <div
              key={key}
              className={`p-4 rounded-xl border transition-all ${
                isOverAllocated
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-[var(--border)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 pb-3 border-b border-[var(--border)]/60">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${isOverAllocated ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300' : 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20'}`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--text-primary)]">{data.assigneeName}</span>
                      {isOverAllocated && (
                        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {t('overAllocation') || 'Over-allocated'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {t('total') || 'Total'} {data.total} / {t('in_progress') || 'In Progress'} {data.active} / {t('closed') || 'Closed'} {data.closed}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs shrink-0">
                  <div className="text-right">
                    <span className="text-[var(--text-muted)]">{t('completionRateLabel') || 'Completion Rate'}</span>
                    <div className="font-bold text-sm text-[var(--primary)]">{completionRate}%</div>
                  </div>
                  <div className="w-32 bg-[var(--bg-surface-2)] h-2 rounded-full overflow-hidden border border-[var(--border)]/40">
                    <div
                      className={`h-full transition-all duration-300 ${isOverAllocated ? 'bg-rose-500' : 'bg-[var(--primary)]'}`}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Task Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.tasks.map(tItem => (
                  <div
                    key={tItem.id}
                    onClick={() => onTaskClick && onTaskClick(tItem)}
                    className="p-2.5 bg-[var(--bg-surface-2)]/60 hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-medium text-[var(--text-primary)] block truncate">{tItem.title}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{t('progress') || 'Progress'} {tItem.progress}%</span>
                    </div>
                    <TaskStatusBadge status={tItem.status} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
