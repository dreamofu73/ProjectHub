import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';
import { FileUploader } from 'ui/FileUploader';
import { uploadFilesWithProgress } from 'shared/lib/upload';
import type { Project } from 'shared/types';
import { useLanguage } from 'shared/hooks/LanguageContext';

interface NewIssuePanelProps {
  project: Project;
  initialStatus?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function NewIssuePanel({ project, initialStatus, onClose, onCreated }: NewIssuePanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  
  // Parse project settings
  const taskTypes = project.task_types ? JSON.parse(project.task_types) : ['Design', 'Development', 'Testing'];
  const issueTypes = project.issue_types ? JSON.parse(project.issue_types) : ['bug', 'feature', 'task', 'support', 'enhancement'];
  const statuses = project.statuses ? JSON.parse(project.statuses) : ['new', 'in_progress', 'resolved', 'feedback', 'closed', 'rejected'];

  // Form states
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [tracker, setTracker] = useState(issueTypes[0] || 'bug');
  const [taskType, setTaskType] = useState(taskTypes[0] || 'Development');
  const [status, setStatus] = useState(() => {
    if (initialStatus) {
      const match = statuses.find((s: string) => s.toLowerCase() === initialStatus.toLowerCase());
      if (match) return match;
      return initialStatus;
    }
    return statuses[0] || 'new';
  });
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [actualStartDate, setActualStartDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attachment states
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    setIsSubmitting(true);
    let attachmentIds: string[] = [];

    try {
      // 1. Upload files first if any
      if (files.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        const result: any = await uploadFilesWithProgress(
          '/api/attachments',
          files,
          {},
          (progress) => setUploadProgress(progress),
        );
        if (result.success && result.data?.attachments) {
          attachmentIds = result.data.attachments.map((a: any) => a.id);
        }
        setIsUploading(false);
      }

      // 2. Create the issue
      const res = await api('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          subject,
          description,
          tracker,
          task_type: taskType,
          status,
          priority,
          planned_start_date: plannedStartDate || null,
          actual_start_date: actualStartDate || null,
          actual_end_date: actualEndDate || null,
          attachment_ids: attachmentIds,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        showToast(t('issueCreatedSuccess'), 'success');
        onCreated();
      } else {
        showToast(json.error || t('issueCreateError'), 'error');
      }
    } catch {
      showToast(t('serverCommError'), 'error');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* ── Title bar ── */}
      <div className="px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug">
          {t('addNewIssue')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer"
          title={t('close')}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
        <form id="new-issue-form" onSubmit={handleSubmit} className="space-y-5">
          <Input
            label={t('title')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder={t('enterIssueTitle')}
            fullWidth
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label={t('tracker')}
              value={tracker}
              onChange={(e) => setTracker(e.target.value)}
              options={issueTypes.map((t: string) => ({ value: t, label: t }))}
              fullWidth
            />
            <Select
              label={t('taskType')}
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              options={taskTypes.map((t: string) => ({ value: t, label: t }))}
              fullWidth
            />
            <Select
              label={t('status')}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={statuses.map((s: string) => ({ value: s, label: s }))}
              fullWidth
            />
            <Select
              label={t('priority')}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: 'low', label: t('low') },
                { value: 'normal', label: t('normal') },
                { value: 'high', label: t('high') },
                { value: 'urgent', label: t('urgent') },
                { value: 'immediate', label: t('immediate') },
              ]}
              fullWidth
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label={t('planned_start_date')}
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
              fullWidth
            />
            <Input
              label={t('actual_start_date')}
              type="date"
              value={actualStartDate}
              onChange={(e) => setActualStartDate(e.target.value)}
              fullWidth
            />
            <Input
              label={t('actual_end_date')}
              type="date"
              value={actualEndDate}
              onChange={(e) => setActualEndDate(e.target.value)}
              fullWidth
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--text-secondary)]">
              {t('description')}
            </label>
            <textarea
              className="form-control w-full min-h-[200px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('issueDescription')}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--text-secondary)]">
              {t('attachedFiles')}
            </label>
            <FileUploader files={files} onChange={setFiles} maxSizeMB={100} />
            {isUploading && (
              <div className="w-full bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[var(--primary)] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </form>
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50 flex justify-end gap-2 shrink-0">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button 
          type="submit" 
          form="new-issue-form"
          icon={Save} 
          disabled={isSubmitting || !subject.trim()}
        >
          {isSubmitting ? t('saving') : t('createIssue')}
        </Button>
      </div>
    </div>
  );
}
