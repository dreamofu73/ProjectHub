import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from './Button';
import { Input, Select } from './Input';
import { useToast } from './Toast';
import { useLanguage } from 'shared/hooks/LanguageContext';
import type { Project } from 'shared/types';

interface BulkIssueEditPanelProps {
  project: Project | null;
  issueIds: string[];
  users: Array<{ id: string; firstname: string; lastname: string }>;
  projectMembers: Array<{ project_id: string; user_id: string }>;
  issues: Array<{ id: string; project_id: string }>;
  statusLabels: Record<string, string>;
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

function memberName(m: { firstname: string; lastname: string }): string {
  return [m.firstname, m.lastname].filter(Boolean).join(' ').trim();
}

export function BulkIssueEditPanel({
  project,
  issueIds,
  users,
  projectMembers,
  issues,
  statusLabels,
  onSave,
  onClose,
}: BulkIssueEditPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'basic' | 'schedule'>('basic');

  // Form State (빈 문자열 = t('bulkUnchanged'))
  const [assignee, setAssignee] = useState('');
  const [tracker, setTracker] = useState('');
  const [taskType, setTaskType] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [actualStartDate, setActualStartDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Common members: users who belong to EVERY project the selected issues span.
  const selectedIssueProjects = issues
    .filter((i) => issueIds.includes(String(i.id)))
    .map((i) => i.project_id);
  const uniqueProjectIds = Array.from(new Set(selectedIssueProjects));
  const commonMembers =
    uniqueProjectIds.length === 0
      ? []
      : users.filter((u) =>
          uniqueProjectIds.every((pid) =>
            projectMembers.some((pm) => pm.project_id === pid && pm.user_id === u.id)
          )
        );

  const issueTypes = safeJsonParse<string[]>(project?.issue_types, ['bug', 'feature', 'task', 'support', 'enhancement']);
  const taskTypes = safeJsonParse<string[]>(project?.task_types, ['Design', 'Development', 'Testing']);

  const assigneeOptions = [
    { value: '', label: t('bulkUnchanged') },
    { value: 'unassigned', label: t('unassigned') },
    ...commonMembers
      .filter((u) => u.id)
      .map((u) => ({ value: u.id, label: memberName(u) })),
  ];

  const trackerOptions = [
    { value: '', label: t('bulkUnchanged') },
    ...issueTypes.map((value) => {
      const localized = t(value);
      return { value, label: localized === value ? value : localized };
    }),
  ];

  const taskTypeOptions = [
    { value: '', label: t('bulkUnchanged') },
    ...taskTypes.map((value) => ({ value, label: value })),
  ];

  const statusOptions = [
    { value: '', label: t('bulkUnchanged') },
    ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
  ];

  const priorityOptions = [
    { value: '', label: t('bulkUnchanged') },
    { value: 'low', label: t('low') },
    { value: 'normal', label: t('normal') },
    { value: 'high', label: t('high') },
    { value: 'urgent', label: t('urgent') },
    { value: 'immediate', label: t('immediate') },
  ];

  const hasChanges =
    assignee !== '' || tracker !== '' || taskType !== '' || status !== '' || priority !== '' ||
    plannedStartDate !== '' || dueDate !== '' || actualStartDate !== '' || actualEndDate !== '';

  const handleSave = async () => {
    const updates: Record<string, unknown> = {};

    if (assignee !== '') updates.assigned_to_id = assignee === 'unassigned' ? null : assignee;
    if (tracker !== '') updates.tracker = tracker;
    if (taskType !== '') updates.task_type = taskType;
    if (status !== '') updates.status = status;
    if (priority !== '') updates.priority = priority;

    if (plannedStartDate !== '') updates.planned_start_date = plannedStartDate === 'clear' ? null : plannedStartDate;
    if (dueDate !== '') updates.due_date = dueDate === 'clear' ? null : dueDate;
    if (actualStartDate !== '') updates.actual_start_date = actualStartDate === 'clear' ? null : actualStartDate;
    if (actualEndDate !== '') updates.actual_end_date = actualEndDate === 'clear' ? null : actualEndDate;

    if (Object.keys(updates).length === 0) return;

    setIsSubmitting(true);
    try {
      const ok = await onSave(updates);
      if (ok) {
        showToast(t('bulkIssueEditSuccess'), 'success');
        onClose(true);
      } else {
        showToast(t('bulkIssueEditError'), 'error');
      }
    } catch {
      showToast(t('bulkIssueEditError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug">
            {t('bulkEdit')}
            <span className="ml-2 text-sm font-bold text-[var(--primary)]">
              {t('bulkSelectCount').replace('{count}', String(issueIds.length))}
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

        <div className="flex items-center gap-1 border-b border-[var(--border)] w-full">
          {(['basic', 'schedule'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'basic' ? t('basic_info') : t('schedule')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 custom-scrollbar">
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <Select label={t('assignee')} value={assignee} onChange={(e) => setAssignee(e.target.value)} options={assigneeOptions} fullWidth />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('tracker')} value={tracker} onChange={(e) => setTracker(e.target.value)} options={trackerOptions} fullWidth />
              <Select label={t('taskType')} value={taskType} onChange={(e) => setTaskType(e.target.value)} options={taskTypeOptions} fullWidth />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('status')} value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} fullWidth />
              <Select label={t('priority')} value={priority} onChange={(e) => setPriority(e.target.value)} options={priorityOptions} fullWidth />
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Planned</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('planned_start_date')} type="date" value={plannedStartDate === 'clear' ? '' : plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value || 'clear')} fullWidth />
                <Input label={t('due_date')} type="date" value={dueDate === 'clear' ? '' : dueDate} onChange={(e) => setDueDate(e.target.value || 'clear')} fullWidth />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Actual</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('actual_start_date')} type="date" value={actualStartDate === 'clear' ? '' : actualStartDate} onChange={(e) => setActualStartDate(e.target.value || 'clear')} fullWidth />
                <Input label={t('actual_end_date')} type="date" value={actualEndDate === 'clear' ? '' : actualEndDate} onChange={(e) => setActualEndDate(e.target.value || 'clear')} fullWidth />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50 flex justify-end gap-2 shrink-0">
        <Button type="button" variant="secondary" onClick={() => onClose()}>{t('cancel')}</Button>
        <Button icon={Save} disabled={isSubmitting || !hasChanges} onClick={handleSave}>{isSubmitting ? t('saving') : t('save')}</Button>
      </div>
    </div>
  );
}