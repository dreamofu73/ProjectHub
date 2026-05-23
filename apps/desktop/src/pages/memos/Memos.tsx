import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';
import { Inbox, Clock, Archive, Trash2, Award, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Memo, User, FolderType } from 'shared/types';
import { useMemoBatchActions } from './hooks/useMemoBatchActions';
import { useMemoCompose } from './hooks/useMemoCompose';
import { useMemos } from './hooks/useMemos';
import { useMemoActions } from './hooks/useMemoActions';
import { MemoList } from './components/MemoList';
import { MemoToolbar } from './components/MemoToolbar';
import { MemoDetailModal } from './components/MemoDetailModal';
import { MemoComposeForm } from './components/MemoComposeForm';

import { Pagination } from 'ui/Pagination';

export default function MemosPage() {
  const { t, formatDateTime } = useLanguage();
  const { showToast } = useToast();

  const [searchParams] = useSearchParams();
  const currentFolder = (searchParams.get('folder') as FolderType) || 'received';
  
  // Auth state
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id || null;
  const isFirstRender = useRef(true);

  // Data fetching hook
  const { 
    memos, 
    setMemos, 
    loading, 
    customFolders, 
    fetchMemos,
    page,
    setPage,
    pageSize,
    setPageSize,
    total 
  } = useMemos(currentFolder, currentUserId);

  // UI state
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [splitLayout, setSplitLayout] = useState<'columns' | 'rows' | 'list'>(() => {
    const saved = localStorage.getItem('memo_splitLayout');
    if (saved === 'columns' || saved === 'rows' || saved === 'list') return saved;
    return 'columns';
  });
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'sender' | 'title' | 'content'>('all');
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');

  const [blockedSenders, setBlockedSenders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('blocked_senders') || '[]');
    } catch {
      return [];
    }
  });

  const [_isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);

  // Memo Actions hook
  const {
    handleExtendExpiry,
    handleArchiveToggle,
    handleSpamToggle,
    handleMoveFolder,
    handleDeleteMemo,
    handleRestoreMemo,
  } = useMemoActions({
    currentFolder,
    selectedMemo,
    setSelectedMemo,
    setIsDetailOpen,
    fetchMemos,
  });

  const handleBlockSender = useCallback((senderLogin: string) => {
    if (!senderLogin) return;
    if (window.confirm(`${senderLogin} 님을 차단하시겠습니까?\n차단하시면 해당 사용자가 보낸 쪽지가 목록에서 보이지 않습니다.`)) {
      setBlockedSenders(prev => {
        const next = prev.includes(senderLogin) ? prev : [...prev, senderLogin];
        localStorage.setItem('blocked_senders', JSON.stringify(next));
        return next;
      });
      showToast(`${senderLogin} 님이 차단되었습니다.`, 'success');
      setSelectedMemo(null);
    }
  }, [showToast]);

  // 화면 분할 조절 상태
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('memo_leftWidth');
    return saved ? Number(saved) : 45;
  });
  const [topHeight, setTopHeight] = useState<number>(() => {
    const saved = localStorage.getItem('memo_topHeight');
    return saved ? Number(saved) : 50;
  });

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = leftWidth;
    const startHeight = topHeight;

    const doResize = (moveEvent: MouseEvent) => {
      const container = document.getElementById('memo-split-container');
      if (!container) return;

      if (splitLayout === 'columns') {
        const containerWidth = container.getBoundingClientRect().width;
        const deltaX = moveEvent.clientX - startX;
        const deltaPercent = (deltaX / containerWidth) * 100;
        const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80);
        setLeftWidth(newWidth);
        localStorage.setItem('memo_leftWidth', String(newWidth));
      } else if (splitLayout === 'rows') {
        const containerHeight = container.getBoundingClientRect().height;
        const deltaY = moveEvent.clientY - startY;
        const deltaPercent = (deltaY / containerHeight) * 100;
        const newHeight = Math.min(Math.max(startHeight + deltaPercent, 20), 80);
        setTopHeight(newHeight);
        localStorage.setItem('memo_topHeight', String(newHeight));
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

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      const res = await api('/api/users');
      const json = await res.json();
      if (json.success) {
        const filtered = (json.data || []).filter((u: User) => u.id !== currentUserId);
        setUsers(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filtering logic
  const filteredMemos = useMemo(() => {
    return memos.filter(m => {
      if (m.sender_login && blockedSenders.includes(m.sender_login)) {
        return false;
      }
      if (filterType === 'unread' && m.is_read !== 0) return false;
      if (!searchQuery.trim()) return true;
      
      const q = searchQuery.toLowerCase();
      const titleMatch = m.title.toLowerCase().includes(q);
      const contentMatch = m.content.toLowerCase().includes(q);
      const senderName = `${m.sender_lastname || ''}${m.sender_firstname || ''} ${m.sender_login || ''}`.toLowerCase();
      
      if (searchCategory === 'title') return titleMatch;
      if (searchCategory === 'content') return contentMatch;
      if (searchCategory === 'sender') return senderName.includes(q);
      
      return titleMatch || contentMatch || senderName.includes(q);
    });
  }, [memos, filterType, searchQuery, searchCategory, blockedSenders]);

  const unreadCount = useMemo(() => memos.filter(m => m.is_read === 0 && m.receiver_id === currentUserId).length, [memos, currentUserId]);
  const isFiltering = searchQuery.trim() !== '' || filterType === 'unread';
  const displayTotal = isFiltering ? filteredMemos.length : total;

  const {
    selectedIds,
    setSelectedIds,
    clearSelection,
    toggleSelectRow,
    toggleSelectAll,
    handleBatchDelete,
    handleBatchRestore,
    handleBatchMove,
    handleBatchArchive,
  } = useMemoBatchActions({
    currentFolder,
    showToast,
    fetchMemos,
    filteredMemos,
  });

  const handleBatchMarkAsUnread = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await api('/api/memos/batch/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo_ids: Array.from(selectedIds),
          is_read: 0
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('선택한 쪽지를 안읽음 처리했습니다.', 'success');
        setSelectedIds(new Set());
        fetchMemos();
        window.dispatchEvent(new CustomEvent('memo_read_update'));
      }
    } catch (err) {
      console.error('Failed to mark unread:', err);
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await api('/api/memos/batch/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo_ids: Array.from(selectedIds),
          is_read: 1
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('선택한 쪽지를 읽음 처리했습니다.', 'success');
        setSelectedIds(new Set());
        fetchMemos();
        window.dispatchEvent(new CustomEvent('memo_read_update'));
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const {
    isComposeOpen,
    setIsComposeOpen,
    recipients,
    setRecipients,
    title,
    setTitle,
    content,
    setContent,
    sending,
    recipientSearch,
    setRecipientSearch,
    isSelfWriteMode,
    attachedFiles,
    setAttachedFiles,
    filteredUsers,
    handleSendMemo,
    handleReply,
    isReservedSend,
    setIsReservedSend,
    reservedDate,
    setReservedDate,
  } = useMemoCompose({
    currentUserId,
    users,
    showToast,
    fetchMemos,
    t,
    formatDateTime,
    setIsDetailOpen,
  });

  const existingRecipientIds = useMemo(
    () => new Set(recipients.map(r => r.id)),
    [recipients]
  );

  const navigate = useNavigate();
  const handleOpenDetail = async (memo: Memo) => {
    setIsDetailOpen(true);
    try {
      const res = await api(`/api/memos/${memo.id}`);
      const json = await res.json();
      if (json.success) {
        setSelectedMemo(json.data);
        if (memo.receiver_id === currentUserId && memo.is_read === 0) {
          setMemos(prev =>
            prev.map(m => (m.id === memo.id ? { ...m, is_read: 1 } : m))
          );
          window.dispatchEvent(new CustomEvent('memo_read_update'));
        }
      } else {
        setSelectedMemo(memo);
      }
    } catch (err) {
      console.error('Failed to fetch memo detail:', err);
      setSelectedMemo(memo);
    }
  };

  // 첫 번째 쪽지 자동 열기
  useEffect(() => {
    if (splitLayout !== 'list' && !loading && filteredMemos.length > 0 && !selectedMemo && !isComposeOpen) {
      handleOpenDetail(filteredMemos[0]);
    }
  }, [splitLayout, loading, filteredMemos, selectedMemo, isComposeOpen]);

  // ESC 키로 상세보기 비활성화 (리스트만 보기로 전환)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 작성창이 열려 있으면 무시
      if (isComposeOpen) return;
      // 입력 요소에 포커스가 있으면 무시
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      // 상세보기가 활성 상태일 때만 동작
      if (!selectedMemo) return;
      e.preventDefault();
      setSelectedMemo(null);
      // 'list' 모드('리스트만 보기')로 전환하여 자동 선택이 즉시 재실행되지 않도록 함
      setSplitLayout('list');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMemo, isComposeOpen]);

  const baseFolders: { key: FolderType; label: string; icon: LucideIcon }[] = [
    { key: 'received', label: t('receivedMemos'), icon: Inbox },
    { key: 'self', label: '내게쓴쪽지함', icon: Award },
    { key: 'sent', label: t('sentMemos'), icon: Send },
    { key: 'reserved', label: '예약 쪽지함', icon: Clock },
    { key: 'archived', label: '쪽지 보관함', icon: Archive },
    { key: 'trash', label: '휴지통', icon: Trash2 },
  ];

  const getFolderName = (folder: FolderType) => {
    if (folder.startsWith('folder_')) {
      const id = folder.replace('folder_', '');
      const f = customFolders.find(cf => cf.id === id);
      return f ? f.name : '폴더';
    }
    const found = baseFolders.find(f => f.key === folder);
    return found ? found.label : '';
  };

  // 폴더(searchParams)가 바뀌면 작성창 닫기 및 상세화면 초기화
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsComposeOpen(false);
    setSelectedMemo(null);
    setIsDetailOpen(false);
  }, [currentFolder]);

  // 레이아웃 모드 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('memo_splitLayout', splitLayout);
  }, [splitLayout]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="w-full h-[calc(100vh-105px)] animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border)] shadow-sm">
      
      {/* 상단 네비게이션 & 액션 바 */}
      {!isComposeOpen && (
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Inbox size={16} className="text-[var(--primary)]" />
              <span>쪽지함</span>
            </h2>
            {/* 폴더 선택기 */}
            <div className="relative">
              <select
                value={currentFolder}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('folder', e.target.value);
                  const pathSegments = location.pathname.split('/').filter(Boolean);
                  const projectId = pathSegments[0] === 'projects' ? pathSegments[1] : null;
                  navigate(projectId ? `/projects/${projectId}/memos?${params.toString()}` : `/memos?${params.toString()}`);
                }}
                className="h-8.5 px-3.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface-2)] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 text-[var(--text-secondary)] cursor-pointer"
              >
                <optgroup label="기본 쪽지함" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {baseFolders.map(f => (
                    <option key={f.key} value={f.key} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                      {f.label} {f.key === 'received' && unreadCount > 0 ? ` (${unreadCount})` : ''}
                    </option>
                  ))}
                </optgroup>
                {customFolders.length > 0 && (
                  <optgroup label="개인 폴더" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {customFolders.map(f => (
                      <option key={f.id} value={`folder_${f.id}`} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{f.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* 작성 액션 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsComposeOpen(true);
                window.dispatchEvent(new CustomEvent('open_compose_memo', { detail: { self: false } }));
              }}
              className="h-8.5 px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
            >
              <Send size={13} />
              쪽지 쓰기
            </button>
            <button
              type="button"
              onClick={() => {
                setIsComposeOpen(true);
                window.dispatchEvent(new CustomEvent('open_compose_memo', { detail: { self: true } }));
              }}
              className="h-8.5 px-3.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] rounded-xl text-xs font-bold transition-all cursor-pointer bg-[var(--bg-surface)] flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Award size={13} />
              내게 쓰기
            </button>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden bg-[var(--bg-surface)]">
        
        {isComposeOpen ? (
          /* 쪽지 작성 폼 */
          <MemoComposeForm
            isSelfWriteMode={isSelfWriteMode}
            currentUser={currentUser}
            recipients={recipients}
            setRecipients={setRecipients}
            recipientSearch={recipientSearch}
            setRecipientSearch={setRecipientSearch}
            filteredUsers={filteredUsers}
            title={title}
            setTitle={setTitle}
            isReservedSend={isReservedSend}
            setIsReservedSend={setIsReservedSend}
            reservedDate={reservedDate}
            setReservedDate={setReservedDate}
            content={content}
            setContent={setContent}
            attachedFiles={attachedFiles}
            setAttachedFiles={setAttachedFiles}
            sending={sending}
            handleSendMemo={handleSendMemo}
            setIsComposeOpen={setIsComposeOpen}
            existingRecipientIds={existingRecipientIds}
            t={t}
          />
        ) : (
          /* 쪽지 탐색 모드 */
          <div className="flex flex-col flex-1 overflow-hidden p-5 gap-4">
              <MemoToolbar
            searchCategory={searchCategory}
            setSearchCategory={setSearchCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            getFolderName={getFolderName}
            currentFolder={currentFolder}
            unreadCount={unreadCount}
            totalCount={displayTotal}
            toggleSelectAll={toggleSelectAll}
            clearSelection={clearSelection}
            filteredMemos={filteredMemos}
            selectedIds={selectedIds}
            handleBatchDelete={handleBatchDelete}
            handleBatchArchive={handleBatchArchive}
            handleBatchRestore={handleBatchRestore}
            isFolderDropdownOpen={isFolderDropdownOpen}
            setIsFolderDropdownOpen={setIsFolderDropdownOpen}
            customFolders={customFolders}
            handleBatchMove={handleBatchMove}
            handleReply={handleReply}
            memos={memos}
            filterType={filterType}
            setFilterType={setFilterType}
            handleBatchMarkAsUnread={handleBatchMarkAsUnread}
            handleBatchMarkAsRead={handleBatchMarkAsRead}
            splitLayout={splitLayout}
            onSplitLayoutChange={setSplitLayout}
          />

          {/* 목록 + 상세 분할 영역 */}
          <div id="memo-split-container" className={`flex-1 overflow-hidden flex min-h-0 ${splitLayout === 'rows' ? 'flex-col' : 'flex-row'}`}>

              {/* 목록 영역 */}
              <div
                style={
                  splitLayout === 'columns'
                    ? { width: `${leftWidth}%` }
                    : splitLayout === 'rows'
                    ? { height: `${topHeight}%` }
                    : {}
                }
                className={`flex flex-col overflow-hidden border-[var(--border)] min-w-[280px] min-h-[150px] ${splitLayout === 'list' ? 'w-full' : ''}`}
              >
                <MemoList
                  memos={filteredMemos}
                  loading={loading}
                  currentFolder={currentFolder}
                  currentUserId={currentUserId}
                  selectedIds={selectedIds}
                  toggleSelectRow={toggleSelectRow}
                  toggleSelectAll={toggleSelectAll}
                  handleOpenDetail={handleOpenDetail}
                  handleRestoreMemo={handleRestoreMemo}
                  handleArchiveToggle={handleArchiveToggle}
                  handleSpamToggle={handleSpamToggle}
                />
                
                {/* 페이지네이션 */}
                {!loading && displayTotal > 0 && (
                  <div className="border-t border-[var(--border)] relative shrink-0">
                    <Pagination
                      currentPage={page}
                      totalCount={displayTotal}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={(l: number) => setPageSize(l)}
                      pageSizeOptions={[10, 20, 30, 50, 100]}
                      blockSize={splitLayout === 'columns' ? 5 : 10}
                    />
                  </div>
                )}
              </div>

              {/* Resizer 바 */}
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

              {/* 우측/하단 상세 패널 */}
              {splitLayout !== 'list' && (
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--bg-surface)]">
                  {selectedMemo ? (
                    <MemoDetailModal
                      memo={selectedMemo}
                      onClose={() => { setSelectedMemo(null); }}
                      currentFolder={currentFolder}
                      currentUserId={currentUserId}
                      customFolders={customFolders}
                      handleDeleteMemo={handleDeleteMemo}
                      handleRestoreMemo={handleRestoreMemo}
                      handleReply={handleReply}
                      handleMoveFolder={handleMoveFolder}
                      handleBlockSender={handleBlockSender}
                      handleExtendExpiry={handleExtendExpiry}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4 select-none bg-[var(--bg-surface-2)]/20">
                      <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center shadow-inner border border-[var(--border)]">
                        <Inbox size={24} className="text-[var(--text-muted)] opacity-60" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-[var(--text-secondary)]">선택된 쪽지가 없습니다.</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">목록에서 확인하려는 쪽지를 선택하세요.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 우측 상세 패널 (slide-over) - list 모드일 때만 ── */}
      {splitLayout === 'list' && selectedMemo && (
        <>
          {/* panel */}
          <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
            <MemoDetailModal
              memo={selectedMemo}
              onClose={() => setSelectedMemo(null)}
              currentFolder={currentFolder}
              currentUserId={currentUserId}
              customFolders={customFolders}
              handleDeleteMemo={handleDeleteMemo}
              handleRestoreMemo={handleRestoreMemo}
              handleReply={handleReply}
              handleMoveFolder={handleMoveFolder}
              handleBlockSender={handleBlockSender}
              handleExtendExpiry={handleExtendExpiry}
              showCloseButton={true}
            />
          </div>
        </>
      )}

      <style>{`
        .memo-detail-content table { border-collapse: collapse; width: 100% !important; margin: 1.5em 0; }
        .memo-detail-content th, .memo-detail-content td { border: 1px solid var(--border); padding: 8px 12px; min-width: 50px; text-align: left; }
        .memo-detail-content th { background-color: var(--bg-surface-2); font-weight: 600; }
        .memo-detail-content blockquote { border-left: 4px solid var(--primary); padding-left: 1rem; margin-left: 0; color: var(--text-muted); font-style: italic; }
        .memo-detail-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5em 0; }
        .memo-detail-content hr { border: 0; border-top: 1px solid var(--border); margin: 1.5em 0; }
      `}</style>
    </div>
  );
}
