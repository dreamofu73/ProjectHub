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
      <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{isEditMode ? t('editTask') : task.title}</h2>
        <div className="flex gap-2">
          {!isEditMode && !isArchived && (
            <>
              <Button variant="secondary" icon={Edit3} onClick={enterEditMode}>{t('edit')}</Button>
              <Button variant="danger" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>{t('delete')}</Button>
            </>
          )}
          <Button variant="secondary" icon={X} onClick={onClose}>{t('close')}</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
              <label className="block text-sm font-semibold text-[var(--text-secondary)]">{t('description')}</label>
              <textarea
                className="form-control w-full min-h-[100px] resize-y"
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
            <p><strong>{t('task_type')}:</strong> {task.task_type}</p>
            <p><strong>{t('task_category')}:</strong> {task.task_category}</p>
            <p><strong>{t('status')}:</strong> <TaskStatusBadge status={task.status} /></p>
            <p><strong>{t('assignee')}:</strong> {assigneeDisplay || t('unassigned')}</p>
            <p><strong>{t('progress')}:</strong> {task.progress}%</p>
            <p><strong>{t('planned_start_date')}:</strong> {task.planned_start_date || '-'}</p>
            <p><strong>{t('planned_end_date')}:</strong> {task.planned_end_date || '-'}</p>
            <p><strong>{t('actual_start_date')}:</strong> {task.actual_start_date || '-'}</p>
            <p><strong>{t('actual_end_date')}:</strong> {task.actual_end_date || '-'}</p>
            <p><strong>{t('description')}:</strong> {task.description || '-'}</p>
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
