import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Calendar, User, X, Settings } from 'lucide-react';
import { ALL_COLUMNS, getColumnLabel } from './IssuesTableView';

interface IssuesToolbarProps {
  // Filter (내 이슈 / 전체)
  filterType: 'all' | 'me';
  setFilterType: (val: 'all' | 'me') => void;

  // Additional Filters
  trackerVal: string;
  statusVal: string;
  priorityVal: string;
  projectFilterVal: string;
  updateFilter: (key: string, value: string) => void;
  projects: Array<{ identifier: string; name: string }>;
  project: { identifier: string; name: string } | null;
  isArchived?: boolean;

  // Search
  searchCategory: 'all' | 'title' | 'content' | 'author';
  setSearchCategory: (val: 'all' | 'title' | 'content' | 'author') => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  handleResetFilters: () => void;

  // Selection
  selectedIssues: string[];
  setSelectedIssues: (ids: string[]) => void;

  // Bulk actions
  handleBulkAction: (type: 'status' | 'assignee' | 'due_date', value: string) => void;
  users: Array<{ id: string; firstname: string; lastname: string }>;
  projectMembers: Array<{ project_id: string; user_id: string }>;
  issues: Array<{ id: string; project_id: string }>;

  // Labels (from t())
  statusLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  trackerLabels: Record<string, string>;
  t: (key: string) => string;

  // Column settings
  columnKeys: string[];
  toggleColumn: (key: string) => void;
  isColumnSettingsOpen: boolean;
  setIsColumnSettingsOpen: (open: boolean) => void;
  columnSettingsRef: React.RefObject<HTMLDivElement | null>;
  onReorderColumns: (newKeys: string[]) => void;

  // View mode
  
  
}

