import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, CheckSquare, Square, Minus, Upload, Search, CornerDownRight } from 'lucide-react';
import { useToast } from 'ui/Toast';
import { useLanguage } from '../context/LanguageContext';
import { useTasks } from 'shared/hooks/useTasks';
import { NewTaskPanel } from 'ui/NewTaskPanel';
import { TaskDetailPanel } from 'ui/TaskDetailPanel';
import { BulkTaskEditPanel } from 'ui/BulkTaskEditPanel';
import { BulkUploadModal } from 'ui/BulkUploadModal';
import { TasksGanttChart } from 'ui/TasksGanttChart';
import { TasksKanbanBoard } from 'ui/TasksKanbanBoard';
import { TasksWorkloadView } from 'ui/TasksWorkloadView';
import { NewMilestonePanel } from 'ui/NewMilestonePanel';
import { TaskStatusBadge } from 'ui/TaskStatusBadge';
import { useMilestones } from 'shared/hooks/useMilestones';
import { flattenTaskTree } from 'shared/lib/taskTree';
import { useLocation } from 'react-router-dom';

import type { Task } from 'shared/types';
import type { GanttDatePatch } from 'ui/TasksGanttChart';

function addDaysStr(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function computeAdjustedDates(
  predTask: Task,
  currTask: Task,
  depType: 'FS' | 'SS' | 'FF' | 'SF'
): { planned_start_date: string; planned_end_date: string } | null {
  let duration = 3;
  if (currTask.planned_start_date && currTask.planned_end_date) {
    const s = new Date(currTask.planned_start_date).getTime();
    const e = new Date(currTask.planned_end_date).getTime();
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      duration = Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    }
  }

  let newStart = '';
  let newEnd = '';

  if (depType === 'FS') {
    const baseDate = predTask.planned_end_date || predTask.planned_start_date;
    if (!baseDate) return null;
    newStart = addDaysStr(baseDate, 1);
    newEnd = addDaysStr(newStart, duration);
  } else if (depType === 'SS') {
    const baseDate = predTask.planned_start_date || predTask.planned_end_date;
    if (!baseDate) return null;
    newStart = baseDate;
    newEnd = addDaysStr(newStart, duration);
  } else if (depType === 'FF') {
    const baseDate = predTask.planned_end_date || predTask.planned_start_date;
    if (!baseDate) return null;
    newEnd = baseDate;
    newStart = addDaysStr(newEnd, -duration);
  } else if (depType === 'SF') {
    const baseDate = predTask.planned_start_date || predTask.planned_end_date;
    if (!baseDate) return null;
    newEnd = baseDate;
    newStart = addDaysStr(newEnd, -duration);
  }

  if (!newStart || !newEnd) return null;
  return { planned_start_date: newStart, planned_end_date: newEnd };
}

