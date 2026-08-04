import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit2, Calendar, User, Clock, Eye, Pin, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { AttachmentList } from 'ui/AttachmentList';
import { ConfirmDialog } from 'ui/ConfirmDialog';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { api, fetchBlobUrl } from 'shared/lib/api';
import { sanitizeHtml } from 'shared/lib/sanitize';
import { PostComments } from '../components/boards/PostComments';

import type { Post, Attachment, AdjacentPosts } from 'shared/types';

export default function PostDetailPage() {
  const { formatDate, formatTime, t } = useLanguage();
  const { id, boardType, postId } = useParams<{ id?: string; boardType?: string; postId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isGlobal = !!boardType;

  const [post, setPost] = useState<Post | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  // 삭제 확인 다이얼로그 (네이티브 confirm 대체)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // 이전/다음 글 네비게이션
  const [adjacent, setAdjacent] = useState<AdjacentPosts>({ prev: null, next: null });

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const fetchAdjacent = async () => {
    try {
      const res = await api(`/api/posts/${postId}/adjacent`);
      const json = await res.json();
      if (json.success) setAdjacent(json.data);
    } catch (err) {
      console.error('Failed to fetch adjacent posts:', err);
    }
  };

  const fetchPost = async () => {
    setLoadError(false);
    try {
      // count_view=true — 상세 화면 진입 시에만 조회수를 증가시킵니다(작성/수정 폼 제외).
      const res = await api(`/api/posts/${postId}?count_view=true`);
      const json = await res.json();
      if (json.success) {
        setPost(json.data);
      } else {
        setPost(null); // 존재하지 않는 게시글
      }
    } catch (err) {
      console.error('Failed to fetch post:', err);
      setLoadError(true); // 네트워크/서버 오류 → 재시도 가능
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => { setLoading(true); fetchPost(); fetchAttachments(); };


  const fetchAttachments = async () => {
    try {
      const res = await api(`/api/posts/${postId}/attachments`);
      const json = await res.json();
      if (json.success) {
        setAttachments(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    }
  };

  // 데이터 로더 선언 이후에 효과를 등록합니다(선언 전 참조 방지).
  useEffect(() => {
    fetchPost();
    fetchAttachments();
    fetchAdjacent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const navigateBack = () => {
    if (isGlobal) {
      navigate(`/boards/${boardType}`);
    } else {
      navigate(`/projects/${id}/board`);
    }
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    try {
      const res = await api(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(t('postDeleted'), 'success');
        navigateBack();
      } else {
        showToast(t('deleteFail'), 'error');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      showToast(t('deleteError'), 'error');
    }
  };

  const handleDownloadAll = async () => {
    if (downloadingAll) return;
    setDownloadingAll(true);
    try {
      const blobUrl = await fetchBlobUrl(`/api/attachments/batch-download?post_id=${postId}`);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `attachments_${postId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      showToast(t('fileDownloadError'), 'error');
    } finally {
      setDownloadingAll(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-9 w-24 rounded-lg bg-[var(--bg-surface-2)]" />
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="p-6 bg-gray-50/50 dark:bg-slate-850/50 flex flex-col gap-4">
          <div className="h-5 w-20 rounded-md bg-[var(--bg-surface-2)]" />
          <div className="h-8 w-2/3 rounded-lg bg-[var(--bg-surface-2)]" />
          <div className="h-6 w-48 rounded-full bg-[var(--bg-surface-2)]" />
        </div>
        <div className="p-6 flex flex-col gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-4 rounded bg-[var(--bg-surface-2)]" style={{ width: `${90 - i * 8}%` }} />)}
        </div>
      </div>
    </div>
  );
  if (loadError) return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
      <p className="text-sm font-semibold text-[var(--text-secondary)]">{t('postLoadFail')}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRetry}>{t('retry')}</Button>
        <Button variant="ghost" size="sm" onClick={navigateBack}>{t('backToVersionList')}</Button>
      </div>
    </div>
  );
  if (!post) return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
      <p className="text-sm text-[var(--text-muted)]">{t('postNotFound')}</p>
      <Button variant="outline" size="sm" icon={ArrowLeft} onClick={navigateBack}>{t('backToVersionList')}</Button>
    </div>
  );

  const isAuthorOrAdmin = user && (user.id === post.author_id || user.role === 'admin');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          icon={ArrowLeft} 
          onClick={navigateBack}
          className="text-muted hover:text-foreground"
        >
          {t('backToVersionList')}
        </Button>

        {isAuthorOrAdmin && (
          <div className="flex items-center gap-2">
            <Link to={isGlobal ? `/boards/${boardType}/${postId}/edit` : `/projects/${id}/board/${postId}/edit`}>
              <Button variant="outline" size="sm" icon={Edit2}>{t('edit')}</Button>
            </Link>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>{t('delete')}</Button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden border-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-lg">
        <div className="border-b border-border p-6 bg-gray-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
              post.category === 'notice' ? 'bg-danger/10 text-danger border-danger/20' :
              post.category === 'resource' ? 'bg-success/10 text-success border-success/20' :
              'bg-primary/10 text-primary border-primary/20'
            }`}>
              {post.category === 'notice' ? t('notices') : post.category === 'resource' ? t('resources') : t('general')}
            </span>
            <span className="text-xs text-muted font-medium">#{post.id}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-slate-100 mb-4 leading-tight">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-border shadow-sm">
              <User size={14} className="text-primary" />
              <span className="font-bold text-foreground">{post.author_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>{formatDate(post.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{formatTime(post.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye size={14} />
              <span>{t('views')} {post.view_count ?? 0}</span>
            </div>
            {post.is_pinned && (
              <div className="flex items-center gap-1.5 text-primary font-semibold">
                <Pin size={14} />
                <span>{t('pinned')}</span>
              </div>
            )}
            {post.category === 'notice' && (post.popup_start_date || post.popup_end_date) && (
              <div className="flex items-center gap-1.5 text-danger font-semibold">
                <Calendar size={14} />
                <span>{t('popupPeriod')} {post.popup_start_date || '—'} ~ {post.popup_end_date || '—'}</span>
              </div>
            )}
          </div>
        </div>

        <CardBody className="p-0">
          {post.content ? (
            <div
              className="p-6 text-sm leading-relaxed break-words text-foreground prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />
          ) : (
            <div className="p-6 text-sm text-[var(--text-muted)] italic">{t('noContent')}</div>
          )}

          <AttachmentList 
            attachments={attachments} 
            className="mx-6 mb-6" 
            onDownloadAll={handleDownloadAll} 
          />
        </CardBody>
      </Card>

      {/* 이전 / 다음 글 네비게이션 */}
      {(adjacent.prev || adjacent.next) && (
        <nav
          aria-label={`${t('prevPost')} / ${t('nextPost')}`}
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-sm divide-y divide-[var(--border)] overflow-hidden"
        >
          {([['prev', adjacent.prev, ChevronUp, t('prevPost')], ['next', adjacent.next, ChevronDown, t('nextPost')]] as const).map(
            ([key, item, Icon, label]) => item && (
              <button
                key={key}
                type="button"
                onClick={() => navigate(isGlobal ? `/boards/${boardType}/${item.id}` : `/projects/${id}/board/${item.id}`)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-[var(--bg-surface-2)]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]/60"
              >
                <Icon size={14} className="text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-[var(--text-muted)] w-16 shrink-0">{label}</span>
                <span className="text-sm text-[var(--text-primary)] font-semibold truncate">{item.title}</span>
              </button>
            )
          )}
        </nav>
      )}

      {/* Comments Section */}
      {post && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-sm p-6">
          <PostComments
            postId={post.id}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('delete')}
        message={t('confirmDeletePost')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
