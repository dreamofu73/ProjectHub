import { useRef } from 'react';
import { Search, X, Settings } from 'lucide-react';
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
  handleBulkConvertToTask: (projectId: string) => void;
  onOpenBulkEdit: () => void;

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
  handleBulkConvertToTask,
  onOpenBulkEdit,
  t,
  columnKeys,
  toggleColumn,
  isColumnSettingsOpen,
  setIsColumnSettingsOpen,
  columnSettingsRef,
}: IssuesToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

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

          {/* 일괄변경 */}
          <button
            type="button"
            onClick={onOpenBulkEdit}
            className={secondaryBtnClass}
          >
            {t('bulkChange')}
          </button>

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