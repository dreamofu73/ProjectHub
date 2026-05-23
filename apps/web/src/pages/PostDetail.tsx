import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit2, Calendar, User, Clock } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { AttachmentList } from 'ui/AttachmentList';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { api, fetchBlobUrl } from 'shared/lib/api';
import { PostComments } from '../components/boards/PostComments';

import type { Post, Attachment } from 'shared/types';

export default function PostDetailPage() {
  const { formatDate, formatTime } = useLanguage();
  const { id, boardType, postId } = useParams<{ id?: string; boardType?: string; postId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isGlobal = !!boardType;

  const [post, setPost] = useState<Post | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    fetchPost();
    fetchAttachments();
  }, [postId]);

  const fetchPost = async () => {
    try {
      const res = await api(`/api/posts/${postId}`);
      const json = await res.json();
      if (json.success) {
        setPost(json.data);
      } else {
        showToast('게시글을 불러오지 못했습니다.', 'error');
        navigateBack();
      }
    } catch (err) {
      console.error('Failed to fetch post:', err);
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };


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

  const navigateBack = () => {
    if (isGlobal) {
      navigate(`/boards/${boardType}`);
    } else {
      navigate(`/projects/${id}/board`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return;
    try {
      const res = await api(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('게시글이 삭제되었습니다.', 'success');
        navigateBack();
      } else {
        showToast('삭제 실패', 'error');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
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
      showToast('파일을 다운로드할 수 없습니다.', 'error');
    } finally {
      setDownloadingAll(false);
    }
  };

  if (loading) return <div className="text-center py-20"><div className="spinner text-primary" /></div>;
  if (!post) return <div className="text-center py-20 text-muted">게시글을 찾을 수 없습니다.</div>;

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
          목록으로
        </Button>

        {isAuthorOrAdmin && (
          <div className="flex items-center gap-2">
            <Link to={isGlobal ? `/boards/${boardType}/${postId}/edit` : `/projects/${id}/board/${postId}/edit`}>
              <Button variant="outline" size="sm" icon={Edit2}>수정</Button>
            </Link>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleDelete}>삭제</Button>
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
              {post.category === 'notice' ? '공지사항' : post.category === 'resource' ? '자료실' : '일반'}
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
          </div>
        </div>

        <CardBody className="p-0">
          <div 
            className="p-6 text-sm leading-relaxed break-words text-foreground prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content || '' }}
          />

          <AttachmentList 
            attachments={attachments} 
            className="mx-6 mb-6" 
            onDownloadAll={handleDownloadAll} 
          />
        </CardBody>
      </Card>

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
    </div>
  );
}