export function IssuesToolbar({
  filterType,
  setFilterType,
  trackerVal,
  statusVal,
  priorityVal,
  projectFilterVal,
  updateFilter,
  projects,
  project,
  isArchived,
  searchCategory,
  setSearchCategory,
  searchQuery,
  setSearchQuery,
  handleResetFilters,
  selectedIssues,
  setSelectedIssues,
  handleBulkAction,
  users,
  projectMembers,
  issues,
  statusLabels,
  t,
  columnKeys,
  toggleColumn,
  isColumnSettingsOpen,
  setIsColumnSettingsOpen,
  columnSettingsRef,
  
}: IssuesToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 드롭다운 열림 상태 관리
  const [activeDropdown, setActiveDropdown] = useState<'status' | 'assignee' | 'due_date' | null>(null);

  // 외부 클릭 시 모든 드롭다운 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // 드롭다운 토글 함수
  const toggleDropdown = (dropdown: 'status' | 'assignee' | 'due_date') => {
    setActiveDropdown(prev => (prev === dropdown ? null : dropdown));
  };

  // 선택된 이슈들이 속한 프로젝트들의 공통 멤버 계산
  const getCommonMembers = () => {
    if (selectedIssues.length === 0) return [];
    const selectedIssueProjects = issues
      .filter(i => selectedIssues.includes(String(i.id)))
      .map(i => i.project_id);
    const uniqueProjectIds = Array.from(new Set(selectedIssueProjects));
    if (uniqueProjectIds.length === 0) return [];
    return users.filter(user =>
      uniqueProjectIds.every(pid =>
        projectMembers.some(pm => pm.project_id === pid && pm.user_id === user.id),
      ),
    );
  };

  const hasSelection = selectedIssues.length > 0;

  return (
    <div
      ref={toolbarRef}
      className="flex flex-col gap-0 select-none text-xs"
    >
      {/* ── 필터/검색 라인 ── */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {/* 1. 프로젝트 필터 (전체 프로젝트 뷰일 때만) */}
        {!project && (
          <select
            value={projectFilterVal}
            onChange={e => updateFilter('project', e.target.value)}
            className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
          >
            <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('project')}</option>
            {projects.map(p => (
              <option key={p.identifier} value={p.identifier} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{p.name}</option>
            ))}
          </select>
        )}

        {/* 2. 유형 필터 */}
        <select
          value={trackerVal}
          onChange={e => updateFilter('tracker', e.target.value)}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
            <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('allTrackers')}</option>
          <option value="bug" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">🐛 {t('bug')}</option>
          <option value="feature" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">✨ {t('feature')}</option>
          <option value="task" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">✅ {t('task')}</option>
          <option value="support" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">💬 {t('support')}</option>
          <option value="enhancement" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">⚡ {t('enhancement')}</option>
        </select>

        {/* 3. 상태 필터 */}
        <select
          value={statusVal}
          onChange={e => updateFilter('status', e.target.value)}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('allStatuses')}</option>
          <option value="new" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('new')}</option>
          <option value="in_progress" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('in_progress')}</option>
          <option value="resolved" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('resolved')}</option>
          <option value="feedback" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('feedback')}</option>
          <option value="closed" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('closed')}</option>
          <option value="rejected" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('rejected')}</option>
        </select>

        {/* 4. 우선순위 필터 */}
        <select
          value={priorityVal}
          onChange={e => updateFilter('priority', e.target.value)}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('allPriorities')}</option>
          <option value="low" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('low')}</option>
          <option value="normal" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('normal')}</option>
          <option value="high" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('high')}</option>
          <option value="urgent" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('urgent')}</option>
          <option value="immediate" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{t('immediate')}</option>
        </select>

        {/* 5. 담당자 필터 (전체 / 내 이슈) */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as 'all' | 'me')}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
            {t('assignee')}
          </option>
          <option value="me" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
            {t('myIssues')}
          </option>
        </select>

        {/* 6. 검색 카테고리 셀렉트 */}
        <select
          value={searchCategory}
          onChange={e =>
            setSearchCategory(e.target.value as 'all' | 'title' | 'content' | 'author')
          }
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
            {t('all')}
          </option>
          <option value="title" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
            {t('title')}
          </option>
          <option value="content" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
            {t('content')}
          </option>
          <option value="author" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
            {t('author')}
          </option>
        </select>

        {/* 7. 검색 입력창 */}
        <div className="relative">
          <input
            type="text"
            placeholder={t('searchIssuesPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-2 pr-7 py-1 h-8 w-40 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)]"
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer"
          >
            <Search size={12} />
          </button>
        </div>

        {/* 8. 초기화 버튼 */}
        <button
          type="button"
          onClick={handleResetFilters}
          className="h-8 px-2.5 flex items-center gap-1 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer font-medium"
          title={t('resetFilters')}
        >
          <X size={12} />
          {t('reset')}
        </button>

        

        {/* 10. 컬럼 설정 버튼 */}
        <div ref={columnSettingsRef} className="relative">
          <button
            type="button"
            onClick={() => setIsColumnSettingsOpen(!isColumnSettingsOpen)}
            className="h-8 px-2.5 flex items-center gap-1 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer font-medium"
            title={t('columnSettings')}
          >
            <Settings size={12} />
          </button>

          {isColumnSettingsOpen && (
            <div className="absolute left-0 mt-1 w-56 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 pb-1.5 mb-1 border-b border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text-primary)]">{t('columnSettings')}</span>
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar px-1">
                {ALL_COLUMNS.map(col => {
                  const isVisible = columnKeys.includes(col.key);
                  return (
                    <div
                      key={col.key}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface-2)] transition-colors group"
                    >
                      <label className="flex items-center gap-2 flex-1 cursor-pointer text-xs font-medium text-[var(--text-primary)] select-none py-0.5">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleColumn(col.key)}
                          className="accent-[var(--primary)] w-3.5 h-3.5 rounded"
                        />
                        {getColumnLabel(col.key, t)}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 선택 동작 바 (항목 선택 시 표시) ── */}
      {hasSelection && !isArchived && (
        <div className="flex items-center gap-2 flex-wrap min-w-0 pt-2.5 mt-2.5 border-t border-[var(--border)]">
          {/* 선택 개수 */}
          <span className="text-xs font-bold text-[var(--primary)] shrink-0 min-w-[3rem]">
            {selectedIssues.length} {t('issues')}
          </span>

          {/* 상태 변경 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('status')}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
            >
              {t('changeStatusPlaceholder')}
              <ChevronDown size={10} className="opacity-60" />
            </button>
            {activeDropdown === 'status' && (
              <div className="absolute left-0 mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                {Object.entries(statusLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      handleBulkAction('status', key);
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 담당자 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('assignee')}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
            >
              <User size={11} />
              {t('assignUserPlaceholder')}
              <ChevronDown size={10} className="opacity-60" />
            </button>
            {activeDropdown === 'assignee' && (
              <div className="absolute left-0 mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-1 divide-y divide-[var(--border)] animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleBulkAction('assignee', 'unassigned');
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                  >
                    {t('unassigned')}
                  </button>
                </div>
                {getCommonMembers().length > 0 && (
                  <div className="py-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {getCommonMembers().map(user => (
                      <button
                        key={user.id}
                        onClick={() => {
                          handleBulkAction('assignee', String(user.id));
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                      >
                        {user.firstname} {user.lastname}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 기한 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('due_date')}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
            >
              <Calendar size={11} />
              {t('dueDateLabel')}
              <ChevronDown size={10} className="opacity-60" />
            </button>
            {activeDropdown === 'due_date' && (
              <div className="absolute left-0 mt-1 w-52 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-2 px-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-[var(--text-muted)] shrink-0" />
                  <input
                    type="date"
                    className="w-full bg-transparent border-none text-xs text-[var(--text-primary)] outline-none py-1"
                    onChange={e => {
                      if (e.target.value) {
                        handleBulkAction('due_date', e.target.value);
                        setActiveDropdown(null);
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <span className="text-[var(--border)] mx-0.5">|</span>

          {/* 선택 해제 버튼 */}
          <button
            onClick={() => setSelectedIssues([])}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
          >
            <X size={11} />
            <span>
              {t('deselectAll')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
