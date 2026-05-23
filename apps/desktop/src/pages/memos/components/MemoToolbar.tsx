import { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Archive, RotateCcw, FolderInput, Folder, X, CornerUpLeft, Rows, Columns, Menu, MailOpen, ChevronDown } from 'lucide-react';
import type { CustomFolder, FolderType, Memo } from 'shared/types';

interface MemoToolbarProps {
  searchCategory: 'all' | 'sender' | 'title' | 'content';
  setSearchCategory: (val: 'all' | 'sender' | 'title' | 'content') => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  getFolderName: (folder: FolderType) => string;
  currentFolder: FolderType;
  unreadCount: number;
  totalCount: number;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  filteredMemos: Memo[];
  selectedIds: Set<string>;
  handleBatchDelete: () => void;
  handleBatchArchive: () => void;
  handleBatchRestore: () => void;
  isFolderDropdownOpen: boolean;
  setIsFolderDropdownOpen: (val: boolean) => void;
  customFolders: CustomFolder[];
  handleBatchMove: (folderId: string | null) => void;
  handleReply: (memo: Memo) => void;
  memos: Memo[];
  filterType: 'all' | 'unread';
  setFilterType: (val: 'all' | 'unread') => void;
  handleBatchMarkAsUnread: () => void;
  handleBatchMarkAsRead: () => void;
  splitLayout: 'columns' | 'rows' | 'list';
  onSplitLayoutChange: (layout: 'columns' | 'rows' | 'list') => void;
}

