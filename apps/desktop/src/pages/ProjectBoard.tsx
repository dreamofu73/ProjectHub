import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown,
  Trash2, CheckSquare, Square, Minus, FileText,
  Rows, Columns, Menu, User, Calendar, Clock, Edit2, X,
  Pin, Paperclip,
} from 'lucide-react';
import { api, fetchBlobUrl } from 'shared/lib/api';
import { sanitizeHtml } from 'shared/lib/sanitize';
import { useDebounce } from 'shared/hooks/useDebounce';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { Pagination } from 'ui/Pagination';
import { AttachmentList, formatFileSize } from 'ui/AttachmentList';
import { ConfirmDialog } from 'ui/ConfirmDialog';
import { PostComments } from '../components/boards/PostComments';
import type { Post, Attachment } from 'shared/types';

interface BoardPost {
  id: string;
  project_id: string;
  title: string;
  author_name: string;
  category: string;
  created_at: string;
  content: string;
  comment_count?: number;
  is_pinned?: boolean;
  view_count?: number;
  attachment_count?: number;
  attachment_total_size?: number;
}

type SortKey = keyof BoardPost;
type SearchCategory = 'title' | 'title_content' | 'author';
type SplitLayout = 'columns' | 'rows' | 'list';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

// 정렬 헤더 버튼 공통 스타일 (헤더 셀 전체를 차지하는 실제 button)
const SORT_BUTTON_CLASS = 'w-full flex items-center gap-1 bg-transparent border-none p-0 text-xs font-bold text-[var(--text-muted)] cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60';
const SKELETON_ROW_COUNT = 8;

