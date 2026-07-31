import { useState } from 'react';
import { Save, X, Trash2, Flag } from 'lucide-react';

import { useLanguage } from 'shared/hooks/LanguageContext';

import { Button } from './Button';
import { Input, Select } from './Input';
import { useToast } from './Toast';

import type { Milestone } from 'shared/types';
import type { MilestoneInput } from 'shared/hooks/useMilestones';

interface NewMilestonePanelProps {
  milestones: Milestone[];
  onCreate: (input: MilestoneInput) => Promise<boolean>;
  onDelete: (milestoneId: string) => Promise<boolean>;
  onClose: () => void;
}

export function NewMilestonePanel({ milestones, onCreate, onDelete, onClose }: NewMilestonePanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('open');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = name.trim() !== '' && dueDate !== '' && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const ok = await onCreate({ name: name.trim(), due_date: dueDate, description, status });
      if (ok) {
        showToast(t('milestoneCreatedSuccess'), 'success');
        setName('');
        setDueDate('');
        setDescription('');
      } else {
        showToast(t('milestoneCreatedError'), 'error');
      }
    } catch {
      showToast(t('serverConnectionError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (milestone: Milestone) => {
    if (!window.confirm(t('milestoneDeleteConfirm'))) return;
    const ok = await onDelete(milestone.id);
    showToast(ok ? t('milestoneDeletedSuccess') : t('milestoneDeletedError'), ok ? 'success' : 'error');
  };

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug flex items-center gap-2">
          <Flag size={16} className="text-[var(--primary)]" />
          {t('addMilestone')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-6">
        <form id="new-milestone-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('milestoneName')} value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('due_date')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required fullWidth />
            <Select
              label={t('status')}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'open', label: t('milestoneStatusOpen') },
                { value: 'closed', label: t('milestoneStatusClosed') },
              ]}
              fullWidth
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--text-secondary)]">{t('description')}</label>
            <textarea
              className="form-control w-full min-h-[80px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-secondary)]">{t('milestones')}</h3>
          {milestones.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-3">{t('noMilestones')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
              {milestones.map((milestone) => (
                <li key={milestone.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-surface)]">
                  <span className="w-2 h-2 rotate-45 bg-[var(--primary)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{milestone.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {milestone.due_date || '-'} · {milestone.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(milestone)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] cursor-pointer"
                    title={t('delete')}
                    aria-label={t('delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50 flex justify-end gap-2 shrink-0">
        <Button type="button" variant="secondary" onClick={onClose}>{t('close')}</Button>
        <Button type="submit" form="new-milestone-form" icon={Save} disabled={!canSubmit}>
          {isSubmitting ? t('saving') : t('addMilestone')}
        </Button>
      </div>
    </div>
  );
}

export default NewMilestonePanel;
