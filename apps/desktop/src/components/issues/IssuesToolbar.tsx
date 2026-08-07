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
  project: { id: number | string; identifier: string; name: string } | null;
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
  handleBulkConvertToTask: (projectId: string) => void;
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
  handleBulkConvertToTask,
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

  // 드롭다운 열림 상태 관리 (일괄변경 단일 드롭다운)
  const [activeDropdown, setActiveDropdown] = useState<'bulk' | null>(null);

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
  const toggleDropdown = () => {
    setActiveDropdown(prev => (prev === 'bulk' ? null : 'bulk'));
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

  // WBS 툴바와 일관된 컨트롤 스타일
  const selectClass =
    "h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium";
  const secondaryBtnClass =
    "h-8 px-2.5 flex items-center gap-1 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer font-medium";

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-2 flex-wrap min-w-0 select-none text-xs"
    >
      {/* 1. 프로젝트 필터 (전체 프로젝트 뷰일 때만) */}
      {!project && (
        <select
          value={projectFilterVal}
          onChange={e => updateFilter('project', e.target.value)}
          className={selectClass}
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
        className={selectClass}
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
        className={selectClass}
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
        className={selectClass}
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
        className={selectClass}
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
        className={selectClass}
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
          className="pl-2 pr-7 py-1 h-8 w-40 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--primary)] border-none bg-transparent cursor-pointer transition-colors"
        >
          <Search size={12} />
        </button>
      </div>

      {/* 8. 초기화 버튼 */}
      <button
        type="button"
        onClick={handleResetFilters}
        className={secondaryBtnClass}
        title={t('resetFilters')}
      >
        <X size={12} />
        {t('reset')}
      </button>

      {/* 9. 컬럼 설정 버튼 */}
      <div ref={columnSettingsRef} className="relative">
        <button
          type="button"
          onClick={() => setIsColumnSettingsOpen(!isColumnSettingsOpen)}
          className={secondaryBtnClass}
          title={t('columnSettings')}
        >
          <Settings size={12} />
        </button>

        {isColumnSettingsOpen && (
          <div className="absolute right-0 sm:left-0 mt-1 w-56 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 py-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3 pb-2 mb-1 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)]">{t('columnSettings')}</span>
              <span className="text-[0.65rem] font-bold text-[var(--primary)] bg-[var(--primary-bg)] px-1.5 py-0.5 rounded-full">
                {t('columnsSelected').replace('{count}', String(columnKeys.length))}
              </span>
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
                        className="accent-[var(--primary)] w-3.5 h-3.5 rounded cursor-pointer"
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

      {/* ── 일괄 선택 바 (항목 선택 시 표시, WBS와 동일 구성) ── */}
      {hasSelection && !isArchived && (
        <div className="flex items-center gap-2">
          {/* 세로 구분선 */}
          <span className="w-px h-5 bg-[var(--border)] mx-0.5" aria-hidden="true" />

          {/* 선택 개수 */}
          <span className="text-xs font-bold text-[var(--primary)] whitespace-nowrap">
            {t('bulkSelectCount').replace('{count}', String(selectedIssues.length))}
          </span>

          {/* 일감등록 */}
          {project && (
            <button
              type="button"
              onClick={() => handleBulkConvertToTask(project.id.toString())}
              className="h-8 px-3 bg-[var(--primary)] hover:opacity-90 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer border-none"
            >
              {t('bulkConvertToTask')}
            </button>
          )}

          {/* 일괄변경 (상태/담당자/기한 일괄 변경 드롭다운) */}
          <div className="relative">
            <button
              type="button"
              onClick={toggleDropdown}
              className={secondaryBtnClass}
            >
              {t('bulkChange')}
              <ChevronDown size={11} className="opacity-60" />
            </button>
            {activeDropdown === 'bulk' && (
              <div className="absolute right-0 mt-1 w-60 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl z-30 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* 상태 변경 */}
                <div className="px-3 pb-1 mb-1 border-b border-[var(--border)]">
                  <span className="text-[0.65rem] font-bold text-[var(--text-muted)]">{t('status')}</span>
                </div>
                <div className="max-h-32 overflow-y-auto custom-scrollbar px-1 pb-1">
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        handleBulkAction('status', key);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium rounded-lg"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* 담당자 변경 */}
                <div className="px-3 pb-1 mb-1 border-b border-[var(--border)]">
                  <span className="text-[0.65rem] font-bold text-[var(--text-muted)]">{t('assignee')}</span>
                </div>
                <div className="max-h-32 overflow-y-auto custom-scrollbar px-1 pb-1">
                  <button
                    onClick={() => {
                      handleBulkAction('assignee', 'unassigned');
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium rounded-lg"
                  >
                    {t('unassigned')}
                  </button>
                  {getCommonMembers().map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        handleBulkAction('assignee', String(user.id));
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium rounded-lg"
                    >
                      <User size={11} className="text-[var(--text-muted)]" />
                      {user.firstname} {user.lastname}
                    </button>
                  ))}
                </div>

                {/* 기한 변경 */}
                <div className="px-3 pb-1 mb-1 border-b border-[var(--border)]">
                  <span className="text-[0.65rem] font-bold text-[var(--text-muted)]">{t('dueDateLabel')}</span>
                </div>
                <div className="px-2 pb-1 flex items-center gap-2">
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

          {/* 전체 해제 */}
          <button
            type="button"
            onClick={() => setSelectedIssues([])}
            className={secondaryBtnClass}
          >
            <X size={11} />
            {t('deselectAll')}
          </button>
        </div>
      )}
    </div>
  );
}