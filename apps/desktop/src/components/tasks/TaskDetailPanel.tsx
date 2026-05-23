import { useState, useEffect, useCallback } from 'react';
import { X, Edit3, Save } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { Button } from 'ui/Button';
import { Input } from 'ui/Input';
import { api } from 'shared/lib/api';
import type { Task } from 'shared/types';

interface TaskDetailPanelProps {
  taskId: string | null;
  isArchived?: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function TaskDetailPanel({ taskId, isArchived, onClose, onUpdated }: TaskDetailPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Task>>({});

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

  const handleUpdate = async () => {
    if (!taskId) return;
    try {
      const res = await api(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        showToast(t('taskUpdatedSuccess'), 'success');
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

  if (loading) return <div>{t('loading')}...</div>;
  if (!task) return <div>{t('taskNotFound')}</div>;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]">
      <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{isEditMode ? t('editTask') : task.title}</h2>
        <div className="flex gap-2">
          {!isEditMode && !isArchived && <Button variant="secondary" icon={Edit3} onClick={() => setIsEditMode(true)}>{t('edit')}</Button>}
          <Button variant="secondary" icon={X} onClick={onClose}>{t('close')}</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isEditMode ? (
          <>
            <Input label={t('title')} value={editData.title || ''} onChange={(e) => setEditData({ ...editData, title: e.target.value })} fullWidth />
            <Input label={t('progress')} type="number" value={editData.progress || 0} onChange={(e) => setEditData({ ...editData, progress: Number(e.target.value) })} fullWidth />
            <Button icon={Save} onClick={handleUpdate}>{t('save')}</Button>
          </>
        ) : (
          <>
            <p><strong>{t('task_type')}:</strong> {task.task_type}</p>
            <p><strong>{t('task_category')}:</strong> {task.task_category}</p>
            <p><strong>{t('status')}:</strong> {task.status}</p>
            <p><strong>{t('progress')}:</strong> {task.progress}%</p>
            <p><strong>{t('description')}:</strong> {task.description}</p>
          </>
        )}
      </div>
    </div>
  );
}
