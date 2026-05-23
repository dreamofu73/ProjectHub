import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';
import { FileUploader } from 'ui/FileUploader';
import { uploadFilesWithProgress } from 'shared/lib/upload';
import type { Project } from 'shared/types';

interface NewIssuePanelProps {
  project: Project;
  onClose: () => void;
  onCreated: () => void;
}

export function NewIssuePanel({ project, onClose, onCreated }: NewIssuePanelProps) {
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
  const [status, setStatus] = useState(statuses[0] || 'new');
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
        showToast('이슈가 성공적으로 생성되었습니다.', 'success');
        onCreated();
      } else {
        showToast(json.error || '이슈 생성 중 오류가 발생했습니다.', 'error');
      }
    } catch {
      showToast('서버 통신 오류가 발생했습니다.', 'error');
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
          새 이슈 추가
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer"
          title="닫기"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
        <form id="new-issue-form" onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="제목"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="이슈 제목을 입력하세요"
            fullWidth
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="유형"
              value={tracker}
              onChange={(e) => setTracker(e.target.value)}
              options={issueTypes.map((t: string) => ({ value: t, label: t }))}
              fullWidth
            />
            <Select
              label="작업 유형"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              options={taskTypes.map((t: string) => ({ value: t, label: t }))}
              fullWidth
            />
            <Select
              label="상태"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={statuses.map((s: string) => ({ value: s, label: s }))}
              fullWidth
            />
            <Select
              label="우선순위"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: 'low', label: '낮음' },
                { value: 'normal', label: '보통' },
                { value: 'high', label: '높음' },
                { value: 'urgent', label: '긴급' },
                { value: 'immediate', label: '즉시' },
              ]}
              fullWidth
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="계획 시작일"
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
              fullWidth
            />
            <Input
              label="실제 시작일"
              type="date"
              value={actualStartDate}
              onChange={(e) => setActualStartDate(e.target.value)}
              fullWidth
            />
            <Input
              label="실제 종료일"
              type="date"
              value={actualEndDate}
              onChange={(e) => setActualEndDate(e.target.value)}
              fullWidth
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--text-secondary)]">
              설명
            </label>
            <textarea
              className="form-control w-full min-h-[200px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이슈에 대한 상세 설명을 입력하세요 (Markdown 지원)"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--text-secondary)]">
              첨부 파일
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
          취소
        </Button>
        <Button 
          type="submit" 
          form="new-issue-form"
          icon={Save} 
          disabled={isSubmitting || !subject.trim()}
        >
          {isSubmitting ? '저장 중...' : '이슈 생성'}
        </Button>
      </div>
    </div>
  );
}
