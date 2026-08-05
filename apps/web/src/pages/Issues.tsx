import { useState, useEffect, useRef } from 'react';
import { Plus, AlertCircle, Layers, Bug } from 'lucide-react';
import { Pagination } from 'ui/Pagination';
import { useLanguage } from '../context/LanguageContext';
import { IssuesTableView, DEFAULT_COLUMN_KEYS } from '../components/issues/IssuesTableView';
import { IssuesToolbar } from '../components/issues/IssuesToolbar';

import { IssueDetailPanel } from '../components/issues/IssueDetailPanel';
import { NewIssuePanel } from '../components/issues/NewIssuePanel';
import { useIssues } from 'shared/hooks/useIssues';
import {
  STATUS_CONFIG,
  buildPriorityConfig,
  TRACKER_CONFIG,
  getAvatarColor,
  getInitials,
  isOverdue,
  isDueSoon,
} from '../constants/issueConfig';

import type { Issue } from 'shared/types';

export default function IssuesPage() {
  const { formatDate, t } = useLanguage();

  const {
    issues,
    total,
    loading,
    error,
    project,
    projects,
    searchVal,
    setSearchVal,
    statusVal,
    trackerVal,
    priorityVal,
    projectFilterVal,
    selectedIssues,
    setSelectedIssues,
    users,
    projectMembers,
    page,
    limit,
    paginatedIssues,
    fetchIssues,
    updateFilter,
    handleSelectAll,
    handleSelectIssue,
    handleBulkAction,
    handleBulkConvertToTask,
    handleSort,
    handleResetFilters,
    handlePageChange,
    handlePageSizeChange,
    trackerLabels,
    statusLabels,
    priorityLabels,
    hasActiveFilters,
    filterType,
    setFilterType,
    searchCategory,
    setSearchCategory,
    sortKey,
    sortOrder,
  } = useIssues();

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);
  
  const handleOpenDetail = (issue: Issue) => setSelectedIssueId(issue.id);

  // ── 컬럼 설정 ──
  const [columnKeys, setColumnKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('issue_column_keys');
      return saved ? JSON.parse(saved) : DEFAULT_COLUMN_KEYS;
    } catch {
      return DEFAULT_COLUMN_KEYS;
    }
  });
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const columnSettingsRef = useRef<HTMLDivElement>(null);

  const saveColumnKeys = (keys: string[]) => {
    setColumnKeys(keys);
    localStorage.setItem('issue_column_keys', JSON.stringify(keys));
  };

  const toggleColumn = (key: string) => {
    if (columnKeys.includes(key)) {
      saveColumnKeys(columnKeys.filter(k => k !== key));
    } else {
      saveColumnKeys([...columnKeys, key]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(e.target as Node)) {
        setIsColumnSettingsOpen(false);
      }
    };
    if (isColumnSettingsOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isColumnSettingsOpen]);

  const handleReorderColumns = (newKeys: string[]) => {
    saveColumnKeys(newKeys);
  };

  // ESC 키로 상세보기 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (isNewIssueOpen) return;
      if (selectedIssueId !== null) {
        e.preventDefault();
        setSelectedIssueId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIssueId, isNewIssueOpen]);

  const isArchived = project?.status === 'archived';

  const renderProps = {
    formatDate, t, isOverdue, isDueSoon, getAvatarColor, getInitials,
    STATUS_CONFIG, TRACKER_CONFIG, PRIORITY_CONFIG: buildPriorityConfig(t),
    trackerLabels, priorityLabels, statusLabels,
    onOpenDetail: handleOpenDetail,
    selectedIssueId,
  };

  const title = project ? t('projectIssuesTitle').replace('{name}', project.name) : t('totalIssuesTitle');

  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-2.5">
          <Bug size={20} className="text-[var(--primary)] shrink-0" />
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">
              {title}
            </h2>
            <span className="text-xs font-bold text-[var(--primary)] tabular-nums">
              {t('issueListCount').replace('{count}', String(total))}
            </span>
          </div>
        </div>
        {project && !isArchived && (
          <button
            type="button"
            onClick={() => setIsNewIssueOpen(true)}
            className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover,indigo-700)] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5 active:scale-[0.96] border-none"
          >
            <Plus size={14} />
            {t('addNewIssue')}
          </button>
        )}
      </div>

      {/* ── 메인 화면 콘텐츠 ── */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden bg-[var(--bg-surface)]">
        {/* 툴바 */}
        <div className="p-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/30">
          <IssuesToolbar
            filterType={filterType}
            setFilterType={setFilterType}
            trackerVal={trackerVal}
            statusVal={statusVal}
            priorityVal={priorityVal}
            projectFilterVal={projectFilterVal}
            updateFilter={updateFilter}
            projects={projects}
            project={project}
            isArchived={isArchived}
            searchCategory={searchCategory}
            setSearchCategory={setSearchCategory}
            searchQuery={searchVal}
            setSearchQuery={setSearchVal}
            handleResetFilters={handleResetFilters}
            selectedIssues={selectedIssues}
            setSelectedIssues={setSelectedIssues}
            handleBulkAction={handleBulkAction}
            handleBulkConvertToTask={handleBulkConvertToTask}
            users={users}
            projectMembers={projectMembers}
            issues={issues}
            statusLabels={statusLabels}
            t={t}
            trackerLabels={trackerLabels}
            priorityLabels={priorityLabels}
            columnKeys={columnKeys}
            toggleColumn={toggleColumn}
            isColumnSettingsOpen={isColumnSettingsOpen}
            setIsColumnSettingsOpen={setIsColumnSettingsOpen}
            columnSettingsRef={columnSettingsRef}
            onReorderColumns={handleReorderColumns}
          />
        </div>

        {/* 이슈 목록 테이블 영역 */}
        <div className="flex-1 overflow-auto min-h-0 h-full flex flex-col">
          {loading ? (
            <div className="py-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="flex items-center gap-3 py-3.5 px-5 border-b border-[var(--border)]">
                  <div className="w-4 h-4 rounded bg-[var(--border-strong)] shrink-0 animate-pulse" />
                  <div className="w-10 h-3.5 rounded bg-[var(--border-strong)] animate-pulse" />
                  <div className="w-15 h-5 rounded-full bg-[var(--border-strong)] animate-pulse" />
                  <div className="flex-1 h-3.5 rounded bg-[var(--border-strong)] animate-pulse" />
                  <div className="w-20 h-3.5 rounded bg-[var(--border-strong)] animate-pulse" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-15 px-6 text-center">
              <AlertCircle size={40} className="text-[var(--danger)] mx-auto mb-3" />
              <p className="text-[var(--danger)] font-semibold">{error}</p>
            </div>
          ) : paginatedIssues.length === 0 ? (
            <div className="py-20 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--primary-bg)] flex items-center justify-center mx-auto mb-4">
                <Layers size={28} className="text-[var(--primary)]" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5">{t('noIssuesFound')}</h3>
              <p className="text-sm text-[var(--text-muted)]">{t('noIssuesDesc')}</p>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 bg-[var(--primary-bg)] text-[var(--primary)] border border-indigo-500/30 rounded-xl px-4.5 py-2 cursor-pointer text-sm font-semibold"
                >
                  {t('resetFilters')}
                </button>
              )}
            </div>
          ) : (
            <IssuesTableView
              issues={paginatedIssues}
              selectedIssues={selectedIssues}
              onSelectAll={handleSelectAll}
              onSelectIssue={handleSelectIssue}
              onOpenDetail={handleOpenDetail}
              selectedIssueId={selectedIssueId}
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={handleSort}
              projectId={project?.identifier}
              renderProps={renderProps}
              columnKeys={columnKeys}
              onReorderColumns={handleReorderColumns}
            />
          )}
        </div>

        {/* 페이지네이션 */}
        {!loading && total > 0 && (
          <div className="border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/20">
            <Pagination
              currentPage={page}
              totalCount={total}
              pageSize={limit}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[10, 20, 30, 50, 100]}
            />
          </div>
        )}
      </div>

      {/* ── 우측 상세 패널 (slide-over) ── */}
      {selectedIssueId !== null && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <IssueDetailPanel
            issueId={selectedIssueId}
            projectId={project?.identifier}
            isArchived={isArchived}
            onClose={() => setSelectedIssueId(null)}
            onUpdated={fetchIssues}
            onDeleted={fetchIssues}
          />
        </div>
      )}

      {/* ── 우측 새 이슈 추가 패널 (slide-over) ── */}
      {isNewIssueOpen && project && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <NewIssuePanel
            project={project}
            onClose={() => setIsNewIssueOpen(false)}
            onCreated={() => {
              setIsNewIssueOpen(false);
              fetchIssues();
            }}
          />
        </div>
      )}
    </div>
  );
}
