import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare, Send, Edit2, Trash2, RefreshCw,
  ChevronDown, ChevronUp, User, Paperclip, X, Download, FileText
} from 'lucide-react';
import { api } from 'shared/lib/api';
import { useToast } from 'ui/Toast';

// ── Types ───────────────────────────────────────────────────────────────────

interface CommentAttachment {
  id: string;
  filename: string;
  filesize: number;
  content_type: string;
}

export interface CommentData {
  id: string;
  author_id: string;
  author_login: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
  attachments: CommentAttachment[];
}

export interface CommentLabels {
  empty: string;
  placeholder: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  submit: string;
  attachFile: string;
  ctrlEnter: string;
  confirmDelete: string;
  loading: string;
  edited: string;
}

const DEFAULT_LABELS: CommentLabels = {
  empty: '아직 댓글이 없습니다. 첫 댓글을 남겨보세요!',
  placeholder: '댓글을 입력하세요... (Ctrl+Enter로 전송)',
  edit: '수정',
  delete: '삭제',
  save: '저장',
  cancel: '취소',
  submit: '등록',
  attachFile: '파일 첨부',
  ctrlEnter: 'Ctrl+Enter로 전송',
  confirmDelete: '댓글을 삭제하시겠습니까?\n첨부파일도 함께 삭제됩니다.',
  loading: '로딩 중...',
  edited: '(수정됨)',
};

