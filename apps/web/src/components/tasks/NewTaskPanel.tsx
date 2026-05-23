import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';
import { useLanguage } from '../../context/LanguageContext';
import type { Project } from 'shared/types';

interface NewTaskPanelProps {
  project: Project;
  onClose: () => void;
  onCreated: () => void;
}

export function NewTaskPanel({ project, onClose, onCreated }: NewTaskPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  
  const taskTypes = project.task_types ? JSON.parse(project.task_types) : ['Design', 'Development', 'Testing'];
  const taskCategories = project.task_categories ? JSON.parse(project.task_categories) : ['General', 'Feature', 'Bug'];
  const taskStatuses = project.task_statuses ? JSON.parse(project.task_statuses) : ['New', 'In Progress', 'Done'];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState(taskTypes[0] || 'Development');
  const [taskCategory, setTaskCategory] = useState(taskCategories[0] || 'General');
  const [status, setStatus] = useState(taskStatuses[0] || 'New');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    try {
      const res = await api('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          title,
          description,
          task_type: taskType,
          task_category: taskCategory,
          status,
          planned_start_date: plannedStartDate || null,
          planned_end_date: plannedEndDate || null,
          progress,
        }),
      });

      if (res.ok) {
        showToast(t('taskCreatedSuccess'), 'success');
        onCreated();
      } else {
        showToast(t('taskCreatedError'), 'error');
      }
    } catch {
      showToast(t('serverConnectionError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug">
          {t('addNewTask')}
        </h2>
        <button type="button" onClick={onClose} className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
        <form id="new-task-form" onSubmit={handleSubmit} className="space-y-5">
          <Input label={t('title')} value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label={t('task_type')} value={taskType} onChange={(e) => setTaskType(e.target.value)} options={taskTypes.map((t: string) => ({ value: t, label: t }))} fullWidth />
            <Select label={t('task_category')} value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)} options={taskCategories.map((t: string) => ({ value: t, label: t }))} fullWidth />
            <Select label={t('status')} value={status} onChange={(e) => setStatus(e.target.value)} options={taskStatuses.map((s: string) => ({ value: s, label: s }))} fullWidth />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('planned_start_date')} type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} fullWidth />
            <Input label={t('planned_end_date')} type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} fullWidth />
          </div>
          <Input label={t('progress')} type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} fullWidth />
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--text-secondary)]">{t('description')}</label>
            <textarea className="form-control w-full min-h-[100px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </form>
      </div>

      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50 flex justify-end gap-2 shrink-0">
        <Button type="button" variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button type="submit" form="new-task-form" icon={Save} disabled={isSubmitting || !title.trim()}>{isSubmitting ? t('saving') : t('createTask')}</Button>
      </div>
    </div>
  );
}
