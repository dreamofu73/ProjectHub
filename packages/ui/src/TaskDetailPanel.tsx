import { useState, useEffect, useCallback } from 'react';
import { X, Edit3, Save, Trash2 } from 'lucide-react';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { useToast } from './Toast';
import { Button } from './Button';
import { Input, Select } from './Input';
import { ConfirmDialog } from './ConfirmDialog';
import { api } from 'shared/lib/api';
import { useProjectMembers, type Member } from 'shared/hooks/useProjectMembers';
import { TaskStatusBadge } from './TaskStatusBadge';
import type { Task, Project } from 'shared/types';

interface TaskDetailPanelProps {
  taskId: string | null;
  project: Project | null;
  isArchived?: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

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

export function TaskDetailPanel({ taskId, project, isArchived, onClose, onUpdated }: TaskDetailPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { members } = useProjectMembers(project?.id);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Task>>({});
  const [titleError, setTitleError] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const taskTypes = safeJsonParse<string[]>(project?.task_types, ['Design', 'Development', 'Testing']);
  const taskCategories = safeJsonParse<string[]>(project?.task_categories, ['General', 'Feature', 'Bug']);
  const taskStatuses = safeJsonParse<string[]>(project?.task_statuses, ['New', 'In Progress', 'Done']);

  const fetchData = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await api(`/api/tasks/${taskId}`);
      const json = await res.json();
      if (json.success) {
        setTask(json.data);
        setEditData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enterEditMode = () => {
    if (!task) return;
    setEditData(task);
    setTitleError(false);
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    if (!task) return;
    setEditData(task);
    setTitleError(false);
    setIsEditMode(false);
  };

  const handleUpdate = async () => {
    if (!taskId) return;
    if (!editData.title?.trim()) {
      setTitleError(true);
      return;
    }
    try {
      const payload = {
        ...editData,
        title: editData.title.trim(),
        progress: Math.max(0, Math.min(100, Number(editData.progress ?? 0))),
        assignee_id: editData.assignee_id ? String(editData.assignee_id) : null,
      };
      const res = await api(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(t('taskUpdatedSuccess'), 'success');
        setTitleError(false);
        setIsEditMode(false);
        fetchData();
        onUpdated?.();
      } else {
        showToast(t('taskUpdatedError'), 'error');
      }
    } catch {
      showToast(t('serverConnectionError'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    setDeleteConfirmOpen(false);
    try {
      const res = await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(t('taskDeletedSuccess'), 'success');
        onClose();
        onUpdated?.();
      } else {
        showToast(t('taskDeletedError'), 'error');
      }
    } catch {
      showToast(t('taskDeletedError'), 'error');
    }
  };

  if (loading) return <div>{t('loading')}...</div>;
  if (!task) return <div>{t('taskNotFound')}</div>;

  const assigneeOptions = [
    { value: '', label: t('unassigned') },
    ...members.map((m) => ({ value: m.user_id, label: memberName(m) })),
  ];

  const editAssigneeId = editData.assignee_id ? String(editData.assignee_id) : '';

  const rawAssigneeName = (task as Task & { assignee_name?: string | null }).assignee_name;
  const matchedMember = members.find((m) => String(m.user_id) === String(task.assignee_id));
  const assigneeDisplay = rawAssigneeName || (matchedMember ? memberName(matchedMember) : '');

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          {isEditMode ? t('editTask') : task.title}
        </h2>
        <div className="flex gap-1.5">
          {!isEditMode && !isArchived && (
            <>
              <Button variant="secondary" icon={Edit3} onClick={enterEditMode} size="sm">{t('edit')}</Button>
              <Button variant="danger" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)} size="sm">{t('delete')}</Button>
            </>
          )}
          <Button variant="secondary" icon={X} onClick={onClose} size="sm">{t('close')}</Button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {isEditMode ? (
          <>
            <Input
              label={t('title')}
              value={editData.title || ''}
              error={titleError ? t('enterTitle') : undefined}
              onChange={(e) => {
                setTitleError(false);
                setEditData({ ...editData, title: e.target.value });
              }}
              fullWidth
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label={t('task_type')}
                value={editData.task_type || taskTypes[0] || ''}
                onChange={(e) => setEditData({ ...editData, task_type: e.target.value })}
                options={taskTypes.map((t: string) => ({ value: t, label: t }))}
                fullWidth
              />
              <Select
                label={t('task_category')}
                value={editData.task_category || taskCategories[0] || ''}
                onChange={(e) => setEditData({ ...editData, task_category: e.target.value })}
                options={taskCategories.map((t: string) => ({ value: t, label: t }))}
                fullWidth
              />
              <Select
                label={t('status')}
                value={editData.status || taskStatuses[0] || ''}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                options={taskStatuses.map((s: string) => ({ value: s, label: s }))}
                fullWidth
              />
            </div>
            <Select
              label={t('assignee')}
              value={editAssigneeId}
              onChange={(e) => setEditData({ ...editData, assignee_id: e.target.value || null })}
              options={assigneeOptions}
              fullWidth
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('planned_start_date')} type="date" value={editData.planned_start_date || ''} onChange={(e) => setEditData({ ...editData, planned_start_date: e.target.value || null })} fullWidth />
              <Input label={t('planned_end_date')} type="date" value={editData.planned_end_date || ''} onChange={(e) => setEditData({ ...editData, planned_end_date: e.target.value || null })} fullWidth />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('actual_start_date')} type="date" value={editData.actual_start_date || ''} onChange={(e) => setEditData({ ...editData, actual_start_date: e.target.value || null })} fullWidth />
              <Input label={t('actual_end_date')} type="date" value={editData.actual_end_date || ''} onChange={(e) => setEditData({ ...editData, actual_end_date: e.target.value || null })} fullWidth />
            </div>
            <Input label={t('progress')} type="number" min="0" max="100" value={editData.progress ?? 0} onChange={(e) => setEditData({ ...editData, progress: Math.max(0, Math.min(100, Number(e.target.value))) })} fullWidth />
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--text-secondary)]">{t('description')}</label>
              <textarea
                className="w-full min-h-[100px] px-3.5 py-2 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] resize-y"
                value={editData.description || ''}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={cancelEdit}>{t('cancel')}</Button>
              <Button icon={Save} onClick={handleUpdate}>{t('save')}</Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('task_type')}:</span>
                <span className="text-[var(--text-primary)]">{task.task_type}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('task_category')}:</span>
                <span className="text-[var(--text-primary)]">{task.task_category}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('status')}:</span>
                <TaskStatusBadge status={task.status} />
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('assignee')}:</span>
                <span className="text-[var(--text-primary)]">{assigneeDisplay || t('unassigned')}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('progress')}:</span>
                <span className="text-[var(--text-primary)]">{task.progress}%</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('planned_start_date')}:</span>
                <span className="text-[var(--text-primary)]">{task.planned_start_date || '-'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('planned_end_date')}:</span>
                <span className="text-[var(--text-primary)]">{task.planned_end_date || '-'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('actual_start_date')}:</span>
                <span className="text-[var(--text-primary)]">{task.actual_start_date || '-'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--text-secondary)] w-32">{t('actual_end_date')}:</span>
                <span className="text-[var(--text-primary)]">{task.actual_end_date || '-'}</span>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
                <span className="font-bold text-[var(--text-secondary)]">{t('description')}</span>
                <div className="text-[var(--text-primary)] whitespace-pre-wrap">{task.description || '-'}</div>
              </div>

              {/* ── Task Dependencies Section ── */}
              <TaskDependenciesSection
                task={task}
                project={project}
                isArchived={isArchived}
                onUpdated={fetchData}
              />
            </div>
          </>
        )}
      </div>
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('delete')}
        message={t('taskDeleteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

import type { TaskDependency } from 'shared/types';
import { Link2, Plus as PlusIcon, Trash2 as TrashIcon } from 'lucide-react';

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

function TaskDependenciesSection({
  task,
  project,
  isArchived,
  onUpdated
}: {
  task: Task;
  project: Project | null;
  isArchived?: boolean;
  onUpdated?: () => void;
}) {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPredId, setSelectedPredId] = useState('');
  const [depType, setDepType] = useState<'FS'|'SS'|'FF'|'SF'>('FS');

  const fetchDeps = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [depRes, taskRes] = await Promise.all([
        api(`/api/projects/${project.id}/task-dependencies`),
        api(`/api/tasks?project=${project.id}`)
      ]);
      const depJson = await depRes.json();
      const taskJson = await taskRes.json();

      if (depJson.success) setDependencies(depJson.data || []);
      if (taskJson.success) setAllTasks(taskJson.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    fetchDeps();
  }, [fetchDeps]);

  // Predecessors (tasks that this task depends on)
  const predecessors = dependencies.filter(d => String(d.successor_id) === String(task.id));
  // Successors (tasks that depend on this task)
  const successors = dependencies.filter(d => String(d.predecessor_id) === String(task.id));

  // Available tasks to add as predecessor (excluding self and already added predecessors)
  const existingPredIds = new Set(predecessors.map(d => String(d.predecessor_id)));
  const availablePredTasks = allTasks.filter(t => String(t.id) !== String(task.id) && !existingPredIds.has(String(t.id)));

  const handleAddDep = async () => {
    if (!project?.id || !selectedPredId) return;
    try {
      const res = await api('/api/tasks/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          predecessor_id: selectedPredId,
          successor_id: task.id,
          dependency_type: depType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        // Auto-adjust planned dates of successor task
        const predTask = allTasks.find(t => String(t.id) === String(selectedPredId));
        if (predTask) {
          const newDates = computeAdjustedDates(predTask, task, depType);
          if (newDates) {
            await api(`/api/tasks/${task.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newDates),
            });
          }
        }

        showToast(t('depAdded'), 'success');
        setSelectedPredId('');
        fetchDeps();
        onUpdated?.();
      } else {
        showToast(json.error || t('depAddFailed'), 'error');
      }
    } catch {
      showToast(t('serverConnectionError'), 'error');
    }
  };

  const handleUpdateDepType = async (dep: TaskDependency, newType: 'FS'|'SS'|'FF'|'SF') => {
    if (!project?.id || dep.dependency_type === newType) return;
    try {
      await api(`/api/tasks/dependencies/${dep.id}`, { method: 'DELETE' });
      const res = await api('/api/tasks/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          predecessor_id: dep.predecessor_id,
          successor_id: dep.successor_id,
          dependency_type: newType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const predTask = allTasks.find(t => String(t.id) === String(dep.predecessor_id));
        if (predTask) {
          const newDates = computeAdjustedDates(predTask, task, newType);
          if (newDates) {
            await api(`/api/tasks/${task.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newDates),
            });
          }
        }
        showToast(t('depAutoSyncToast'), 'success');
        fetchDeps();
        onUpdated?.();
      } else {
        showToast(json.error || t('depUpdateFailed'), 'error');
      }
    } catch {
      showToast(t('depUpdateError'), 'error');
    }
  };

  const handleDeleteDep = async (depId: string) => {
    try {
      const res = await api(`/api/tasks/dependencies/${depId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(t('depRemoved'), 'success');
        fetchDeps();
        onUpdated?.();
      }
    } catch {
      showToast(t('deleteError'), 'error');
    }
  };

  return (
    <div className="pt-3 border-t border-[var(--border)] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
          <Link2 size={14} className="text-[var(--primary)]" />
          <span>{t('taskDependencies')}</span>
        </h4>
        <span className="text-[11px] text-[var(--text-muted)]">
          {t('predSuccCount')
            .replace('{pred}', String(predecessors.length))
            .replace('{succ}', String(successors.length))}
        </span>
      </div>

      {loading ? (
        <div className="text-xs text-[var(--text-muted)]">{t('depLoading')}</div>
      ) : (
        <div className="space-y-2.5">
          {/* Predecessors List */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] block">{t('predecessorsLabel')}</span>
            {predecessors.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] italic pl-2">{t('noPredecessors')}</div>
            ) : (
              predecessors.map(dep => {
                const predTask = allTasks.find(t => String(t.id) === String(dep.predecessor_id));
                return (
                  <div key={dep.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border)] text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <select
                        value={dep.dependency_type}
                        onChange={(e) => handleUpdateDepType(dep, e.target.value as 'FS'|'SS'|'FF'|'SF')}
                        className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        disabled={isArchived}
                        title={t('depTypeChange')}
                      >
                        <option value="FS">FS (Finish to Start)</option>
                        <option value="SS">SS (Start to Start)</option>
                        <option value="FF">FF (Finish to Finish)</option>
                        <option value="SF">SF (Start to Finish)</option>
                      </select>
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        #{dep.predecessor_id} {predTask?.title || 'Unknown Task'}
                      </span>
                    </div>

                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDep(dep.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded transition-colors"
                        title={t('dependencyDelete')}
                      >
                        <TrashIcon size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Successors List */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] block">{t('successorsLabel')}</span>
            {successors.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] italic pl-2">{t('noSuccessors')}</div>
            ) : (
              successors.map(dep => {
                const succTask = allTasks.find(t => String(t.id) === String(dep.successor_id));
                return (
                  <div key={dep.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border)] text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {dep.dependency_type}
                      </span>
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        #{dep.successor_id} {succTask?.title || 'Unknown Task'}
                      </span>
                    </div>

                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDep(dep.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded transition-colors"
                        title={t('dependencyDelete')}
                      >
                        <TrashIcon size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Predecessor Form */}
          {!isArchived && (
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <span className="text-[11px] font-bold text-[var(--text-secondary)] block">+ {t('addPredecessorLink')}</span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPredId}
                  onChange={(e) => setSelectedPredId(e.target.value)}
                  className="flex-1 h-8 px-2 rounded-lg text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--primary)] outline-none"
                >
                  <option value="">{t('selectPredecessor')}</option>
                  {availablePredTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      #{t.id} {t.title}
                    </option>
                  ))}
                </select>

                <select
                  value={depType}
                  onChange={(e) => setDepType(e.target.value as any)}
                  className="w-32 h-8 px-2 rounded-lg text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--primary)] outline-none"
                >
                  <option value="FS">{t('depTypeFsShort')}</option>
                  <option value="SS">{t('depTypeSsShort')}</option>
                  <option value="FF">{t('depTypeFfShort')}</option>
                  <option value="SF">{t('depTypeSfShort')}</option>
                </select>

                <button
                  type="button"
                  disabled={!selectedPredId}
                  onClick={handleAddDep}
                  className="h-8 px-3 bg-[var(--primary)] hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1 shrink-0"
                >
                  <PlusIcon size={13} />
                  <span>{t('linkAction')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
