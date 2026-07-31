import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from './Button';
import { Input, Select } from './Input';
import { useToast } from './Toast';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { useProjectMembers, type Member } from 'shared/hooks/useProjectMembers';
import type { Project } from 'shared/types';

interface BulkTaskEditPanelProps {
  project: Project;
  taskIds: string[];
  onSave: (updates: Record<string, unknown>) => Promise<boolean>;
  onClose: (success?: boolean) => void;
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

export function BulkTaskEditPanel({ project, taskIds, onSave, onClose }: BulkTaskEditPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { members } = useProjectMembers(project.id);

  const taskStatuses = safeJsonParse<string[]>(project.task_statuses, ['New', 'In Progress', 'Done']);

  // 빈 문자열 = "변경하지 않음"
  const [assignee, setAssignee] = useState('');
  const [progress, setProgress] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assigneeOptions = [
    { value: '', label: t('bulkUnchanged') },
    { value: 'unassigned', label: t('unassigned') },
    ...members.map((m) => ({ value: m.user_id, label: memberName(m) })),
  ];

  const statusOptions = [
    { value: '', label: t('bulkUnchanged') },
    ...taskStatuses.map((s: string) => ({ value: s, label: s })),
  ];

  const hasChanges = assignee !== '' || progress.trim() !== '' || plannedStartDate !== '' || plannedEndDate !== '' || status !== '';

  const handleSave = async () => {
    const updates: Record<string, unknown> = {};

    if (assignee !== '') {
      // 'unassigned' → null(미배정), 그 외는 user_id 문자열
      updates.assignee_id = assignee === 'unassigned' ? null : assignee;
    }
    if (progress.trim() !== '') {
      const progressNum = Number(progress);
      if (!Number.isNaN(progressNum)) {
        updates.progress = Math.max(0, Math.min(100, progressNum));
      }
    }
    if (plannedStartDate !== '') updates.planned_start_date = plannedStartDate;
    if (plannedEndDate !== '') updates.planned_end_date = plannedEndDate;
    if (status !== '') updates.status = status;

    if (Object.keys(updates).length === 0) return;

    setIsSubmitting(true);
    try {
      const ok = await onSave(updates);
      if (ok) {
        showToast(t('bulkEditSuccess'), 'success');
        onClose(true);
      } else {
        showToast(t('bulkEditError'), 'error');
      }
    } catch {
      showToast(t('bulkEditError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug">
          {t('bulkEdit')}
          <span className="ml-2 text-sm font-bold text-[var(--primary)]">
            {t('bulkSelectCount').replace('{count}', String(taskIds.length))}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => onClose()}
          className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">
        <Select label={t('assignee')} value={assignee} onChange={(e) => setAssignee(e.target.value)} options={assigneeOptions} fullWidth />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t('planned_start_date')} type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} fullWidth />
          <Input label={t('planned_end_date')} type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} fullWidth />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t('progress')} type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} fullWidth />
          <Select label={t('status')} value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} fullWidth />
        </div>
      </div>

      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50 flex justify-end gap-2 shrink-0">
        <Button type="button" variant="secondary" onClick={() => onClose()}>{t('cancel')}</Button>
        <Button icon={Save} disabled={isSubmitting || !hasChanges} onClick={handleSave}>{isSubmitting ? t('saving') : t('save')}</Button>
      </div>
    </div>
  );
}
