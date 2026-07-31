import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Paperclip, FileText, File, X, AlertCircle } from 'lucide-react';
import { uploadFilesWithProgress } from 'shared/lib/upload';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';
import { HTMLEditor, createHTMLEditorLabels } from 'ui/HTMLEditor';
import { ConfirmDialog } from 'ui/ConfirmDialog';
import { useLanguage } from '../context/LanguageContext';
import type { Attachment } from 'shared/types';

export default function PostForm() {
  const { id, boardType, postId } = useParams<{ id?: string; boardType?: string; postId?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const isEdit = !!postId;
  const isGlobal = !!boardType;
  const isAdmin = currentUser.role === 'admin';
  const projectId = isGlobal ? null : String(id || '0');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(isGlobal ? boardType : 'general');
  const [popupStartDate, setPopupStartDate] = useState("");
  // 공지 상단 고정 (관리자 전용)
  const [isPinned, setIsPinned] = useState(false);
  const [popupEndDate, setPopupEndDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // 첨부 삭제 확인 다이얼로그 (네이티브 confirm 대체)
  const [pendingAttachmentDelete, setPendingAttachmentDelete] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGlobal && currentUser.role !== 'admin') {
      showToast(t('permissionDenied') || '권한이 없습니다.', 'error');
      doNavigateBack();
    }
  }, [isGlobal, currentUser.role]);

  // 미저장 이탈 경고 (탭 닫기/새로고침)
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (isEdit) {
      fetchPost();
      fetchAttachments();
    }
  }, [postId]);

  const fetchPost = async () => {
    try {
      const res = await api(`/api/posts/${postId}`);
      const json = await res.json();
      if (json.success) {
        setTitle(json.data.title);
        setContent(json.data.content);
        setCategory(json.data.category);
        setPopupStartDate(json.data.popup_start_date || "");
        setIsPinned(!!json.data.is_pinned);
        setPopupEndDate(json.data.popup_end_date || "");
      } else {
        showToast(t('postLoadFail') || '게시글을 불러오지 못했습니다.', 'error');
        doNavigateBack();
      }
    } catch (err) {
      console.error('Failed to fetch post:', err);
      showToast(t('errOccurred') || '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async () => {
    try {
      const res = await api(`/api/posts/${postId}/attachments`);
      const json = await res.json();
      if (json.success) {
        setExistingAttachments(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    setPendingAttachmentDelete(null);
    try {
      const res = await api(`/api/attachments/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(t('attachmentDeleted') || '첨부파일이 삭제되었습니다.', 'success');
        setExistingAttachments(prev => prev.filter(a => a.id !== id));
      } else {
        showToast(json.error || t('deleteFail') || '삭제 실패', 'error');
      }
    } catch (err) {
      console.error('Delete attachment failed:', err);
    }
  };

  const doNavigateBack = () => {
    if (isGlobal) {
      navigate(isEdit ? `/boards/${boardType}/${postId}` : `/boards/${boardType}`);
    } else {
      navigate(isEdit ? `/projects/${id}/board/${postId}` : `/projects/${id}/board`);
    }
  };

  // 취소/뒤로가기: 미저장 변경이 있으면 확인 다이얼로그
  const handleBackClick = () => { if (dirty) setLeaveConfirmOpen(true); else doNavigateBack(); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('enterTitle') || '제목을 입력하세요.');
      titleRef.current?.focus();
      return;
    }

    if (!isGlobal && (category === 'notice' || category === 'resource') && currentUser.role !== 'admin') {
      setError(t('permissionDenied') || '권한이 없습니다.');
      return;
    }

    const noticeSelected = (isGlobal && boardType === 'notice') || (!isGlobal && category === 'notice');
    if (noticeSelected && popupStartDate && popupEndDate && popupEndDate < popupStartDate) {
      setError(t('popupDateInvalid') || '팝업 종료일은 시작일보다 빠를 수 없습니다.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = isEdit ? `/api/posts/${postId}` : `/api/posts`;
      const method = isEdit ? 'PUT' : 'POST';
      interface PostPayload {
        title: string;
        content: string;
        category: string;
        popup_start_date: string;
        popup_end_date: string;
        is_pinned: boolean;
        project_id?: string | null;
      }
      // 상단 고정은 공지에서만 의미가 있고, 서버에서도 관리자 권한을 재확인합니다.
      const pinnedValue = isNotice && isAdmin ? isPinned : false;
      const body: PostPayload = isEdit
        ? { title, content, category, popup_start_date: popupStartDate, popup_end_date: popupEndDate, is_pinned: pinnedValue }
        : { project_id: projectId, title, content, category, popup_start_date: popupStartDate, popup_end_date: popupEndDate, is_pinned: pinnedValue };

      const res = await api(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const currentPostId = isEdit ? postId : json.id;

        if (files.length > 0) {
          try {
            await uploadFilesWithProgress(
              "/api/attachments",
              files,
              { post_id: currentPostId.toString() },
              setUploadProgress
            );
          } catch (err) {
            console.error("Post attachment upload failed:", err);
            showToast(t('attachmentUploadFail') || '본문은 저장되었으나 첨부파일 업로드에 실패했습니다.', 'error');
          }
        }

        setDirty(false);
        showToast(isEdit ? (t('postUpdated') || '게시글이 수정되었습니다.') : (t('postCreated') || '게시글이 작성되었습니다.'), 'success');
        if (isGlobal) {
          navigate(`/boards/${boardType}`);
        } else {
          navigate(`/projects/${id}/board`);
        }
      } else {
        setError(json.error || t('postSaveFail') || '게시글 저장 중 에러가 발생했습니다.');
      }
    } catch (err) {
      setError(t('serverError') || '서버 통신 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20"><div className="spinner text-primary" /></div>;

  const pageTitle = isEdit ? (t('editPost') || '게시글 수정') : (t('newPost') || '새 게시글 작성');
  const isNotice = (isGlobal && boardType === 'notice') || (!isGlobal && category === 'notice');

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackClick}
            disabled={saving}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors border-none bg-transparent cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft size={16} />
          </button>
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={14} className="text-[var(--primary)]" />
            {pageTitle}
          </h3>
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col p-6 space-y-5 custom-scrollbar">
        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 text-[var(--danger)] text-xs font-bold p-3.5 rounded-xl border border-[var(--danger)]/20">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* ── 제목 ── */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-[var(--text-secondary)] shrink-0">
            {t('title') || '제목'} <span className="text-red-500">*</span>
          </label>
          <input
            ref={titleRef}
            type="text"
            placeholder={t('enterTitlePlaceholder') || '게시글 제목을 입력하세요'}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            required
            disabled={saving}
            className="flex-1 px-3.5 py-2 h-9.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all placeholder:text-[var(--text-muted)] text-[var(--text-primary)] disabled:opacity-60"
          />
        </div>

        {/* ── 카테고리 + 팝업 날짜 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-4 items-start">
          {!isGlobal && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">
                {t('category') || '카테고리'}
              </label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setDirty(true); }}
                disabled={saving}
                className="w-full px-3.5 py-2 h-9.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all text-[var(--text-primary)] cursor-pointer font-medium disabled:opacity-60"
              >
                <option value="general" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('general') || '일반'}</option>
                {currentUser.role === 'admin' && (
                  <>
                    <option value="notice" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('notices') || '공지사항'}</option>
                    <option value="resource" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('resources') || '자료실'}</option>
                  </>
                )}
              </select>
            </div>
          )}

          {isNotice && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">
                {t('popupPeriod') || '팝업 기간'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={popupStartDate}
                  max={popupEndDate || undefined}
                  onChange={(e) => { setPopupStartDate(e.target.value); setDirty(true); }}
                  disabled={saving}
                  className="w-full px-3.5 py-2 h-9.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all text-[var(--text-primary)] cursor-pointer disabled:opacity-60"
                />
                <span className="text-[var(--text-muted)] text-xs font-bold shrink-0">~</span>
                <input
                  type="date"
                  value={popupEndDate}
                  min={popupStartDate || undefined}
                  onChange={(e) => { setPopupEndDate(e.target.value); setDirty(true); }}
                  disabled={saving}
                  className="w-full px-3.5 py-2 h-9.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all text-[var(--text-primary)] cursor-pointer disabled:opacity-60"
                />
              </div>
            </div>
          )}

          {isNotice && isAdmin && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-[var(--text-secondary)]">{t('pinPost')}</span>
              <label className="flex items-center gap-2 h-9.5 px-3.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] cursor-pointer focus-within:ring-2 focus-within:ring-[var(--primary)]/50">
                <input
                  type="checkbox"
                  checked={isPinned}
                  disabled={saving}
                  onChange={(e) => { setIsPinned(e.target.checked); setDirty(true); }}
                  className="w-3.5 h-3.5 accent-[var(--primary)] cursor-pointer"
                />
                <span className="text-xs font-medium text-[var(--text-primary)]">{t('pinPost')}</span>
              </label>
            </div>
          )}
        </div>

        {/* ── 내용 ── */}
        <div className="flex-1 flex flex-col min-h-[300px]">
          <HTMLEditor value={content} onChange={(v) => { setContent(v); setDirty(true); }} height={380} labels={createHTMLEditorLabels(t, language)} />
        </div>

        {/* ── 기존 첨부파일 (수정 모드) ── */}
        {isEdit && existingAttachments.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1">
              <Paperclip size={12} className="text-[var(--text-muted)]" />
              {t('existingAttachments') || '기존 첨부 파일'}
            </label>
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
              {existingAttachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl transition-all text-xs font-semibold">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={13} className="text-[var(--text-muted)] shrink-0" />
                    <span className="truncate text-[var(--text-primary)] font-bold">{a.filename}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachmentDelete(a.id)}
                    className="p-1 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 rounded-lg text-[var(--text-muted)] transition-all border-none bg-transparent cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 새 파일 첨부 ── */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1">
            <Paperclip size={12} className="text-[var(--text-muted)]" />
            {isEdit ? (t('attachNewFile') || '새 파일 첨부') : (t('attachFile') || '파일 첨부')}
          </label>
          <div className="relative border-2 border-dashed border-[var(--border)] rounded-2xl hover:border-[var(--primary)] transition-all bg-[var(--bg-surface-2)]/50 p-4 text-center cursor-pointer">
            <input
              type="file"
              multiple
              disabled={saving}
              onChange={(e) => {
                if (!e.target.files) return;
                const incoming = Array.from(e.target.files);
                setFiles(prev => {
                  const names = new Set(prev.map(f => f.name));
                  return [...prev, ...incoming.filter(f => !names.has(f.name))];
                });
                setDirty(true);
                e.target.value = '';
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none select-none">
              <Paperclip size={18} className="text-[var(--text-muted)]" />
              <span className="text-xs font-bold text-[var(--text-secondary)]">파일을 드래그하여 놓거나 클릭하여 선택</span>
              <span className="text-xs text-[var(--text-muted)]">최대 파일 크기: 100MiB</span>
            </div>
          </div>
          {files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl transition-all text-xs font-semibold">
                  <div className="flex items-center gap-2 min-w-0">
                    <File size={13} className="text-[var(--text-muted)] shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-[var(--text-primary)] font-bold">{file.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 rounded-lg text-[var(--text-muted)] transition-all border-none bg-transparent cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 업로드 프로그레스 ── */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[var(--primary)] h-full rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {/* ── 하단 버튼 ── */}
        <div className="flex items-center justify-end gap-2 pt-5 border-t border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={handleBackClick}
            disabled={saving}
            className="bg-[var(--bg-surface-2)] hover:opacity-90 text-[var(--text-secondary)] font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer h-9 disabled:opacity-50"
          >
            {t('cancel') || '취소'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--primary)] hover:opacity-90 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 h-9 border-none"
          >
            {saving ? (
              <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>저장 중...</>
            ) : (
              <><Save size={13} />{isEdit ? (t('editComplete') || '수정 완료') : (t('saveBtn') || '저장하기')}</>
            )}
          </button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={leaveConfirmOpen}
        title={t('unsavedTitle') || '저장되지 않은 변경사항'}
        message={t('unsavedLeaveConfirm') || '작성 중인 내용이 저장되지 않았습니다. 정말 나가시겠습니까?'}
        confirmLabel={t('leaveWithoutSaving') || '나가기'}
        cancelLabel={t('cancel') || '취소'}
        danger
        onConfirm={() => { setLeaveConfirmOpen(false); setDirty(false); doNavigateBack(); }}
        onCancel={() => setLeaveConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={pendingAttachmentDelete !== null}
        title={t('delete')}
        message={t('confirmDeleteAttachment')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={() => { if (pendingAttachmentDelete) handleDeleteAttachment(pendingAttachmentDelete); }}
        onCancel={() => setPendingAttachmentDelete(null)}
      />
    </div>
  );
}
