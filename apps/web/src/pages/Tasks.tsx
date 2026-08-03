import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, CheckSquare, Upload, Search, CornerDownRight, Settings, X, Layers, AlertCircle, GanttChart, Columns3, Users } from 'lucide-react';
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

  // ── 컬럼 설정 ──
  const [columnKeys, setColumnKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('task_column_keys');
      return saved ? JSON.parse(saved) : DEFAULT_TASK_COLUMN_KEYS;
    } catch {
      return DEFAULT_TASK_COLUMN_KEYS;
    }
  });
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const columnSettingsRef = useRef<HTMLDivElement>(null);

  const saveColumnKeys = (keys: string[]) => {
    setColumnKeys(keys);
    localStorage.setItem('task_column_keys', JSON.stringify(keys));
  };

  const toggleColumn = (key: string) => {
    if (columnKeys.includes(key)) {
      saveColumnKeys(columnKeys.filter(k => k !== key));
    } else {
      saveColumnKeys([...columnKeys, key]);
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter !== 'all' || searchQuery.trim() !== '';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(e.target as Node)) {
        setIsColumnSettingsOpen(false);
      }
    };
    if (isColumnSettingsOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isColumnSettingsOpen]);

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

  const viewHeaderInfo = useMemo(() => {
    switch (currentView) {
      case 'gantt':
        return { Icon: GanttChart, title: t('ganttChart') };
      case 'kanban':
        return { Icon: Columns3, title: t('kanbanBoard') };
      case 'workload':
        return { Icon: Users, title: t('workloadView') };
      default:
        return { Icon: CheckSquare, title: t('wbsList') };
    }
  }, [currentView, t]);

  const HeaderIcon = viewHeaderInfo.Icon;

  if (!project) return null;

  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden text-[var(--text-primary)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0 flex-wrap gap-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <HeaderIcon size={16} className="text-[var(--primary)] shrink-0" />
          <span>
            {viewHeaderInfo.title}
            <span className="text-xs font-normal text-[var(--text-muted)] ml-2">
              ({project.name})
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
              {/* ── 툴바 ── */}
              <div className="flex items-center gap-2 flex-wrap min-w-0 mb-3">
                {/* 검색 입력 */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search')}
                    className="pl-2 pr-7 py-1 h-8 w-40 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer"
                  >
                    <Search size={12} />
                  </button>
                </div>

                {/* 상태 필터 */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
                >
                  <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('filterAll')}</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{s}</option>
                  ))}
                </select>

                {/* 초기화 버튼 */}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-8 px-2.5 flex items-center gap-1 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer font-medium"
                  title={t('resetFilters')}
                >
                  <X size={12} />
                  {t('resetFilters')}
                </button>

                {/* 컬럼 설정 */}
                <div ref={columnSettingsRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsColumnSettingsOpen(!isColumnSettingsOpen)}
                    className="h-8 px-2.5 flex items-center gap-1 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer font-medium"
                    title={t('columnSettings')}
                  >
                    <Settings size={12} />
                  </button>
                  {isColumnSettingsOpen && (
                    <div className="absolute left-0 mt-1 w-56 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 pb-1.5 mb-1 border-b border-[var(--border)]">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{t('columnSettings')}</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto custom-scrollbar px-1">
                        {TASK_COLUMNS.map(col => {
                          const isVisible = columnKeys.includes(col.key);
                          return (
                            <div
                              key={col.key}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface-2)] transition-colors group"
                            >
                              <label className="flex items-center gap-2 flex-1 cursor-pointer text-xs font-medium text-[var(--text-primary)] select-none py-0.5">
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={() => toggleColumn(col.key)}
                                  className="accent-[var(--primary)] w-3.5 h-3.5 rounded"
                                />
                                {t(col.labelKey)}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 일괄 선택 바 ── */}
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
                  <span className="text-[var(--border)] mx-0.5">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-7"
                  >
                    <X size={11} />
                    {t('deselectAll')}
                  </button>
                </div>
              )}

              {/* ── 스켈레톤 / 빈 상태 / 테이블 ── */}
              {loading ? (
                <div className="py-2">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <div key={n} className="flex items-center gap-3 py-3.5 px-5 border-b border-[var(--border)]">
                      <div className="w-4 h-4 rounded bg-[var(--border-strong)] shrink-0 animate-pulse" />
                      <div className="w-10 h-3.5 rounded bg-[var(--border-strong)] animate-pulse" />
                      <div className="w-15 h-5 rounded-full bg-[var(--border-strong)] animate-pulse" />
                      <div className="flex-1 h-3.5 rounded bg-[var(--border-strong)] animate-pulse" />
                      <div className="w-20 h-3.5 rounded bg-[var(--border-strong)] animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="py-15 px-6 text-center">
                  <AlertCircle size={40} className="text-[var(--danger)] mx-auto mb-3" />
                  <p className="text-[var(--danger)] font-semibold">{error}</p>
                </div>
              ) : visibleTasks.length === 0 ? (
                <div className="py-20 px-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-[var(--primary-bg)] flex items-center justify-center mx-auto mb-4">
                    <Layers size={28} className="text-[var(--primary)]" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5">{t('noTasksFound')}</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    {tasks.length === 0
                      ? t('noTasksDesc')
                      : searchQuery.trim()
                        ? t('noSearchResultsFor').replace('{term}', searchQuery.trim())
                        : t('noSearchResultsFor').replace('{term}', t('filterAll'))}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={handleResetFilters}
                      className="mt-4 bg-[var(--primary-bg)] text-[var(--primary)] border border-[var(--primary)]/30 rounded-xl px-4.5 py-2 cursor-pointer text-sm font-semibold"
                    >
                      {t('resetFilters')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-container custom-scrollbar border-none rounded-none shadow-none">
                  <table className="table">
                    <thead>
                      <tr className="sticky top-0 z-10">
                        {!isArchived && (
                          <th className="w-11 min-w-[44px] max-w-[44px] text-center bg-[var(--bg-surface-2)] sticky top-0 z-10">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={toggleSelectAll}
                              className="accent-[var(--primary)]"
                            />
                          </th>
                        )}
                        {TASK_COLUMNS.filter(col => columnKeys.includes(col.key)).map(col => (
                          <th
                            key={col.key}
                            className={`select-none py-1.5 px-3 text-left font-bold text-xs uppercase tracking-wider sticky top-0 z-10 bg-[var(--bg-surface-2)] ${
                              col.key === 'title' ? '' : col.key === 'progress' ? 'w-28' : 'w-32'
                            }`}
                          >
                            {t(col.labelKey)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(({ task, depth }, idx) => {
                        const isSelected = selectedIds.has(task.id);
                        return (
                          <tr
                            key={task.id}
                            className={`group transition-colors duration-150 cursor-pointer ${
                              isSelected ? 'bg-[var(--primary)]/5' : ''
                            }`}
                            style={{ animation: `slideUpFade 0.3s ease ${idx * 0.03}s both` }}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            {!isArchived && (
                              <td className="text-center py-1.5" onClick={(e) => toggleSelectRow(task.id, e)}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectRow(task.id, {} as React.MouseEvent)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="accent-[var(--primary)]"
                                />
                              </td>
                            )}
                            {columnKeys.includes('title') && (
                              <td className="py-1.5 px-3">
                                <div className="flex items-center gap-2" style={{ paddingLeft: depth * 18 }}>
                                  {depth > 0 && <CornerDownRight size={12} className="text-[var(--text-muted)] shrink-0" />}
                                  <span className="truncate text-sm font-medium text-[var(--text-primary)]">{task.title}</span>
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
                            )}
                            {columnKeys.includes('task_type') && (
                              <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)]">{task.task_type || '-'}</td>
                            )}
                            {columnKeys.includes('task_category') && (
                              <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)]">{task.task_category || '-'}</td>
                            )}
                            {columnKeys.includes('status') && (
                              <td className="py-1.5 px-3"><TaskStatusBadge status={task.status} /></td>
                            )}
                            {columnKeys.includes('planned_dates') && (
                              <td className="py-1.5 px-3 text-xs text-[var(--text-muted)]">
                                {task.planned_start_date ?? '-'} ~ {task.planned_end_date ?? '-'}
                              </td>
                            )}
                            {columnKeys.includes('actual_dates') && (
                              <td className="py-1.5 px-3 text-xs text-[var(--text-muted)]">
                                {task.actual_start_date ?? '-'} ~ {task.actual_end_date ?? '-'}
                              </td>
                            )}
                            {columnKeys.includes('progress') && (
                              <td className="py-1.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface-2)] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                                      style={{ width: `${task.progress ?? 0}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-[var(--text-muted)] tabular-nums min-w-[2.5rem] text-right">{task.progress ?? 0}%</span>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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

/** All available column definitions for the WBS table */
const TASK_COLUMNS = [
  { key: 'title', labelKey: 'title' },
  { key: 'task_type', labelKey: 'task_type' },
  { key: 'task_category', labelKey: 'task_category' },
  { key: 'status', labelKey: 'status' },
  { key: 'planned_dates', labelKey: 'planned_dates' },
  { key: 'actual_dates', labelKey: 'actual_dates' },
  { key: 'progress', labelKey: 'progress' },
];

/** Default visible columns and order */
const DEFAULT_TASK_COLUMN_KEYS = [
  'title',
  'task_type',
  'status',
  'planned_dates',
  'progress',
];