interface CommentSectionProps {
  fetchCommentsUrl: string;
  createCommentUrl: string;
  getUpdateCommentUrl: (commentId: string) => string;
  getDeleteCommentUrl: (commentId: string) => string;
  formatDate: (date: string) => string;
  formatTime?: (date: string) => string;
  compact?: boolean;
  labels?: Partial<CommentLabels>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ contentType: _contentType }: { contentType: string }) {
  return <FileText size={12} className="text-[var(--primary)] shrink-0" />;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CommentSection({
  fetchCommentsUrl,
  createCommentUrl,
  getUpdateCommentUrl,
  getDeleteCommentUrl,
  formatDate,
  formatTime,
  compact = false,
  labels: labelsProp,
}: CommentSectionProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const { showToast } = useToast();

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isAdmin = currentUser?.role === 'admin';

  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  // 수정 모드 전용 첨부파일 상태 (새 댓글 작성 흐름과 분리)
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [editKeptAttachments, setEditKeptAttachments] = useState<CommentAttachment[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(fetchCommentsUrl);
      const json = await res.json();
      if (json.success) setComments(json.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchCommentsUrl]);

  // fetch/create URL이 바뀌면 (다른 엔티티로 이동) 작성 중인 상태 초기화
  useEffect(() => {
    setNewComment('');
    setPendingFiles([]);
    setEditingId(null);
    setEditContent('');
    setEditPendingFiles([]);
    setEditKeptAttachments([]);
    fetchComments();
  }, [fetchComments]);

  // 수정 모드 진입/종료 헬퍼 (편집 전용 상태 격리 관리)
  const startEdit = (comment: CommentData) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditPendingFiles([]);
    setEditKeptAttachments(comment.attachments || []);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditPendingFiles([]);
    setEditKeptAttachments([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && pendingFiles.length === 0) || submitting) return;
    setSubmitting(true);
    try {
      const res = await api(createCommentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() || ' ' }),
      });
      const json = await res.json();
      if (!json.success) {
        // api() 가 오류 본문을 { success, error } 로 정규화하므로 원인이 그대로 담긴다.
        console.error('Failed to submit comment:', json.error);
        showToast(json.error || '댓글 등록에 실패했습니다.', 'error');
        return;
      }

      const commentId = json.id;

      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('comment_id', String(commentId));
          await api('/api/attachments', { method: 'POST', body: formData });
        }
      }

      setNewComment('');
      setPendingFiles([]);
      fetchComments();
    } catch (err) {
      console.error('Failed to submit comment:', err);
      showToast('댓글 등록에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    const hasContent = editContent.trim().length > 0;
    // 본문/유지 첨부/신규 첨부가 모두 비어 있으면 저장하지 않음
    if (!hasContent && editKeptAttachments.length === 0 && editPendingFiles.length === 0) return;
    if (editSubmitting) return; // 중복 제출 방지
    setEditSubmitting(true);
    try {
      // 1) 제거된 기존 첨부파일 삭제 (백엔드 DELETE /api/attachments/:id 지원)
      const original = comments.find(c => c.id === commentId);
      const keptIds = new Set(editKeptAttachments.map(a => a.id));
      const removed = (original?.attachments || []).filter(a => !keptIds.has(a.id));
      for (const att of removed) {
        await api(`/api/attachments/${att.id}`, { method: 'DELETE' });
      }

      // 2) 본문 수정
      const res = await api(getUpdateCommentUrl(commentId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() || ' ' }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('Failed to edit comment:', json.error);
        showToast(json.error || '댓글 수정에 실패했습니다.', 'error');
        return;
      }

      // 3) 새로 추가된 첨부파일 업로드 (새 댓글 흐름과 동일)
      if (editPendingFiles.length > 0) {
        for (const file of editPendingFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('comment_id', String(commentId));
          await api('/api/attachments', { method: 'POST', body: formData });
        }
      }

      cancelEdit();
      fetchComments();
    } catch (err) {
      console.error('Failed to edit comment:', err);
      showToast('댓글 수정에 실패했습니다.', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm(labels.confirmDelete)) return;
    try {
      const res = await api(getDeleteCommentUrl(commentId), { method: 'DELETE' });
      const json = await res.json();
      if (json.success) fetchComments();
      else showToast(json.error || '댓글 삭제에 실패했습니다.', 'error');
    } catch (err) {
      console.error('Failed to delete comment:', err);
      showToast('댓글 삭제에 실패했습니다.', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 수정 모드 첨부파일 조작
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setEditPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeEditPendingFile = (index: number) => {
    setEditPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attachmentId: string) => {
    setEditKeptAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  const handleDownload = async (attachmentId: string, filename: string) => {
    try {
      const res = await api(`/api/attachments/${attachmentId}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const canManage = (authorId: string) =>
    currentUser && (currentUser.id === String(authorId) || isAdmin);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const renderAttachments = (attachments: CommentAttachment[], isCompact: boolean) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div className={`flex flex-wrap gap-1.5 ${isCompact ? 'mt-1' : 'mt-2'}`}>
        {attachments.map(att => (
          <button
            key={att.id}
            type="button"
            onClick={() => handleDownload(att.id, att.filename)}
            className={`flex items-center gap-1.5 ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'} bg-[var(--bg-surface-2)]/70 hover:bg-[var(--primary)]/10 border border-[var(--border)] hover:border-[var(--primary)]/30 rounded-lg text-[var(--text-secondary)] hover:text-[var(--primary)] transition-all cursor-pointer font-medium group/att`}
            title={`${att.filename} (${formatFileSize(att.filesize)})`}
          >
            <FileIcon contentType={att.content_type} />
            <span className="max-w-[120px] truncate">{att.filename}</span>
            <span className="text-[var(--text-muted)] group-hover/att:text-[var(--primary)]/70">
              {formatFileSize(att.filesize)}
            </span>
            <Download size={isCompact ? 9 : 10} className="opacity-0 group-hover/att:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    );
  };

  const renderPendingFiles = (isCompact: boolean) => {
    if (pendingFiles.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {pendingFiles.map((file, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'} bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg text-[var(--primary)] font-medium`}
          >
            <Paperclip size={isCompact ? 9 : 10} />
            <span className="max-w-[100px] truncate">{file.name}</span>
            <span className="text-[var(--primary)]/60">{formatFileSize(file.size)}</span>
            <button
              type="button"
              onClick={() => removePendingFile(i)}
              className="ml-0.5 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer p-0"
            >
              <X size={isCompact ? 9 : 10} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // 수정 모드에서 유지되는 기존 첨부 + 새로 추가된 첨부를 함께 렌더링
  const renderEditAttachments = (isCompact: boolean) => {
    if (editKeptAttachments.length === 0 && editPendingFiles.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {editKeptAttachments.map(att => (
          <div
            key={att.id}
            className={`flex items-center gap-1.5 ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'} bg-[var(--bg-surface-2)]/70 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] font-medium`}
            title={`${att.filename} (${formatFileSize(att.filesize)})`}
          >
            <FileIcon contentType={att.content_type} />
            <span className="max-w-[100px] truncate">{att.filename}</span>
            <span className="text-[var(--text-muted)]">{formatFileSize(att.filesize)}</span>
            <button
              type="button"
              onClick={() => removeExistingAttachment(att.id)}
              className="ml-0.5 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer p-0"
            >
              <X size={isCompact ? 9 : 10} />
            </button>
          </div>
        ))}
        {editPendingFiles.map((file, i) => (
          <div
            key={`new-${i}`}
            className={`flex items-center gap-1.5 ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'} bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg text-[var(--primary)] font-medium`}
          >
            <Paperclip size={isCompact ? 9 : 10} />
            <span className="max-w-[100px] truncate">{file.name}</span>
            <span className="text-[var(--primary)]/60">{formatFileSize(file.size)}</span>
            <button
              type="button"
              onClick={() => removeEditPendingFile(i)}
              className="ml-0.5 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer p-0"
            >
              <X size={isCompact ? 9 : 10} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // ── Compact mode ─────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="border-t border-[var(--border)] bg-[var(--bg-surface-2)]/20 flex flex-col shrink-0" style={{ maxHeight: '48%' }}>
        <button
          type="button"
          onClick={() => setIsCollapsed(p => !p)}
          className="flex items-center gap-2 px-5 py-2.5 hover:bg-[var(--bg-surface-2)]/50 transition-colors border-none bg-transparent cursor-pointer w-full text-left shrink-0"
        >
          <MessageSquare size={12} className="text-[var(--primary)]" />
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            댓글
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-[var(--primary)]/10 text-[var(--primary)] rounded-full font-bold">
              {comments.length}
            </span>
          </span>
          <span className="ml-auto text-[var(--text-muted)]">
            {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </span>
        </button>

        {!isCollapsed && (
          <>
            <div className={`overflow-y-auto min-h-0 custom-scrollbar px-4 ${comments.length === 0 && !loading ? 'flex-none pb-1' : 'flex-1 pb-2'}`}>
              {loading ? (
                <div className="flex items-center justify-center py-4 text-[var(--text-muted)]">
                  <RefreshCw size={13} className="animate-spin mr-2" />
                  <span className="text-xs">{labels.loading}</span>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-1.5">{labels.empty}</p>
              ) : (
                <div className="space-y-2 py-1">
                  {comments.map(comment => (
                    <div key={comment.id} className="group flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[8px] font-bold text-[var(--primary)] shrink-0 mt-0.5 border border-[var(--primary)]/20">
                        {getInitials(comment.author_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{comment.author_name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{formatDate(comment.created_at)}</span>
                          {comment.updated_at !== comment.created_at && (
                            <span className="text-xs text-[var(--text-muted)] italic">{labels.edited}</span>
                          )}
                        </div>
                        {editingId === comment.id ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex gap-1.5">
                              <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                rows={2}
                                className="flex-1 px-2 py-1 text-xs border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 resize-none"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEdit(comment.id);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <div className="flex flex-col gap-1">
                                <button type="button" onClick={() => handleEdit(comment.id)}
                                  className="px-2 py-1 text-xs bg-[var(--primary)] text-white rounded-lg cursor-pointer border-none font-semibold hover:opacity-90">{labels.save}</button>
                                <button type="button" onClick={cancelEdit}
                                  className="px-2 py-1 text-xs border border-[var(--border)] text-[var(--text-muted)] rounded-lg cursor-pointer bg-transparent hover:bg-[var(--bg-surface-2)] font-medium">{labels.cancel}</button>
                              </div>
                            </div>
                            {renderEditAttachments(true)}
                            <div>
                              <input
                                ref={editFileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleEditFileSelect}
                              />
                              <button
                                type="button"
                                onClick={() => editFileInputRef.current?.click()}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 transition-all cursor-pointer font-medium"
                              >
                                <Paperclip size={10} />
                                {labels.attachFile}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words">{comment.content.trim()}</p>
                              {renderAttachments(comment.attachments, true)}
                            </div>
                            {canManage(comment.author_id) && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                                <button type="button"
                                  onClick={() => startEdit(comment)}
                                  className="p-1 rounded hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors border-none bg-transparent cursor-pointer" title={labels.edit}>
                                  <Edit2 size={10} />
                                </button>
                                <button type="button"
                                  onClick={() => handleDelete(comment.id)}
                                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-[var(--text-muted)] hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer" title={labels.delete}>
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[var(--border)] shrink-0">
              {pendingFiles.length > 0 && (
                <div className="px-4 pt-2 pb-1">
                  {renderPendingFiles(true)}
                </div>
              )}
              <div className="flex gap-2 px-4 py-2.5">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder={labels.placeholder}
                  className="flex-1 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all placeholder:text-[var(--text-muted)]"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${pendingFiles.length > 0 ? 'border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5'}`}
                  title={labels.attachFile}
                >
                  <Paperclip size={13} />
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!newComment.trim() && pendingFiles.length === 0)}
                  className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer border-none flex items-center gap-1 shrink-0"
                >
                  {submitting ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                  <span>{labels.submit}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    );
  }

  // ── Full mode ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <MessageSquare size={16} className="text-[var(--primary)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          댓글
          <span className="ml-2 px-2 py-0.5 text-xs bg-[var(--primary)]/10 text-[var(--primary)] rounded-full font-bold">
            {comments.length}
          </span>
        </h3>
        {loading && <RefreshCw size={12} className="animate-spin text-[var(--text-muted)] ml-auto" />}
      </div>

      {/* 댓글 목록 */}
      <div className="space-y-3">
        {comments.length === 0 && !loading ? (
          <div className="flex items-center justify-center gap-1.5 py-2 text-[var(--text-muted)]">
            <MessageSquare size={12} className="opacity-40" />
            <p className="text-xs">{labels.empty}</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="group flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-xs font-bold text-[var(--primary)] shrink-0 border border-[var(--primary)]/20">
                {getInitials(comment.author_name)}
              </div>
              <div className="flex-1 min-w-0 bg-[var(--bg-surface-2)]/50 rounded-xl border border-[var(--border)] px-4 py-3 hover:border-[var(--border-strong,var(--border))] transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{comment.author_name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatDate(comment.created_at)}
                      {formatTime && ` ${formatTime(comment.created_at)}`}
                    </span>
                    {comment.updated_at !== comment.created_at && (
                      <span className="text-xs text-[var(--text-muted)] italic">{labels.edited}</span>
                    )}
                  </div>
                  {canManage(comment.author_id) && editingId !== comment.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button type="button"
                        onClick={() => startEdit(comment)}
                        className="flex items-center gap-1 px-2 py-1 text-xs border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 transition-all cursor-pointer bg-transparent font-medium">
                        <Edit2 size={10} />{labels.edit}
                      </button>
                      <button type="button"
                        onClick={() => handleDelete(comment.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs border border-red-200 dark:border-red-800/50 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer bg-transparent font-medium">
                        <Trash2 size={10} />{labels.delete}
                      </button>
                    </div>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] resize-none transition-all"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEdit(comment.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />

                    {renderEditAttachments(false)}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={editFileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleEditFileSelect}
                        />
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer font-medium ${
                            editPendingFiles.length > 0
                              ? 'border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)]'
                              : 'border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5'
                          }`}
                        >
                          <Paperclip size={12} />
                          {labels.attachFile}
                          {editPendingFiles.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-[var(--primary)] text-white rounded-full text-[10px] font-bold">
                              {editPendingFiles.length}
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button"
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)] cursor-pointer bg-transparent font-medium transition-colors">
                          {labels.cancel}
                        </button>
                        <button type="button"
                          onClick={() => handleEdit(comment.id)}
                          className="px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded-xl hover:opacity-90 cursor-pointer border-none font-bold transition-all">
                          {labels.save}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words">{comment.content.trim()}</p>
                    {renderAttachments(comment.attachments, false)}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 댓글 작성 */}
      <form onSubmit={handleSubmit} className="flex gap-3 pt-2 border-t border-[var(--border)]">
        <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0 border border-[var(--primary)]/20">
          <User size={14} className="text-[var(--primary)]" />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={labels.placeholder}
            rows={3}
            className="w-full px-4 py-2.5 text-sm border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] resize-none transition-all placeholder:text-[var(--text-muted)]"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />

          {renderPendingFiles(false)}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer font-medium ${
                  pendingFiles.length > 0
                    ? 'border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5'
                }`}
              >
                <Paperclip size={12} />
                {labels.attachFile}
                {pendingFiles.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-[var(--primary)] text-white rounded-full text-[10px] font-bold">
                    {pendingFiles.length}
                  </span>
                )}
              </button>
              <span className="text-xs text-[var(--text-muted)]">{labels.ctrlEnter}</span>
            </div>
            <button
              type="submit"
              disabled={submitting || (!newComment.trim() && pendingFiles.length === 0)}
              className="px-4 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer border-none flex items-center gap-1.5 h-9"
            >
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              {labels.submit}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