export default function ProjectBoardPage() {
  const { formatDate, formatTime, t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const toolbarRef = useRef<HTMLDivElement>(null);

  const activeCategory = searchParams.get('category') || 'all';

  // ── 목록 상태 ──────────────────────────────────────────────────────
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('title');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDropdown, setActiveDropdown] = useState<'delete' | null>(null);
  // 삭제 확인 다이얼로그 (네이티브 confirm 대체)
  const [pendingDelete, setPendingDelete] = useState<'single' | 'batch' | null>(null);

  // ── 분할 뷰 상태 ────────────────────────────────────────────────────
  const [splitLayout, setSplitLayout] = useState<SplitLayout>(() => {
    const saved = localStorage.getItem('projectBoard_splitLayout');
    if (saved === 'columns' || saved === 'rows' || saved === 'list') return saved;
    return 'columns';
  });
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('projectBoard_leftWidth');
    return saved ? Number(saved) : 42;
  });
  const [topHeight, setTopHeight] = useState<number>(() => {
    const saved = localStorage.getItem('projectBoard_topHeight');
    return saved ? Number(saved) : 50;
  });

  // ── 상세 패널 상태 ──────────────────────────────────────────────────
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [postDetail, setPostDetail] = useState<Post | null>(null);
  const [postAttachments, setPostAttachments] = useState<Attachment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const isAuthorOrAdmin = postDetail && (String(currentUser.id) === String(postDetail.author_id) || isAdmin);

  // ── 카테고리 ────────────────────────────────────────────────────────
  const categories = [
    { id: 'all',      label: t('all') },
    { id: 'notice',   label: t('notices') },
    { id: 'resource', label: t('resources') },
    { id: 'general',  label: t('general') },
  ];

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'notice':   return <span className="px-2 py-0.5 text-xs font-bold rounded border bg-red-50 text-red-500 border-red-200 dark:bg-red-950/20 dark:border-red-800">{t('noticeShort')}</span>;
      case 'resource': return <span className="px-2 py-0.5 text-xs font-bold rounded border bg-green-50 text-green-600 border-green-200 dark:bg-green-950/20 dark:border-green-800">{t('resourceShort')}</span>;
      default:         return <span className="px-2 py-0.5 text-xs font-bold rounded border bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950/20 dark:border-slate-700">{t('general')}</span>;
    }
  };

  // ── 카테고리 변경 ───────────────────────────────────────────────────
  const handleCategoryChange = (cat: string) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (cat === 'all') p.delete('category'); else p.set('category', cat);
      p.set('page', '1');
      return p;
    });
    setSelectedIds(new Set());
  };

  // 검색 디바운스 — 매 키 입력마다 서버 요청이 나가지 않도록 지연시킵니다.
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const activeSearchTerm = debouncedSearchTerm.trim();

  // ── 데이터 fetch — 검색/정렬/페이징을 모두 서버에 위임 ────────────────
  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        project_id: id,
        page: String(currentPage),
        page_size: String(pageSize),
        sort_by: sortConfig.key,
        sort_dir: sortConfig.direction,
      });
      if (activeCategory !== 'all') query.set('category', activeCategory);
      if (activeSearchTerm) {
        query.set('search', activeSearchTerm);
        query.set('search_in', searchCategory);
      }
      const res = await api(`/api/posts?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPosts(json.data || []);
        setTotalCount(json.meta?.total ?? (json.data || []).length);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [id, activeCategory, currentPage, pageSize, sortConfig, activeSearchTerm, searchCategory]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 카테고리/게시글 변경 또는 사이드바 메뉴 클릭 시 상세 패널 초기화
  useEffect(() => {
    setSelectedPost(null);
    setPostDetail(null);
    setPostAttachments([]);
    setSelectedIds(new Set());
  }, [activeCategory, location.key]);

  // 외부 클릭 → 드롭다운 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // body 스크롤 차단
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // splitLayout localStorage
  useEffect(() => {
    localStorage.setItem('projectBoard_splitLayout', splitLayout);
  }, [splitLayout]);

  // 서버가 이미 검색·정렬·페이징을 마친 결과를 그대로 렌더합니다.
  const pagedPosts = posts;

  // ── 상세 패널 열기 ──────────────────────────────────────────────────
  const handleOpenDetail = async (post: BoardPost) => {
    setSelectedPost(post);
    setDetailLoading(true);
    setPostDetail(null);
    setPostAttachments([]);
    try {
      const [postRes, attachRes] = await Promise.all([
        api(`/api/posts/${post.id}`),
        api(`/api/posts/${post.id}/attachments`),
      ]);
      const [postJson, attachJson] = await Promise.all([postRes.json(), attachRes.json()]);
      if (postJson.success) setPostDetail(postJson.data);
      if (attachJson.success) setPostAttachments(attachJson.data);
    } catch (err) {
      console.error('Failed to fetch post detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── 분할 화면일 때 첫 번째 게시글 자동 선택 ─────────────────────────
  useEffect(() => {
    if (splitLayout !== 'list' && !loading && pagedPosts.length > 0 && !selectedPost) {
      handleOpenDetail(pagedPosts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitLayout, loading, pagedPosts, selectedPost]);

  // ── ESC 키로 상세보기 닫기 ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingDelete) return; // 확인 다이얼로그가 ESC를 처리
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (selectedPost) {
        e.preventDefault();
        setSelectedPost(null);
        setPostDetail(null);
        setPostAttachments([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPost, pendingDelete]);

  // ── 삭제 ────────────────────────────────────────────────────────────
  const handleDeleteInPanel = async () => {
    setPendingDelete(null);
    if (!postDetail) return;
    try {
      const res = await api(`/api/posts/${postDetail.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(t('postDeleted'), 'success');
        setSelectedPost(null);
        setPostDetail(null);
        setPostAttachments([]);
        fetchPosts();
      } else {
        showToast(t('deleteFail'), 'error');
      }
    } catch {
      showToast(t('deleteError'), 'error');
    }
  };

  // ── 첨부파일 다운로드 ───────────────────────────────────────────────
  const handleDownloadAll = async () => {
    if (downloadingAll || !postDetail) return;
    setDownloadingAll(true);
    try {
      const blobUrl = await fetchBlobUrl(`/api/attachments/batch-download?post_id=${postDetail.id}`);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `attachments_${postDetail.id}.zip`;
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

  const handleDownloadSelected = async (ids: string[]) => {
    if (downloadingAll || !postDetail || ids.length === 0) return;
    setDownloadingAll(true);
    try {
      const blobUrl = await fetchBlobUrl(`/api/attachments/batch-download?attachment_ids=${ids.join(',')}`);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'attachments_selected.zip';
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

  // ── 정렬 ────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' }
    );
    setCurrentPage(1);
  };

  // 렌더 중 컴포넌트를 새로 만들지 않도록 일반 렌더 함수로 유지합니다.
  const renderSortIcon = (columnKey: SortKey) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown size={11} className="text-[var(--text-muted)] opacity-50" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={11} className="text-[var(--primary)]" />
      : <ChevronDown size={11} className="text-[var(--primary)]" />;
  };

  const getAriaSort = (columnKey: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortConfig.key !== columnKey) return 'none';
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  // ── 체크박스 ────────────────────────────────────────────────────────
  const allSelected = pagedPosts.length > 0 && pagedPosts.every(p => selectedIds.has(p.id));
  const someSelected = pagedPosts.some(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagedPosts.map(p => p.id)));
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── 일괄 삭제 ──────────────────────────────────────────────────────
  const handleBatchDelete = async () => {
    setPendingDelete(null);
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map(postId => api(`/api/posts/${postId}`, { method: 'DELETE' })));
      showToast(t('postsDeletedCount').replace('{count}', String(selectedIds.size)), 'success');
      if (selectedPost && selectedIds.has(selectedPost.id)) {
        setSelectedPost(null);
        setPostDetail(null);
        setPostAttachments([]);
      }
      fetchPosts();
    } catch {
      showToast(t('deleteError'), 'error');
    }
    setActiveDropdown(null);
  };

  // ── 드래그 리사이저 ──────────────────────────────────────────────────
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = leftWidth;
    const startHeight = topHeight;

    const doResize = (moveEvent: MouseEvent) => {
      const container = document.getElementById('project-board-split-container');
      if (!container) return;
      if (splitLayout === 'columns') {
        const containerWidth = container.getBoundingClientRect().width;
        const deltaPercent = ((moveEvent.clientX - startX) / containerWidth) * 100;
        const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80);
        setLeftWidth(newWidth);
        localStorage.setItem('projectBoard_leftWidth', String(newWidth));
      } else if (splitLayout === 'rows') {
        const containerHeight = container.getBoundingClientRect().height;
        const deltaPercent = ((moveEvent.clientY - startY) / containerHeight) * 100;
        const newHeight = Math.min(Math.max(startHeight + deltaPercent, 20), 80);
        setTopHeight(newHeight);
        localStorage.setItem('projectBoard_topHeight', String(newHeight));
      }
    };

    const stopResize = () => {
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }, [leftWidth, topHeight, splitLayout]);

  // ── 컬럼 수 ─────────────────────────────────────────────────────────
  // list: #·제목·분류·작성자·첨부·댓글·조회·작성일 / split: #·분류·제목·날짜
  const colSpan = (isAdmin ? 1 : 0) + (splitLayout === 'list' ? 8 : 4);

  // ── 상세 패널 내용 렌더링 (inline / slide-over 공용) ──────────────
  const renderDetailContent = () => {
    if (detailLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3 bg-[var(--bg-surface-2)]/20">
          <RefreshCw size={22} className="animate-spin text-[var(--primary)]" />
          <p className="text-xs font-medium">{t('loading')}</p>
        </div>
      );
    }
    if (postDetail) {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          {/* 상세 헤더 */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {getCategoryBadge(postDetail.category)}
                <span className="text-xs text-[var(--text-muted)] font-mono">#{postDetail.id}</span>
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-2">{postDetail.title}</h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAuthorOrAdmin && (
                <>
                  <button
                    onClick={() => navigate(`/projects/${id}/board/${postDetail.id}/edit`)}
                    className="flex items-center gap-1 px-2 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] rounded text-[var(--text-secondary)] transition-all cursor-pointer bg-[var(--bg-surface)] text-xs font-semibold"
                  >
                    <Edit2 size={11} />
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => setPendingDelete('single')}
                    className="flex items-center gap-1 px-2 py-1.5 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-red-500 transition-all cursor-pointer bg-[var(--bg-surface)] text-xs font-semibold"
                  >
                    <Trash2 size={11} />
                    {t('delete')}
                  </button>
                </>
              )}
              {splitLayout === 'list' && (
                <button
                  onClick={() => { setSelectedPost(null); setPostDetail(null); setPostAttachments([]); }}
                  className="p-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] rounded text-[var(--text-muted)] transition-all cursor-pointer bg-[var(--bg-surface)]"
                  title={t('close')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* 메타 정보 */}
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/30">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <User size={11} className="text-[var(--primary)]" />
              <span className="font-semibold">{postDetail.author_name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Calendar size={11} />
              <span>{formatDate(postDetail.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Clock size={11} />
              <span>{formatTime(postDetail.created_at)}</span>
            </div>
          </div>

          {/* 본문 + 첨부파일 + 댓글 */}
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar flex flex-col">
            <div
              className="p-5 text-sm leading-relaxed break-words text-[var(--text-primary)] prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(postDetail.content || '') }}
            />
            {postAttachments.length > 0 && (
              <div className="px-5 pb-5">
                <AttachmentList
                  attachments={postAttachments}
                  onDownloadAll={handleDownloadAll}
                  onDownloadSelected={handleDownloadSelected}
                />
              </div>
            )}
          </div>
          {/* 댓글 섹션 */}
          <PostComments
            postId={postDetail.id}
            formatDate={formatDate}
            formatTime={formatTime}
            compact={true}
          />
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4 select-none bg-[var(--bg-surface-2)]/20">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center shadow-inner border border-[var(--border)]">
          <FileText size={24} className="text-[var(--text-muted)] opacity-60" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-[var(--text-secondary)]">{t('noPostSelected')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('selectPostFromList')}</p>
        </div>
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">

      {/* ── 상단 헤더 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={16} className="text-[var(--primary)]" />
            {t('board')}
          </h2>
          {/* 카테고리 칩 */}
          <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-[var(--border)]">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  activeCategory === cat.id
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/projects/${id}/board/new`)}
          className="h-[34px] px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
        >
          <Plus size={13} />
          {t('newPost')}
        </button>
      </div>

      {/* ── 툴바 ──────────────────────────────────────────────────── */}
      <div ref={toolbarRef} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)] shrink-0 text-xs select-none">

        {/* 좌측: 검색 + 배치 액션 */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <select
            value={searchCategory}
            onChange={(e) => { setSearchCategory(e.target.value as SearchCategory); setCurrentPage(1); }}
            aria-label={t('search')}
            className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60 focus-visible:border-[var(--primary)] text-[var(--text-primary)] cursor-pointer font-medium"
          >
            <option value="title">{t('title')}</option>
            <option value="title_content">{`${t('title')}+${t('content')}`}</option>
            <option value="author">{t('author')}</option>
          </select>

          <div className="relative">
            <input
              type="text"
              placeholder={`${t('search')}...`}
              aria-label={t('search')}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-2 pr-7 py-1 h-8 w-44 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60 focus-visible:border-[var(--primary)] text-[var(--text-primary)]"
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)]">
              <Search size={12} />
            </span>
          </div>

          {isAdmin && (
            <>
              <span className="text-[var(--border)] mx-1">|</span>
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(prev => prev === 'delete' ? null : 'delete')}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
                >
                  <Trash2 size={11} />
                  {t('delete')}
                </button>
                {activeDropdown === 'delete' && (
                  <div className="absolute left-0 mt-1 w-40 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={() => { setActiveDropdown(null); setPendingDelete('batch'); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                    >
                      <Trash2 size={11} className="opacity-70" />
                      {t('deleteSelectedItems')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 우측: 카운트 + 분할 뷰 토글 */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">
            {t('all')} <b className="text-[var(--text-primary)]">{totalCount}</b>{t('countUnit')}
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[var(--primary)] font-bold">{t('bulkSelectCount').replace('{count}', String(selectedIds.size))}</span>
            )}
          </span>
          <div className="flex items-center border border-[var(--border)] rounded bg-[var(--bg-surface)] p-0.5">
            <button
              onClick={() => setSplitLayout('rows')}
              className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'rows' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
              title={t('splitHorizontal')}
            >
              <Rows size={12} />
            </button>
            <button
              onClick={() => setSplitLayout('columns')}
              className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'columns' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
              title={t('splitVertical')}
            >
              <Columns size={12} />
            </button>
            <button
              onClick={() => setSplitLayout('list')}
              className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'list' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
              title={t('listViewOnly')}
            >
              <Menu size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 메인 분할 영역 ────────────────────────────────────────── */}
      <div
        id="project-board-split-container"
        className={`flex-1 overflow-hidden flex min-h-0 ${splitLayout === 'rows' ? 'flex-col' : 'flex-row'}`}
      >

        {/* ── 목록 패널 ─────────────────────────────────────────── */}
        <div
          style={
            splitLayout === 'columns' ? { width: `${leftWidth}%` } :
            splitLayout === 'rows' ? { height: `${topHeight}%` } : {}
          }
          className={`flex flex-col overflow-hidden min-w-[240px] min-h-[100px] h-full ${splitLayout === 'list' ? 'w-full flex-1' : ''}`}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)]/50">
                  {isAdmin && (
                    <th scope="col" className="w-10 p-2 text-center">
                      <label
                        className="flex items-center justify-center cursor-pointer p-1 rounded hover:bg-[var(--bg-surface-2)] focus-within:ring-2 focus-within:ring-[var(--primary)]/60"
                        title={allSelected ? t('deselectAll') : t('selectAll')}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                          onChange={toggleSelectAll}
                          aria-label={allSelected ? t('deselectAll') : t('selectAll')}
                        />
                        {allSelected
                          ? <CheckSquare size={14} className="text-[var(--primary)]" />
                          : someSelected
                            ? <Minus size={14} className="text-[var(--primary)]" />
                            : <Square size={14} className="text-[var(--text-muted)] opacity-60" />
                        }
                      </label>
                    </th>
                  )}
                  <th scope="col" aria-sort={getAriaSort('id')} className="w-12 p-2 text-center select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                    <button type="button" onClick={() => handleSort('id')} className={`${SORT_BUTTON_CLASS} justify-center`}>
                      # {renderSortIcon('id')}
                    </button>
                  </th>
                  {/* 분류 컬럼 (split 모드에서만) */}
                  {splitLayout !== 'list' && (
                    <th scope="col" className="w-16 p-2 text-center">{t('categoryLabel')}</th>
                  )}
                  <th scope="col" aria-sort={getAriaSort('title')} className="p-2 pl-3 select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                    <button type="button" onClick={() => handleSort('title')} className={SORT_BUTTON_CLASS}>
                      {t('title')} {renderSortIcon('title')}
                    </button>
                  </th>
                  {splitLayout === 'list' && (
                    <>
                      <th scope="col" aria-sort={getAriaSort('category')} className="w-16 p-2 text-center select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                        <button type="button" onClick={() => handleSort('category')} className={`${SORT_BUTTON_CLASS} justify-center`}>
                          {t('categoryLabel')} {renderSortIcon('category')}
                        </button>
                      </th>
                      <th scope="col" aria-sort={getAriaSort('author_name')} className="w-20 p-2 text-center select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                        <button type="button" onClick={() => handleSort('author_name')} className={`${SORT_BUTTON_CLASS} justify-center`}>
                          {t('author')} {renderSortIcon('author_name')}
                        </button>
                      </th>
                      <th scope="col" className="w-14 p-2 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Paperclip size={11} aria-hidden="true" />
                          {t('attachmentsLabel')}
                        </span>
                      </th>
                      <th scope="col" aria-sort={getAriaSort('comment_count')} className="w-10 p-2 text-center select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                        <button type="button" onClick={() => handleSort('comment_count')} className={`${SORT_BUTTON_CLASS} justify-center`}>
                          {t('comments')} {renderSortIcon('comment_count')}
                        </button>
                      </th>
                      <th scope="col" aria-sort={getAriaSort('view_count')} className="w-14 p-2 text-center select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                        <button type="button" onClick={() => handleSort('view_count')} className={`${SORT_BUTTON_CLASS} justify-center`}>
                          {t('views')} {renderSortIcon('view_count')}
                        </button>
                      </th>
                      <th scope="col" aria-sort={getAriaSort('created_at')} className="w-28 p-2 pr-4 select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                        <button type="button" onClick={() => handleSort('created_at')} className={`${SORT_BUTTON_CLASS} justify-end`}>
                          {t('created_at')} {renderSortIcon('created_at')}
                        </button>
                      </th>
                    </>
                  )}
                  {splitLayout !== 'list' && (
                    <th scope="col" aria-sort={getAriaSort('created_at')} className="w-20 p-2 pr-3 select-none hover:bg-[var(--bg-surface-2)] transition-colors">
                      <button type="button" onClick={() => handleSort('created_at')} className={`${SORT_BUTTON_CLASS} justify-end`}>
                        {t('date')} {renderSortIcon('created_at')}
                      </button>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]" aria-busy={loading}>
                {loading ? (
                  Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="animate-pulse" aria-hidden="true">
                      {isAdmin && (
                        <td className="p-2"><div className="h-3.5 w-3.5 mx-auto rounded bg-[var(--bg-surface-2)]" /></td>
                      )}
                      <td className="p-2"><div className="h-3 w-5 mx-auto rounded bg-[var(--bg-surface-2)]" /></td>
                      {splitLayout !== 'list' && (
                        <td className="p-2"><div className="h-4 w-10 mx-auto rounded bg-[var(--bg-surface-2)]" /></td>
                      )}
                      <td className="p-2 pl-3">
                        <div className="h-3 w-3/4 rounded bg-[var(--bg-surface-2)]" />
                        {splitLayout !== 'list' && <div className="h-2.5 w-1/3 mt-1.5 rounded bg-[var(--bg-surface-2)]" />}
                      </td>
                      {splitLayout === 'list' ? (
                        Array.from({ length: 6 }).map((_, cell) => (
                          <td key={`skeleton-cell-${cell}`} className="p-2">
                            <div className="h-3 w-12 mx-auto rounded bg-[var(--bg-surface-2)]" />
                          </td>
                        ))
                      ) : (
                        <td className="p-2 pr-3"><div className="h-3 w-14 ml-auto rounded bg-[var(--bg-surface-2)]" /></td>
                      )}
                    </tr>
                  ))
                ) : pagedPosts.length > 0 ? (
                  pagedPosts.map((post, index) => {
                    const ordinal = (currentPage - 1) * pageSize + index + 1;
                    const isChecked = selectedIds.has(post.id);
                    const isActive = selectedPost?.id === post.id && splitLayout !== 'list';
                    return (
                      <tr
                        key={post.id}
                        onClick={() => handleOpenDetail(post)}
                        className={`h-9 min-h-[36px] max-h-[36px] cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[var(--primary)]/10'
                            : isChecked
                              ? 'bg-[var(--primary)]/5'
                              : post.is_pinned
                                ? 'bg-[var(--bg-surface-2)]/60 hover:bg-[var(--bg-surface-2)]'
                                : 'hover:bg-[var(--bg-surface-2)]/50'
                        }`}
                      >
                        {isAdmin && (
                          <td className="h-9 py-1 px-2 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                            <label className="flex items-center justify-center cursor-pointer p-1 rounded focus-within:ring-2 focus-within:ring-[var(--primary)]/60">
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={isChecked}
                                onChange={() => toggleSelectRow(post.id)}
                                aria-label={`${post.title} — ${t('selectPost')}`}
                              />
                              {isChecked
                                ? <CheckSquare size={14} className="text-[var(--primary)]" />
                                : <Square size={14} className="text-[var(--text-muted)] opacity-65" />
                              }
                            </label>
                          </td>
                        )}
                        <td className="h-9 py-1 px-2 text-center font-mono text-xs text-[var(--text-muted)] align-middle">{ordinal}</td>
                        {splitLayout !== 'list' && (
                          <td className="h-9 py-1 px-2 text-center align-middle">{getCategoryBadge(post.category)}</td>
                        )}
                        <td className="h-9 py-1 px-2 pl-3 min-w-0 align-middle">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenDetail(post); }}
                            className="w-full min-w-0 text-left bg-transparent border-none p-0 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              {post.is_pinned && <Pin size={11} className="shrink-0 text-[var(--primary)]" aria-label={t('pinned')} />}
                              <span className={`text-xs font-semibold truncate ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>{post.title}</span>
                              {!!post.comment_count && (
                                <span className="shrink-0 text-xs text-[var(--text-muted)] font-medium">[{post.comment_count}]</span>
                              )}
                              {!!post.attachment_count && (
                                <span className="shrink-0 flex items-center gap-0.5 text-xs text-[var(--text-muted)] font-medium">
                                  <Paperclip size={10} aria-hidden="true" />{post.attachment_count}
                                </span>
                              )}
                            </span>
                          </button>
                        </td>
                        {splitLayout === 'list' && (
                          <>
                            <td className="h-9 py-1 px-2 text-center align-middle">{getCategoryBadge(post.category)}</td>
                            <td className="h-9 py-1 px-2 text-center text-xs text-[var(--text-secondary)] font-medium align-middle truncate">{post.author_name}</td>
                            <td className="h-9 py-1 px-2 text-center text-xs text-[var(--text-muted)] font-medium align-middle">
                              {post.attachment_count ? (
                                <span className="inline-flex items-center gap-1" title={formatFileSize(post.attachment_total_size || 0)}>
                                  <Paperclip size={11} aria-hidden="true" />
                                  {post.attachment_count}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="h-9 py-1 px-2 text-center text-xs text-[var(--text-muted)] font-medium align-middle">{post.comment_count || 0}</td>
                            <td className="h-9 py-1 px-2 text-center text-xs text-[var(--text-muted)] font-medium align-middle">{post.view_count ?? 0}</td>
                            <td className="h-9 py-1 px-2 pr-4 text-right text-xs text-[var(--text-muted)] font-medium align-middle">{formatDate(post.created_at)}</td>
                          </>
                        )}
                        {splitLayout !== 'list' && (
                          <td className="h-9 py-1 px-3 text-right text-xs text-[var(--text-muted)] font-medium align-middle">{formatDate(post.created_at)}</td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={colSpan} className="py-24 text-center text-[var(--text-muted)] font-medium text-xs">
                      {activeSearchTerm ? (
                        <div className="flex flex-col items-center gap-3">
                          <p>{t('noSearchResultsFor').replace('{term}', activeSearchTerm)}</p>
                          <button
                            type="button"
                            onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                            className="px-3 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
                          >
                            {t('clearSearch')}
                          </button>
                        </div>
                      ) : (
                        t('noPosts')
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {!loading && totalCount > 0 && (
            <div className="border-t border-[var(--border)] shrink-0">
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                blockSize={10}
              />
            </div>
          )}
        </div>

        {/* ── 드래그 리사이저 ────────────────────────────────────── */}
        {splitLayout !== 'list' && (
          <div
            onMouseDown={startResize}
            className={`bg-[var(--border)] hover:bg-[var(--primary)] transition-colors z-20 shrink-0 select-none ${
              splitLayout === 'columns'
                ? 'w-1 h-full cursor-col-resize mx-0.5'
                : 'h-1 w-full cursor-row-resize my-0.5'
            }`}
          />
        )}

        {/* ── 상세 패널 (inline, columns/rows 모드) ──────────────── */}
        {splitLayout !== 'list' && (
          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-sm ml-1.5">
            {renderDetailContent()}
          </div>
        )}

        {/* ── 슬라이드-오버 상세 패널 (list 모드) ──────────────────── */}
      {splitLayout === 'list' && selectedPost && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          {renderDetailContent()}
        </div>
      )}
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t('delete')}
        message={pendingDelete === 'batch'
          ? t('confirmBulkDeletePosts').replace('{count}', String(selectedIds.size))
          : t('confirmDeletePost')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={pendingDelete === 'batch' ? handleBatchDelete : handleDeleteInPanel}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
