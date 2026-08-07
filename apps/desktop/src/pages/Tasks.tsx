import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, CheckSquare, Upload, Search, Settings, X, Layers, AlertCircle, GanttChart } from 'lucide-react';
import { useToast } from 'ui/Toast';
import { useLanguage } from '../context/LanguageContext';
import { useTasks } from 'shared/hooks/useTasks';
import { useProjectMembers } from 'shared/hooks/useProjectMembers';
import { NewTaskPanel } from 'ui/NewTaskPanel';
import { TaskDetailPanel } from 'ui/TaskDetailPanel';
import { BulkTaskEditPanel } from 'ui/BulkTaskEditPanel';
import { BulkUploadModal } from 'ui/BulkUploadModal';
import { TasksGanttChart } from 'ui/TasksGanttChart';
import { NewMilestonePanel } from 'ui/NewMilestonePanel';
import { InlineEditableTable } from 'ui/InlineEditableTable';
import { getStatusLabel } from 'ui/taskStatus';
import { useMilestones } from 'shared/hooks/useMilestones';
import { flattenTaskTree } from 'shared/lib/taskTree';
import type { Task } from 'shared/types';
import type { GanttDatePatch } from 'ui/TasksGanttChart';

export default function TasksPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { tasks, loading, error, project, fetchTasks, updateTask, bulkUpdateTasks } = useTasks();
  const { members } = useProjectMembers(project?.id);
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
  const viewMode = new URLSearchParams(location.search).get('view') === 'gantt' ? 'gantt' : 'table';
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

  // 프로젝트 변경 또는 간트 뷰 전환 시 선택 상태 초기화
  useEffect(() => {
    setSelectedIds(new Set());
    setIsBulkEditOpen(false);
  }, [viewMode, project?.id]);

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
    }
  }, [updateTask, showToast, t]);

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

  const toggleSelectRow = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const viewHeaderInfo = useMemo(() => {
    switch (viewMode) {
      case 'gantt':
        return { Icon: GanttChart, title: t('ganttChart') };
      default:
        return { Icon: CheckSquare, title: t('wbsList') };
    }
  }, [viewMode, t]);

  const HeaderIcon = viewHeaderInfo.Icon;

  if (!project) return null;

  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
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
            {viewMode === 'gantt' ? (
            <TasksGanttChart
              tasks={tasks}
              milestones={milestones}
              readOnly={isArchived}
              onTaskClick={(task) => setSelectedTaskId(task.id)}
              onDateChange={handleGanttDateChange}
              onAddSubtask={openSubtaskPanel}
              onAddMilestone={() => setIsMilestoneOpen(true)}
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
                    <option key={s} value={s} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{getStatusLabel(s, t)}</option>
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

                {/* 일괄 선택 */}
                {!isArchived && selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-px h-5 bg-[var(--border)] mx-0.5" aria-hidden="true" />
                    <span className="text-xs font-bold text-[var(--primary)] whitespace-nowrap">
                      {t('bulkSelectCount').replace('{count}', String(selectedIds.size))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBulkEditOpen(true)}
                      className="h-8 px-3 bg-[var(--primary)] hover:opacity-90 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer border-none"
                    >
                      {t('bulkEdit')}
                    </button>
                    <span className="text-[var(--border)] mx-0.5">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="h-8 px-2.5 flex items-center gap-1 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer font-medium"
                    >
                      <X size={11} />
                      {t('deselectAll')}
                    </button>
                  </div>
                )}
              </div>

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
                <InlineEditableTable
                  rows={visibleRows}
                  columnKeys={columnKeys}
                  project={project}
                  members={members}
                  isArchived={isArchived}
                  selectedIds={selectedIds}
                  onToggleSelect={(id, e) => toggleSelectRow(id, e)}
                  allSelected={allSelected}
                  onToggleSelectAll={toggleSelectAll}
                  onSave={async (taskId, patch) => {
                    const ok = await updateTask(taskId, patch);
                    if (!ok) showToast(t('inlineEditSaveError'), 'error');
                    return ok;
                  }}
                  onTitleClick={(taskId) => setSelectedTaskId(taskId)}
                  onAddSubtask={openSubtaskPanel}
                />
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
  { key: 'assignee', labelKey: 'assignee' },
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