export function MemoToolbar({
  searchCategory,
  setSearchCategory,
  searchQuery,
  setSearchQuery,
  getFolderName,
  currentFolder,
  unreadCount,
  totalCount,
  selectedIds,
  handleBatchDelete,
  handleBatchArchive,
  handleBatchRestore,
  isFolderDropdownOpen,
  setIsFolderDropdownOpen,
  customFolders,
  handleBatchMove,
  handleReply,
  memos,
  filterType,
  setFilterType,
  handleBatchMarkAsUnread,
  handleBatchMarkAsRead,
  splitLayout,
  onSplitLayoutChange
}: MemoToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // 드롭다운 열림 상태 관리 ('read' | 'move' | 'spam' | 'delete' | null)
  const [activeDropdown, setActiveDropdown] = useState<'read' | 'move' | 'spam' | 'delete' | null>(null);

  // 외부 클릭 시 모든 드롭다운 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        setIsFolderDropdownOpen(false); // 기존 prop 호환성용
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [setIsFolderDropdownOpen]);

  // 드롭다운 토글 함수
  const toggleDropdown = (dropdown: 'read' | 'move' | 'spam' | 'delete') => {
    const next = activeDropdown === dropdown ? null : dropdown;
    setActiveDropdown(next);
    setIsFolderDropdownOpen(next === 'move');
  };

  return (
    <div ref={toolbarRef} className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)] select-none text-xs">
      
      {/* 좌측 컨트롤 그룹 (검색 + 구분선 + 작업 버튼들) */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        
        {/* 필터 셀렉트 */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'unread')}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">전체쪽지</option>
          <option value="unread" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">안읽은 쪽지</option>
        </select>

        {/* 검색 카테고리 셀렉트박스 */}
        <select
          value={searchCategory}
          onChange={(e) => setSearchCategory(e.target.value as 'all' | 'sender' | 'title' | 'content')}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">전체</option>
          <option value="sender" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{currentFolder === 'sent' ? '받는사람' : '보낸사람'}</option>
          <option value="title" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">제목</option>
          <option value="content" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">내용</option>
        </select>

        {/* 쪽지 검색 입력창 */}
        <div className="relative">
          <input
            type="text"
            placeholder="쪽지검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-2 pr-7 py-1 h-8 w-40 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)]"
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer"
          >
            <Search size={12} />
          </button>
        </div>

        {/* 구분선 */}
        <span className="text-[var(--border)] mx-1">|</span>

        {/* 작업 버튼들 */}
        {/* 1. 답장 (단독 버튼) */}
        {currentFolder !== 'trash' && (
          <button
            onClick={() => {
              const memo = memos.find(m => selectedIds.has(m.id));
              if (memo) handleReply(memo);
            }}
            disabled={selectedIds.size !== 1}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
          >
            <CornerUpLeft size={11} />
            답장
          </button>
        )}

        {/* 2. 읽기 설정 토글 버튼 */}
        {currentFolder === 'received' && (
          <button
            onClick={() => {
              const selectedMemos = memos.filter(m => selectedIds.has(m.id));
              const hasUnreadSelected = selectedMemos.some(m => m.is_read === 0);
              if (hasUnreadSelected) {
                handleBatchMarkAsRead();
              } else {
                handleBatchMarkAsUnread();
              }
            }}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
          >
            <MailOpen size={11} />
            {(() => {
              if (selectedIds.size === 0) return '읽음';
              const selectedMemos = memos.filter(m => selectedIds.has(m.id));
              const hasUnreadSelected = selectedMemos.some(m => m.is_read === 0);
              return hasUnreadSelected ? '읽음' : '안읽음';
            })()}
          </button>
        )}

        {/* 3. 보관 및 이동 드롭다운 */}
        {currentFolder !== 'trash' && (
          <div className="relative">
            <button
              onClick={() => toggleDropdown('move')}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
            >
              <FolderInput size={11} />
              이동
              <ChevronDown size={10} className="opacity-60" />
            </button>
            {(activeDropdown === 'move' || isFolderDropdownOpen) && (
              <div className="absolute left-0 mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-1 divide-y divide-[var(--border)] animate-in fade-in slide-in-from-top-1 duration-150">
                {currentFolder !== 'archived' && (
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleBatchArchive();
                        setActiveDropdown(null);
                        setIsFolderDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                    >
                      <Archive size={11} className="opacity-60" />
                      보관함으로 이동
                    </button>
                  </div>
                )}
                
                {customFolders.length > 0 && (
                  <div className="py-1 max-h-40 overflow-y-auto custom-scrollbar">
                    <div className="px-3 py-1 text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">개인 폴더로 이동</div>
                    {customFolders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => {
                          handleBatchMove(folder.id);
                          setActiveDropdown(null);
                          setIsFolderDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                      >
                        <Folder size={11} className="opacity-60" />
                        <span className="truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {currentFolder.startsWith('folder_') && (
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleBatchMove(null);
                        setActiveDropdown(null);
                        setIsFolderDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-700 flex items-center gap-2 cursor-pointer border-none bg-transparent font-semibold"
                    >
                      <X size={11} />
                      폴더에서 제외
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. 복원 버튼 (휴지통에서만 표시) */}
        {currentFolder === 'trash' && (
          <button
            onClick={handleBatchRestore}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
          >
            <RotateCcw size={11} />
            복원
          </button>
        )}

        {/* 5. 삭제 버튼 */}
        <button
          onClick={handleBatchDelete}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-red-50 dark:hover:bg-red-950/20 text-[var(--text-secondary)] hover:text-red-500 disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)] rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
        >
          <Trash2 size={11} />
          삭제
        </button>
      </div>

      {/* 우측 컨트롤 그룹 (폴더정보 + 필터 + 새로고침 + 분할 뷰) */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        
        {/* 폴더별 쪽지 수 정보 */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] mr-1.5 whitespace-nowrap">
          <span>{getFolderName(currentFolder)}</span>
          <span className="text-[var(--text-primary)] font-bold">
            <b>{unreadCount}</b> / {totalCount}
          </span>
        </div>

        {/* 분할 뷰 토글 */}
        <div className="flex items-center border border-[var(--border)] rounded bg-[var(--bg-surface)] p-0.5">
          <button
            onClick={() => onSplitLayoutChange('rows')}
            className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'rows' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
            title="가로 분할"
          >
            <Rows size={12} />
          </button>
          <button
            onClick={() => onSplitLayoutChange('columns')}
            className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'columns' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
            title="세로 분할"
          >
            <Columns size={12} />
          </button>
          <button
            onClick={() => onSplitLayoutChange('list')}
            className={`p-1 rounded cursor-pointer border-none ${splitLayout === 'list' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)]'} transition-colors`}
            title="리스트만 보기"
          >
            <Menu size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
