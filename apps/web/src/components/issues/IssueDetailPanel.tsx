import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MessageSquare, Clock, Trash2, Edit3 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { Badge } from 'ui/Badge';
import { api } from 'shared/lib/api';
import { IssueComments } from './IssueComments';

import type { Issue, Comment, Member } from 'shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface IssueDetailData {
  issue: Issue;
  comments: Comment[];
}

interface IssueDetailPanelProps {
  issueId: string | null;
  projectId?: string;
  isArchived?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IssueDetailPanel({
  issueId,
  projectId,
  isArchived,
  onClose,
  onDeleted,
  onUpdated,
}: IssueDetailPanelProps) {
  const { formatDate, formatTime, t } = useLanguage();
  const { showToast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Data states ──────────────────────────────────────────────────────────
  const [data, setData] = useState<IssueDetailData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Edit states ──────────────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);
  const [isUpdatingField, setIsUpdatingField] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // ── Label helpers ────────────────────────────────────────────────────────
  const trackerLabels: Record<string, string> = {
    bug: t('bug'),
    feature: t('feature'),
    task: t('task'),
    support: t('support'),
    enhancement: t('enhancement'),
  };
  const statusLabels: Record<string, string> = {
    new: t('new'),
    in_progress: t('in_progress'),
    resolved: t('resolved'),
    feedback: t('feedback'),
    closed: t('closed'),
    rejected: t('rejected'),
  };
  const priorityLabels: Record<string, string> = {
    low: t('low'),
    normal: t('normal'),
    high: t('high'),
    urgent: t('urgent'),
    immediate: t('immediate'),
  };

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setEditSubject(json.data.issue.subject);
        setEditDescription(json.data.issue.description || '');
        setError('');
      } else {
        setError(json.error || '이슈를 가져오지 못했습니다.');
      }
    } catch {
      setError('서버 연결 오류가 발생했습니다.');
    }
  }, [issueId]);

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await api(`/api/projects/${projectId}/member-names`);
      const json = await res.json();
      if (json.success) setMembers(json.data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  }, [projectId]);

  const fetchCustomData = useCallback(async () => {
    if (!data?.issue?.project_id) return;
    try {
      const [fieldsRes, valuesRes] = await Promise.all([
        api(`/api/projects/${data.issue.project_id}/custom-fields`),
        api(`/api/issues/${data.issue.id}/custom-values`),
      ]);
      const fieldsJson = await fieldsRes.json();
      const valuesJson = await valuesRes.json();
      if (fieldsJson.success) setCustomFields(fieldsJson.data || []);
      if (valuesJson.success) {
        const valMap: Record<string, string> = {};
        (valuesJson.data || []).forEach((v: any) => { valMap[v.field_id] = v.value || ''; });
        setCustomValues(valMap);
      }
    } catch (e) { console.error(e); }
  }, [data?.issue?.project_id, data?.issue?.id]);

  useEffect(() => {
    if (issueId === null) {
      setData(null);
      setLoading(false);
      setError('');
      setShowDeleteConfirm(false);
      setIsEditMode(false);
      return;
    }

    setLoading(true);
    setError('');
    setShowDeleteConfirm(false);
    setIsEditMode(false);

    Promise.all([fetchData(), fetchMembers(), fetchCustomData()]).finally(() => {
      setLoading(false);
    });

    // Reset scroll position when issue changes
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [issueId, fetchData, fetchMembers, fetchCustomData]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleUpdateIssue = async (updates: Partial<Issue>) => {
    if (!issueId) return;
    setIsUpdatingIssue(true);
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchData();
        setIsEditMode(false);
        onUpdated?.();
        showToast('이슈가 성공적으로 수정되었습니다.', 'success');
      }
    } catch {
      showToast('이슈 수정 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsUpdatingIssue(false);
    }
  };

  const handleFieldUpdate = async (
    field: string,
    value: string | number | null,
  ) => {
    if (!issueId || !data) return;
    setIsUpdatingField(field);
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]:
            value === ''
              ? field === 'assigned_to_id'
                ? null
                : value
              : value,
        }),
      });
      if (res.ok) {
        await fetchData();
        onUpdated?.();
        showToast('정보가 업데이트되었습니다.', 'success');
      } else {
        const json = await res.json();
        showToast(json.error || '업데이트 중 오류가 발생했습니다.', 'error');
      }
    } catch {
      showToast('서버 연결 오류가 발생했습니다.', 'error');
    } finally {
      setIsUpdatingField(null);
    }
  };

  const handleDeleteIssue = async () => {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('이슈가 삭제되었습니다.', 'info');
        onDeleted?.();
      } else {
        showToast('이슈 삭제 중 오류가 발생했습니다.', 'error');
      }
    } catch {
      showToast('서버 연결 오류가 발생했습니다.', 'error');
    }
  };

  const handleCustomValueSave = async (fieldId: string, value: string) => {
    if (!data?.issue) return;
    const newValues = { ...customValues, [fieldId]: value };
    setCustomValues(newValues);
    try {
      await api(`/api/issues/${data.issue.id}/custom-values`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: Object.entries(newValues).map(([fid, val]) => ({
            field_id: String(fid),
            value: val,
          })),
        }),
      });
    } catch (e) { console.error(e); }
  };

  // ── Empty state (issueId is null) ────────────────────────────────────────
  if (issueId === null) {
    return (
      <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)]">
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
            <MessageSquare size={40} strokeWidth={1.5} />
            <span className="text-sm font-semibold">
              이슈를 선택하면 상세 정보가 표시됩니다.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)]">
        <div className="flex items-center justify-center flex-1">
          <div className="spinner text-[var(--text-primary)] w-10 h-10 border-[3px]" />
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)]">
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6">
          <p className="text-sm font-bold text-red-500 text-center">
            {error || '이슈 데이터를 찾을 수 없습니다.'}
          </p>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-3 py-1.5 bg-transparent cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  const { issue } = data;

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* ── Title bar ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isEditMode ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  className="form-control text-lg font-bold w-full"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="이슈 제목"
                />
                <textarea
                  rows={4}
                  className="form-control text-sm w-full"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="이슈 설명 (Markdown 지원)"
                />
                <div className="flex gap-2 justify-end mt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateIssue({
                        subject: editSubject,
                        description: editDescription,
                      })
                    }
                    disabled={isUpdatingIssue}
                    className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-bold rounded-lg border-none cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingIssue ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-bold text-[var(--text-muted)] font-mono">
                    #{issue.id}
                  </span>
                  <Badge variant={issue.tracker}>
                    {trackerLabels[issue.tracker] || issue.tracker}
                  </Badge>
                  <Badge variant={issue.priority}>
                    {priorityLabels[issue.priority] || issue.priority}
                  </Badge>
                </div>
                <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug break-words">
                  {issue.subject}
                </h2>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isEditMode && !isArchived && (
              <button
                type="button"
                onClick={() => {
                  setIsEditMode(true);
                }}
                className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer"
                title="수정"
              >
                <Edit3 size={14} />
              </button>
            )}
            {!isArchived && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-red-500 hover:bg-red-500/10 cursor-pointer"
                title="삭제"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer"
              title="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-xs font-bold text-red-500">
              이 이슈를 정말로 삭제하시겠습니까? 되돌릴 수 없습니다.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteIssue}
                className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg border-none cursor-pointer"
              >
                예, 삭제합니다
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Metadata bar (compact horizontal) ─────────────────────────────── */}
      {!isEditMode && (
        <div className="px-6 py-3 border-b border-[var(--border)] text-xs flex items-center gap-6 shrink-0 bg-[var(--bg-surface-2)]/20 flex-wrap">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium shrink-0">
              상태
            </span>
            <select
              className="form-control text-xs font-bold bg-transparent border border-[var(--border)] rounded-lg px-2 py-1"
              value={issue.status}
              onChange={(e) => handleFieldUpdate('status', e.target.value)}
              disabled={isUpdatingField === 'status'}
            >
              {Object.entries(statusLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            {isUpdatingField === 'status' && (
              <div className="spinner text-[var(--text-primary)] w-3 h-3 border-[1.5px]" />
            )}
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium shrink-0">
              담당자
            </span>
            <select
              className="form-control text-xs font-bold bg-transparent border border-[var(--border)] rounded-lg px-2 py-1"
              value={issue.assigned_to_id || ''}
              onChange={(e) =>
                handleFieldUpdate(
                  'assigned_to_id',
                  e.target.value === ''
                    ? null
                    : Number(e.target.value),
                )
              }
              disabled={isUpdatingField === 'assigned_to_id'}
            >
              <option value="">미배정</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.firstname} {member.lastname} (@{member.login})
                </option>
              ))}
            </select>
            {isUpdatingField === 'assigned_to_id' && (
              <div className="spinner text-[var(--text-primary)] w-3 h-3 border-[1.5px]" />
            )}
          </div>

          {/* Priority */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium shrink-0">
              우선순위
            </span>
            <select
              className="form-control text-xs font-bold bg-transparent border border-[var(--border)] rounded-lg px-2 py-1"
              value={issue.priority}
              onChange={(e) => handleFieldUpdate('priority', e.target.value)}
              disabled={isUpdatingField === 'priority'}
            >
              {Object.entries(priorityLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            {isUpdatingField === 'priority' && (
              <div className="spinner text-[var(--text-primary)] w-3 h-3 border-[1.5px]" />
            )}
          </div>

          {/* Tracker (shown with badge) */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium shrink-0">
              유형
            </span>
            <select
              className="form-control text-xs font-bold bg-transparent border border-[var(--border)] rounded-lg px-2 py-1"
              value={issue.tracker}
              onChange={(e) => handleFieldUpdate('tracker', e.target.value)}
              disabled={isUpdatingField === 'tracker'}
            >
              {Object.entries(trackerLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            {isUpdatingField === 'tracker' && (
              <div className="spinner text-[var(--text-primary)] w-3 h-3 border-[1.5px]" />
            )}
          </div>

          {/* Done ratio slider */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium shrink-0">
              진행률
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                className="w-16 h-1.5 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                min="0"
                max="100"
                step="10"
                value={issue.done_ratio || 0}
                onChange={(e) =>
                  handleFieldUpdate(
                    'done_ratio',
                    Number(e.target.value),
                  )
                }
                disabled={isUpdatingField === 'done_ratio'}
              />
              <span className="text-xs font-bold text-[var(--text-secondary)] w-7 text-right">
                {issue.done_ratio || 0}%
              </span>
            </div>
            {isUpdatingField === 'done_ratio' && (
              <div className="spinner text-[var(--text-primary)] w-3 h-3 border-[1.5px]" />
            )}
          </div>

          {/* Author & dates */}
          <div className="flex items-center gap-3 ml-auto text-[var(--text-muted)]">
            <span>
              {issue.author_name || ''}
            </span>
            <span className="text-[var(--border)]">|</span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formatDate(issue.created_at)}
            </span>
          </div>
        </div>
      )}

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-5"
      >
        {/* Description */}
        {!isEditMode && (
          <div>
            <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
              {issue.description || (
                <span className="text-[var(--text-muted)] italic">
                  작성된 설명이 없습니다.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {customFields.length > 0 && !isEditMode && (
          <div className="pt-2 border-t border-[var(--border)]">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">커스텀 속성</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customFields.map(field => (
                <div key={field.id} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[var(--text-muted)]">
                    {field.field_name}
                    {field.is_required ? <span className="text-red-500 ml-0.5">*</span> : null}
                  </label>
                  {field.field_type === 'boolean' ? (
                    <select className="form-control text-xs" value={customValues[field.id] || ''} onChange={(e) => handleCustomValueSave(field.id, e.target.value)}>
                      <option value="">--</option>
                      <option value="true">예</option>
                      <option value="false">아니오</option>
                    </select>
                  ) : field.field_type === 'date' ? (
                    <input type="date" className="form-control text-xs" value={customValues[field.id] || ''} onChange={(e) => handleCustomValueSave(field.id, e.target.value)} />
                  ) : field.field_type === 'time' ? (
                    <input type="time" className="form-control text-xs" value={customValues[field.id] || ''} onChange={(e) => handleCustomValueSave(field.id, e.target.value)} />
                  ) : field.field_type === 'integer' || field.field_type === 'float' ? (
                    <input type="number" step={field.field_type === 'float' ? '0.01' : '1'} className="form-control text-xs" value={customValues[field.id] || ''} onChange={(e) => handleCustomValueSave(field.id, e.target.value)} />
                  ) : field.field_type === 'text' ? (
                    <textarea rows={2} className="form-control text-xs" value={customValues[field.id] || ''} onChange={(e) => handleCustomValueSave(field.id, e.target.value)} />
                  ) : (
                    <input type="text" className="form-control text-xs" value={customValues[field.id] || ''} onChange={(e) => handleCustomValueSave(field.id, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Comments section ────────────────────────────────────────────── */}
        <div className="pt-2">
          <IssueComments
            issueId={data.issue.id}
            formatDate={formatDate}
            formatTime={formatTime as (date: string) => string}
          />
        </div>
      </div>
    </div>
  );
}