export default function TasksPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { tasks, dependencies, loading, error, project, fetchTasks, updateTask, bulkUpdateTasks } = useTasks();
  const isArchived = project?.status === 'archived';
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskParent, setNewTaskParent] = useState<Task | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isMilestoneOpen, setIsMilestoneOpen] = useState(false);
  const { milestones, createMilestone, deleteMilestone } = useMilestones(project?.id);
  const location = useLocation();

  const queryView = new URLSearchParams(location.search).get('view');
  const [currentView, setCurrentView] = useState<'table' | 'gantt' | 'kanban' | 'workload'>(
    queryView === 'gantt' ? 'gantt' : queryView === 'kanban' ? 'kanban' : queryView === 'workload' ? 'workload' : 'table'
  );

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('view');
    const v = q === 'gantt' ? 'gantt' : q === 'kanban' ? 'kanban' : q === 'workload' ? 'workload' : 'table';
    setCurrentView(v);
  }, [location.search]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 프로젝트 변경 또는 뷰 전환 시 선택 상태 초기화
  useEffect(() => {
    setSelectedIds(new Set());
    setIsBulkEditOpen(false);
  }, [currentView, project?.id]);

  // 프로젝트 변경 시 필터 초기화
  useEffect(() => {
    setStatusFilter('all');
    setSearchQuery('');
  }, [project?.id]);

  // ESC 키로 상세보기 / 일괄수정 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (isNewTaskOpen || isBulkUploadOpen) return;
      if (isMilestoneOpen) {
        e.preventDefault();
        setIsMilestoneOpen(false);
        return;
      }
      if (isBulkEditOpen) {
        e.preventDefault();
        setIsBulkEditOpen(false);
        return;
      }
      if (selectedTaskId !== null) {
        e.preventDefault();
        setSelectedTaskId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, isNewTaskOpen, isBulkUploadOpen, isBulkEditOpen, isMilestoneOpen]);

  // 간트 차트 드래그 결과를 낙관적으로 로컬 상태에 반영하고 서버에 저장한다.
  const handleGanttDateChange = useCallback(async (taskId: string, patch: GanttDatePatch) => {
    const ok = await updateTask(taskId, patch);
    if (!ok) {
      showToast(t('taskUpdatedError'), 'error');
      return;
    }
    // 의존성 연쇄: 선행 일감 변경 시 후행 일감 계획일자 연쇄 자동 반영
    const succDeps = dependencies.filter(d => String(d.predecessor_id) === String(taskId));
    if (succDeps.length > 0) {
      const predTask = tasks.find(t => String(t.id) === String(taskId));
      if (predTask) {
        const updatedPred = { ...predTask, ...patch };
        for (const dep of succDeps) {
          const succTask = tasks.find(t => String(t.id) === String(dep.successor_id));
          if (succTask) {
            const newDates = computeAdjustedDates(updatedPred, succTask, dep.dependency_type);
            if (newDates) {
              await updateTask(succTask.id, newDates);
            }
          }
        }
      }
    }
  }, [updateTask, showToast, t, dependencies, tasks]);

  // 특정 일감의 하위 일감 생성 패널을 연다.
  const openSubtaskPanel = useCallback((taskId: string) => {
    setNewTaskParent(tasks.find(task => task.id === taskId) ?? null);
    setIsNewTaskOpen(true);
  }, [tasks]);

  const closeNewTaskPanel = useCallback(() => {
    setIsNewTaskOpen(false);
    setNewTaskParent(null);
  }, []);

  // ── 필터/검색 (테이블 뷰 전용) ──────────────────────────────────────
  const statusOptions = useMemo(() => {
    let configured: string[] = [];
    try {
      const parsed = JSON.parse(project?.task_statuses || '[]');
      if (Array.isArray(parsed)) configured = parsed.filter((s): s is string => typeof s === 'string');
    } catch { /* 잘못된 설정 JSON은 무시 */ }
    const fromTasks = tasks.map(task => task.status).filter((s): s is string => !!s);
    return Array.from(new Set([...configured, ...fromTasks]));
  }, [project, tasks]);

  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (q && !(task.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, statusFilter, searchQuery]);

  // 테이블 뷰도 상위/하위 일감 순서로 정렬해 계층을 그대로 보여준다.
  const visibleRows = useMemo(() => flattenTaskTree(visibleTasks), [visibleTasks]);

  // ── 일괄 선택 (테이블 뷰 전용) ──────────────────────────────────────
  const allSelected = !isArchived && visibleTasks.length > 0 && visibleTasks.every(task => selectedIds.has(task.id));
  const someSelected = !isArchived && visibleTasks.some(task => selectedIds.has(task.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleTasks.map(task => task.id)));
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!project) return null;

  return (
    <div className="w-full h-[calc(100vh-105px)] animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0 flex-wrap gap-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <CheckSquare size={16} className="text-[var(--primary)]" />
          <span>
            {t('tasks')} - {project.name}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)] ml-2">
              ({currentView === 'gantt' ? t('ganttChart') : currentView === 'kanban' ? t('kanbanBoard') : currentView === 'workload' ? t('workloadView') : t('wbsList')})
            </span>
          </span>
        </h2>

        <div className="flex gap-2">
          {!isArchived && (
            <>
              <button
                type="button"
                onClick={() => setIsBulkUploadOpen(true)}
                className="h-8.5 px-3.5 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border border-[var(--border)]"
              >
                <Upload size={13} />
                {t('bulkUpload')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewTaskParent(null);
                  setIsNewTaskOpen(true);
                }}
                className="h-8.5 px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
              >
                <Plus size={13} />
                {t('addNewTask')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div>{t('loading')}...</div>
        ) : error ? (
          <div className="text-[var(--danger)]">{error}</div>
        ) : (
          <>
            {currentView === 'gantt' ? (
              <TasksGanttChart
                tasks={tasks}
                dependencies={dependencies}
                milestones={milestones}
                readOnly={isArchived}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
                onDateChange={handleGanttDateChange}
                onAddSubtask={openSubtaskPanel}
                onAddMilestone={() => setIsMilestoneOpen(true)}
              />
            ) : currentView === 'kanban' ? (
              <TasksKanbanBoard
                tasks={tasks}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
                onStatusChange={(taskId, newStatus) => updateTask(taskId, { status: newStatus })}
                onNewTaskClick={() => setIsNewTaskOpen(true)}
                readOnly={isArchived}
                statusOptions={statusOptions}
              />
            ) : currentView === 'workload' ? (
              <TasksWorkloadView
                tasks={tasks}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
              />
            ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search')}
                    className="w-full h-8 pl-8 pr-3 rounded-xl text-xs bg-[var(--bg-surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none transition-all"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 px-2.5 pr-7 rounded-xl text-xs font-semibold bg-[var(--bg-surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none transition-all cursor-pointer"
                >
                  <option value="all">{t('filterAll')}</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {!isArchived && selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-[var(--bg-surface-2)]/70 border border-[var(--border)]">
                  <span className="text-xs font-bold text-[var(--primary)] whitespace-nowrap">
                    {t('bulkSelectCount').replace('{count}', String(selectedIds.size))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBulkEditOpen(true)}
                    className="h-7 px-3 bg-[var(--primary)] hover:opacity-90 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer border-none"
                  >
                    {t('bulkEdit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="h-7 px-3 bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-lg text-xs font-bold transition-all cursor-pointer border border-[var(--border)]"
                  >
                    {t('deselectAll')}
                  </button>
                </div>
              )}
              {visibleTasks.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-[var(--text-muted)]">
                  {tasks.length === 0
                    ? t('noTasksFound')
                    : searchQuery.trim()
                      ? t('noSearchResultsFor').replace('{term}', searchQuery.trim())
                      : t('noSearchResultsFor').replace('{term}', statusFilter)}
                </div>
              ) : (
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    {!isArchived && (
                      <th className="w-10 py-2 text-center">
                        <div
                          className="flex items-center justify-center cursor-pointer p-1 rounded hover:bg-[var(--bg-surface-2)]"
                          onClick={toggleSelectAll}
                          title={allSelected ? t('deselectAll') : t('selectAll')}
                        >
                          {allSelected
                            ? <CheckSquare size={14} className="text-[var(--primary)]" />
                            : someSelected
                              ? <Minus size={14} className="text-[var(--primary)]" />
                              : <Square size={14} className="text-[var(--text-muted)] opacity-60" />
                          }
                        </div>
                      </th>
                    )}
                    <th className="text-left py-2">{t('title')}</th>
                    <th className="text-left py-2">{t('task_type')}</th>
                    <th className="text-left py-2">{t('task_category')}</th>
                    <th className="text-left py-2">{t('status')}</th>
                    <th className="text-left py-2">{t('planned_dates')}</th>
                    <th className="text-left py-2">{t('actual_dates')}</th>
                    <th className="text-left py-2">{t('progress')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(({ task, depth }) => (
                    <tr key={task.id} className={`group border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer ${selectedIds.has(task.id) ? 'bg-[var(--primary)]/5' : ''}`} onClick={() => setSelectedTaskId(task.id)}>
                      {!isArchived && (
                        <td className="py-2 text-center" onClick={(e) => toggleSelectRow(task.id, e)}>
                          <div className="flex items-center justify-center">
                            {selectedIds.has(task.id)
                              ? <CheckSquare size={14} className="text-[var(--primary)]" />
                              : <Square size={14} className="text-[var(--text-muted)] opacity-65" />
                            }
                          </div>
                        </td>
                      )}
                      <td className="py-2">
                        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 18 }}>
                          {depth > 0 && <CornerDownRight size={12} className="text-[var(--text-muted)] shrink-0" />}
                          <span className="truncate">{task.title}</span>
                          {!isArchived && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSubtaskPanel(task.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-surface-2)] transition-all shrink-0 cursor-pointer"
                              title={t('addSubtask')}
                              aria-label={t('addSubtask')}
                            >
                              <Plus size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2">{task.task_type}</td>
                      <td className="py-2">{task.task_category}</td>
                      <td className="py-2"><TaskStatusBadge status={task.status} /></td>
                      <td className="py-2">{task.planned_start_date ?? '-'} - {task.planned_end_date ?? '-'}</td>
                      <td className="py-2">{task.actual_start_date ?? '-'} - {task.actual_end_date ?? '-'}</td>
                      <td className="py-2">{task.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </>
            )}
          </>
        )}
      </div>

      {selectedTaskId !== null && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <TaskDetailPanel
            taskId={selectedTaskId}
            project={project}
            isArchived={isArchived}
            onClose={() => setSelectedTaskId(null)}
            onUpdated={fetchTasks}
          />
        </div>
      )}

      {isNewTaskOpen && project && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <NewTaskPanel
            project={project}
            parentTaskId={newTaskParent?.id ?? null}
            parentTaskTitle={newTaskParent?.title}
            onClose={closeNewTaskPanel}
            onCreated={() => {
              closeNewTaskPanel();
              fetchTasks();
            }}
          />
        </div>
      )}
      {isMilestoneOpen && project && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <NewMilestonePanel
            milestones={milestones}
            onCreate={createMilestone}
            onDelete={deleteMilestone}
            onClose={() => setIsMilestoneOpen(false)}
          />
        </div>
      )}
      {isBulkUploadOpen && project && (
        <BulkUploadModal
          project={project}
          onClose={() => setIsBulkUploadOpen(false)}
          onUploaded={() => {
            setIsBulkUploadOpen(false);
            fetchTasks();
          }}
        />
      )}
      {isBulkEditOpen && project && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <BulkTaskEditPanel
            project={project}
            taskIds={Array.from(selectedIds)}
            onSave={(updates) => bulkUpdateTasks(Array.from(selectedIds), updates)}
            onClose={(success) => {
              setIsBulkEditOpen(false);
              if (success) {
                setSelectedIds(new Set());
                fetchTasks();
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
