import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown,
  Trash2, CheckSquare, Square, Minus, Newspaper, BookOpen,
  Rows, Columns, Menu, User, Calendar, Clock, Edit2, FileText, X
} from 'lucide-react';
import { api, fetchBlobUrl } from 'shared/lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { Pagination } from 'ui/Pagination';
import { AttachmentList } from 'ui/AttachmentList';
import { PostComments } from '../../components/boards/PostComments';
import type { Post, Attachment } from 'shared/types';

interface BoardPost {
  id: string;
  board_type: string;
  title: string;
  author_name: string;
  created_at: string;
  content: string;
}

type SortKey = keyof BoardPost;
type SearchCategory = 'title' | 'title_content' | 'author';
type SplitLayout = 'columns' | 'rows' | 'list';

export default function GlobalBoardList() {
  const { formatDate, formatTime, t } = useLanguage();
  const { boardType } = useParams<{ boardType: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const toolbarRef = useRef<HTMLDivElement>(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  // 목록 상태
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('title');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDropdown, setActiveDropdown] = useState<'delete' | null>(null);

  // 분할 뷰 상태
  const [splitLayout, setSplitLayout] = useState<SplitLayout>(() => {
    const saved = localStorage.getItem('board_splitLayout');
    if (saved === 'columns' || saved === 'rows' || saved === 'list') return saved;
    return 'columns';
  });
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('board_leftWidth');
    return saved ? Number(saved) : 42;
  });
  const [topHeight, setTopHeight] = useState<number>(() => {
    const saved = localStorage.getItem('board_topHeight');
    return saved ? Number(saved) : 50;
  });

  // 상세 패널 상태
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [postDetail, setPostDetail] = useState<Post | null>(null);
  const [postAttachments, setPostAttachments] = useState<Attachment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const isNotice = boardType === 'notice';
  const pageTitle = isNotice ? t('notices') || '공지사항' : t('resources') || '자료실';

  // 데이터 로드
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/posts?is_global=true&category=${boardType}`);
      const json = await res.json();
      if (json.success) {
        setPosts(json.data);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Failed to fetch board posts:', err);
    } finally {
      setLoading(false);
    }
  }, [boardType]);

  useEffect(() => {
    if (boardType !== 'notice' && boardType !== 'resource') {
      navigate('/dashboard');
      return;
    }
    fetchPosts();
  }, [boardType, fetchPosts, navigate]);

  // boardType 변경 또는 사이드바 메뉴 클릭 시 상세 패널 초기화
  useEffect(() => {
    setSelectedPost(null);
    setPostDetail(null);
    setPostAttachments([]);
    setSelectedIds(new Set());
  }, [boardType, location.key]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // body 스크롤 차단 (분할 뷰 전체 화면)
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // splitLayout localStorage 영속화
  useEffect(() => {
    localStorage.setItem('board_splitLayout', splitLayout);
  }, [splitLayout]);

  // 필터링 + 정렬
  const filteredPosts = posts.filter(post => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    switch (searchCategory) {
      case 'title': return post.title.toLowerCase().includes(term);
      case 'title_content': return post.title.toLowerCase().includes(term) || (post.content || '').toLowerCase().includes(term);
      case 'author': return post.author_name.toLowerCase().includes(term);
      default: return true;
    }
  }).sort((a, b) => {
    const { key, direction } = sortConfig;
    const valA = a[key] ?? '';
    const valB = b[key] ?? '';
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalCount = filteredPosts.length;
  const pagedPosts = filteredPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 항목 클릭 → list 모드는 슬라이드-오버, 분할 모드는 인라인 상세
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

  // 분할 화면일 때 첫 번째 게시글 자동 선택
  useEffect(() => {
    if (splitLayout !== 'list' && !loading && pagedPosts.length > 0 && !selectedPost) {
      handleOpenDetail(pagedPosts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitLayout, loading, pagedPosts, selectedPost]);

  // ESC 키로 상세보기 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
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
  }, [selectedPost]);

  // 상세 패널에서 삭제
  const handleDeleteInPanel = async () => {
    if (!postDetail) return;
    if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return;
    try {
      const res = await api(`/api/posts/${postDetail.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('게시글이 삭제되었습니다.', 'success');
        setSelectedPost(null);
        setPostDetail(null);
        setPostAttachments([]);
        fetchPosts();
      } else {
        showToast('삭제 실패', 'error');
      }
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // 첨부파일 일괄 다운로드
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
      showToast('파일을 다운로드할 수 없습니다.', 'error');
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
      link.download = `attachments_selected.zip`;
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

  // 정렬 토글
  const handleSort = (key: SortKey) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' }
    );
    setCurrentPage(1);
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown size={11} className="text-[var(--text-muted)] opacity-50" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={11} className="text-[var(--primary)]" />
      : <ChevronDown size={11} className="text-[var(--primary)]" />;
  };

  // 체크박스 (admin 전용)
  const allSelected = pagedPosts.length > 0 && pagedPosts.every(p => selectedIds.has(p.id));
  const someSelected = pagedPosts.some(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagedPosts.map(p => p.id)));
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개의 게시글을 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => api(`/api/posts/${id}`, { method: 'DELETE' })));
      showToast(`${selectedIds.size}개의 게시글을 삭제했습니다.`, 'success');
      if (selectedPost && selectedIds.has(selectedPost.id)) {
        setSelectedPost(null);
        setPostDetail(null);
        setPostAttachments([]);
      }
      fetchPosts();
    } catch (err) {
      console.error('Failed to batch delete posts:', err);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
    setActiveDropdown(null);
  };

  // 드래그 리사이저
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = leftWidth;
    const startHeight = topHeight;

    const doResize = (moveEvent: MouseEvent) => {
      const container = document.getElementById('board-split-container');
      if (!container) return;
      if (splitLayout === 'columns') {
        const containerWidth = container.getBoundingClientRect().width;
        const deltaPercent = ((moveEvent.clientX - startX) / containerWidth) * 100;
        const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80);
        setLeftWidth(newWidth);
        localStorage.setItem('board_leftWidth', String(newWidth));
      } else if (splitLayout === 'rows') {
        const containerHeight = container.getBoundingClientRect().height;
        const deltaPercent = ((moveEvent.clientY - startY) / containerHeight) * 100;
        const newHeight = Math.min(Math.max(startHeight + deltaPercent, 20), 80);
        setTopHeight(newHeight);
        localStorage.setItem('board_topHeight', String(newHeight));
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

  // 컬럼 수 (로딩/빈 상태 colSpan)
  const colSpan = splitLayout === 'list'
    ? (isAdmin ? 5 : 4)
    : (isAdmin ? 4 : 3);

  const isAuthorOrAdmin = postDetail && (String(currentUser.id) === String(postDetail.author_id) || isAdmin);

  // ── 상세 패널 내용 렌더링 (inline / slide-over 공용) ──────────────
  const renderDetailContent = () => {
    if (detailLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3 bg-[var(--bg-surface-2)]/20">
          <RefreshCw size={22} className="animate-spin text-[var(--primary)]" />
          <p className="text-xs font-medium">{t('loading') || '불러오는 중...'}</p>
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
                <span className={`px-2 py-0.5 text-xs font-bold rounded border ${
                  postDetail.category === 'notice'
                    ? 'bg-red-50 text-red-500 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                    : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                }`}>
                  {postDetail.category === 'notice' ? (t('notices') || '공지사항') : (t('resources') || '자료실')}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">#{postDetail.id}</span>
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-2">{postDetail.title}</h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAuthorOrAdmin && (
                <>
                  <button
                    onClick={() => navigate(`/boards/${boardType}/${postDetail.id}/edit`)}
                    className="flex items-center gap-1 px-2 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] rounded text-[var(--text-secondary)] transition-all cursor-pointer bg-[var(--bg-surface)] text-xs font-semibold"
                  >
                    <Edit2 size={11} />
                    {t('edit')}
                  </button>
                  <button
                    onClick={handleDeleteInPanel}
                    className="flex items-center gap-1 px-2 py-1.5 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-red-500 transition-all cursor-pointer bg-[var(--bg-surface)] text-xs font-semibold"
                  >
                    <Trash2 size={11} />
                    {t('delete')}
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelectedPost(null); setPostDetail(null); setPostAttachments([]); }}
                className="p-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] rounded text-[var(--text-muted)] transition-all cursor-pointer bg-[var(--bg-surface)]"
                title={t('close') || '닫기'}
              >
                <X size={12} />
              </button>
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
              dangerouslySetInnerHTML={{ __html: postDetail.content || '' }}
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
          <p className="text-xs font-bold text-[var(--text-secondary)]">{t('noPostSelected') || '선택된 게시글이 없습니다.'}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('selectPostFromList') || '목록에서 게시글을 선택하세요.'}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100vh-105px)] animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border)] shadow-sm">

      {/* 상단 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          {isNotice
            ? <Newspaper size={16} className="text-[var(--primary)]" />
            : <BookOpen size={16} className="text-[var(--primary)]" />
          }
          {pageTitle}
        </h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate(`/boards/${boardType}/new`)}
            className="h-[34px] px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
          >
            <Plus size={13} />
            {t('newPost') || '새 글 작성'}
          </button>
        )}
      </div>

      {/* 툴바 */}
      <div ref={toolbarRef} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)] shrink-0 text-xs select-none">

        {/* 좌측: 검색 + 배치 액션 */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <select
            value={searchCategory}
            onChange={(e) => { setSearchCategory(e.target.value as SearchCategory); setCurrentPage(1); }}
            className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
          >
            <option value="title">{t('title') || '제목'}</option>
            <option value="title_content">{`${t('title') || '제목'}+${t('content') || '내용'}`}</option>
            <option value="author">{t('author') || '작성자'}</option>
          </select>

          <div className="relative">
            <input
              type="text"
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-2 pr-7 py-1 h-8 w-44 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)]"
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
                  삭제
                </button>
                {activeDropdown === 'delete' && (
                  <div className="absolute left-0 mt-1 w-40 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={handleBatchDelete}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                    >
                      <Trash2 size={11} className="opacity-70" />
                      선택 항목 삭제
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
            전체 <b className="text-[var(--text-primary)]">{totalCount}</b>건
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[var(--primary)] font-bold">{selectedIds.size}개 선택</span>
            )}
          </span>
          {/* 분할 뷰 토글 */}
          <div className="flex items-center border border-[var(--border)] rounded bg-[var(--bg-surface)] p-0.5">
            <button
              onClick={() => setSplitLayout('rows')}
              className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'rows' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
              title="가로 분할"
            >
              <Rows size={12} />
            </button>
            <button
              onClick={() => setSplitLayout('columns')}
              className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'columns' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
              title="세로 분할"
            >
              <Columns size={12} />
            </button>
            <button
              onClick={() => setSplitLayout('list')}
              className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'list' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
              title="목록만 보기"
            >
              <Menu size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 메인 분할 영역 */}
      <div
        id="board-split-container"
        className={`flex-1 overflow-hidden flex min-h-0 ${splitLayout === 'rows' ? 'flex-col' : 'flex-row'}`}
      >

        {/* 목록 패널 */}
        <div
          style={
            splitLayout === 'columns' ? { width: `${leftWidth}%` } :
            splitLayout === 'rows' ? { height: `${topHeight}%` } : {}
          }
          className={`flex flex-col overflow-hidden min-w-[240px] min-h-[100px] ${splitLayout === 'list' ? 'w-full' : ''}`}
        >
          {/* 테이블 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)]/50">
                  {isAdmin && (
                    <th className="w-10 p-2 text-center">
                      <div
                        className="flex items-center justify-center cursor-pointer p-1 rounded hover:bg-[var(--bg-surface-2)]"
                        onClick={toggleSelectAll}
                        title={allSelected ? '선택해제' : '전체선택'}
                      >
                        {allSelected
                          ? <CheckSquare size={14} className="text-[var(--primary)]" />
                          : someSelected
                            ? <Minus size={14} className="text-[var(--primary)]" />
                            : <Square size={14} className="text-[var(--text-muted)] opacity-60" />
                        }
                      </div>
                    </th>
                  )}
                  <th
                    className="w-14 p-2 text-center cursor-pointer select-none hover:bg-[var(--bg-surface-2)] transition-colors"
                    onClick={() => handleSort('id')}
                  >
                    <span className="flex items-center justify-center gap-1">번호 <SortIcon columnKey="id" /></span>
                  </th>
                  <th
                    className="p-2 pl-3 cursor-pointer select-none hover:bg-[var(--bg-surface-2)] transition-colors"
                    onClick={() => handleSort('title')}
                  >
                    <span className="flex items-center gap-1">{t('title') || '제목'} <SortIcon columnKey="title" /></span>
                  </th>
                  {splitLayout === 'list' && (
                    <>
                      <th
                        className="w-28 p-2 text-center cursor-pointer select-none hover:bg-[var(--bg-surface-2)] transition-colors"
                        onClick={() => handleSort('author_name')}
                      >
                        <span className="flex items-center justify-center gap-1">{t('author') || '작성자'} <SortIcon columnKey="author_name" /></span>
                      </th>
                      <th
                        className="w-36 p-2 text-right pr-4 cursor-pointer select-none hover:bg-[var(--bg-surface-2)] transition-colors"
                        onClick={() => handleSort('created_at')}
                      >
                        <span className="flex items-center justify-end gap-1">{t('created_at') || '작성일'} <SortIcon columnKey="created_at" /></span>
                      </th>
                    </>
                  )}
                  {splitLayout !== 'list' && (
                    <th
                      className="w-24 p-2 text-right pr-3 cursor-pointer select-none hover:bg-[var(--bg-surface-2)] transition-colors"
                      onClick={() => handleSort('created_at')}
                    >
                      <span className="flex items-center justify-end gap-1">날짜 <SortIcon columnKey="created_at" /></span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={colSpan} className="py-20 text-center text-[var(--text-muted)]">
                      <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-[var(--primary)]" />
                      <p className="font-medium text-xs mt-2">로딩 중...</p>
                    </td>
                  </tr>
                ) : pagedPosts.length > 0 ? (
                  pagedPosts.map((post, index) => {
                    const ordinal = (currentPage - 1) * pageSize + index + 1;
                    const isChecked = selectedIds.has(post.id);
                    const isActive = selectedPost?.id === post.id && splitLayout !== 'list';
                    return (
                      <tr
                        key={post.id}
                        onClick={() => handleOpenDetail(post)}
                        className={`cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[var(--primary)]/10'
                            : isChecked
                              ? 'bg-[var(--primary)]/5'
                              : 'hover:bg-[var(--bg-surface-2)]/50'
                        }`}
                      >
                        {isAdmin && (
                          <td className="p-2 text-center" onClick={(e) => toggleSelectRow(post.id, e)}>
                            <div className="flex items-center justify-center">
                              {isChecked
                                ? <CheckSquare size={14} className="text-[var(--primary)]" />
                                : <Square size={14} className="text-[var(--text-muted)] opacity-65" />
                              }
                            </div>
                          </td>
                        )}
                        <td className="p-2 text-center font-mono text-xs text-[var(--text-muted)]">{ordinal}</td>
                        <td className="p-2 pl-3 min-w-0">
                          {splitLayout !== 'list' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-xs truncate font-semibold ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                                {post.title}
                              </span>
                              <span className="text-xs text-[var(--text-muted)] truncate">{post.author_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-[var(--text-primary)] truncate block">{post.title}</span>
                          )}
                        </td>
                        {splitLayout === 'list' ? (
                          <>
                            <td className="p-2 text-center text-xs text-[var(--text-secondary)] font-medium">{post.author_name}</td>
                            <td className="p-2 pr-4 text-right text-xs text-[var(--text-muted)] font-medium">{formatDate(post.created_at)}</td>
                          </>
                        ) : (
                          <td className="p-2 pr-3 text-right text-xs text-[var(--text-muted)] font-medium">{formatDate(post.created_at)}</td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={colSpan} className="py-24 text-center text-[var(--text-muted)] font-medium text-xs">
                      {t('noPosts') || '등록된 게시글이 없습니다.'}
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
                pageSizeOptions={[10, 20, 30, 50, 100]}
                blockSize={10}
              />
            </div>
          )}
        </div>

        {/* 드래그 리사이저 */}
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
    </div>
  );
}
