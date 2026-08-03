import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Columns3, RefreshCw } from 'lucide-react';
import { KanbanBoard, type KanbanColumnDef, getWorkflowStatusRank } from 'ui/KanbanBoard';
import { NewIssuePanel } from '../components/issues/NewIssuePanel';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';

interface Issue {
  id: string;
  subject: string;
  status: string;
  tracker: string;
  priority: string;
  assigned_name: string | null;
  updated_at: string;
  done_ratio: number;
}

export default function KanbanPage() {
  const { formatDate, t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [trackerFilter, setTrackerFilter] = useState('all');
  const [isUpdating, setIsUpdating] = useState(false);
  const isArchived = project?.status === 'archived';

  // Floating New Issue Panel State
  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);
  const [selectedStatusForNewIssue, setSelectedStatusForNewIssue] = useState<string | undefined>(undefined);

  const handleOpenNewIssue = (columnStatus?: string) => {
    if (isArchived) return;
    setSelectedStatusForNewIssue(columnStatus);
    setIsNewIssueOpen(true);
  };

  const fetchProject = useCallback(async () => {
    try {
      const res = await api(`/api/projects/${id}`);
      const json = await res.json();
      if (json.success) {
        setProject(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch project:', err);
    }
  }, [id]);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await api(`/api/issues?project=${id}`);
      const json = await res.json();
      if (json.success) {
        setIssues(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchIssues();
  }, [fetchProject, fetchIssues]);

  // ESC 키로 새 이슈 추가 패널 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (isNewIssueOpen) {
        e.preventDefault();
        setIsNewIssueOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewIssueOpen]);

  const statusColumns = useMemo<KanbanColumnDef[]>(() => {
    let rawCols: KanbanColumnDef[] = [];
    if (project?.statuses) {
      try {
        const parsed = JSON.parse(project.statuses);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rawCols = parsed.map((s: string) => ({ id: s, label: s, color: 'bg-indigo-500', defaultWip: 10 }));
        }
      } catch {
        /* ignore invalid JSON */
      }
    }
    if (rawCols.length === 0) {
      rawCols = [
        { id: 'new', label: t('statusNew') || '신규', color: 'bg-indigo-500', defaultWip: 10 },
        { id: 'in_progress', label: t('statusInProgress') || '진행 중', color: 'bg-blue-500', defaultWip: 5 },
        { id: 'feedback', label: t('statusFeedback') || '피드백', color: 'bg-amber-500', defaultWip: 5 },
        { id: 'resolved', label: t('statusResolved') || '해결됨', color: 'bg-emerald-500', defaultWip: 10 },
        { id: 'closed', label: t('statusClosed') || '완료', color: 'bg-slate-500', defaultWip: 20 },
      ];
    }

    return [...rawCols].sort((a, b) => {
      const rankA = getWorkflowStatusRank(a.id || a.label);
      const rankB = getWorkflowStatusRank(b.id || b.label);
      if (rankA !== rankB) return rankA - rankB;
      return a.label.localeCompare(b.label);
    });
  }, [project?.statuses, t]);

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    if (isArchived) return;

    // Optimistic UI update
    setIssues(prev => prev.map(i => String(i.id) === String(issueId) ? { ...i, status: newStatus } : i));
    setIsUpdating(true);
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        fetchIssues();
      }
    } catch (err) {
      console.error('Failed to update issue status:', err);
      fetchIssues();
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchesSearch = (issue.subject || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTracker = trackerFilter === 'all' || issue.tracker === trackerFilter;
      return matchesSearch && matchesTracker;
    });
  }, [issues, searchTerm, trackerFilter]);

  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">

      {/* ── 헤더 영역 ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[var(--primary)] border border-indigo-100 dark:border-indigo-900/40 shadow-2xs">
            <Columns3 size={16} />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">
              {t('issueKanbanBoard') || '이슈 칸반 보드'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-[var(--primary)] border border-indigo-100 dark:border-indigo-900/40 tabular-nums">
              {(t('totalCountWithNum') || '전체 {count}개').replace('{count}', String(filteredIssues.length))}
            </span>
            {isUpdating && (
              <span className="flex items-center gap-1 text-xs font-bold text-indigo-500 animate-pulse ml-2">
                <RefreshCw size={12} className="animate-spin" /> {t('saving') || '저장 중...'}
              </span>
            )}
          </div>
        </div>

        {project && !isArchived && (
          <button
            type="button"
            onClick={() => handleOpenNewIssue()}
            className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover,indigo-700)] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5 active:scale-[0.96] border-none"
          >
            <Plus size={14} />
            {t('newIssue') || '새 이슈 추가'}
          </button>
        )}
      </div>

      {/* ── 메인 콘텐츠 영역 ── */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden bg-[var(--bg-surface)]">
        {/* 툴바 & 필터 영역 */}
        <div className="p-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/30 flex flex-wrap items-center justify-between gap-3">
          {/* 소프트 필터 탭 */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border)] shadow-2xs">
            {[
              { key: 'all', label: t('kanbanAll') || '전체' },
              { key: 'bug', label: t('bug') || '버그' },
              { key: 'feature', label: t('feature') || '새기능' },
              { key: 'task', label: t('task') || '업무' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setTrackerFilter(tab.key)}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all border ${
                  trackerFilter === tab.key
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                    : 'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 검색 영역 */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder={t('searchIssuePlaceholder') || '이슈 제목으로 검색...'}
              className="w-full h-8.5 pl-9 pr-3 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-[var(--primary)] transition-all shadow-2xs"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Unified KanbanBoard component */}
        <div className="flex-1 min-h-0 overflow-hidden p-3 bg-[var(--bg-surface-2)]/10">
          <KanbanBoard<Issue>
            items={filteredIssues}
            columns={statusColumns}
            getItemId={issue => String(issue.id)}
            getItemStatus={issue => issue.status}
            getItemCardProps={issue => ({
              id: String(issue.id),
              title: issue.subject,
              badgeText: issue.tracker === 'bug' ? t('bug') : issue.tracker === 'feature' ? t('feature') : t('task'),
              badgeVariant: issue.tracker,
              priority: issue.priority,
              progress: issue.done_ratio,
              assigneeName: issue.assigned_name || undefined,
              subtitle: issue.updated_at ? formatDate(issue.updated_at, { month: 'numeric', day: 'numeric' }) : undefined,
            })}
            onItemClick={issue => navigate(`/projects/${id}/issues/${issue.id}`)}
            onStatusChange={handleStatusChange}
            onNewItemClick={colId => handleOpenNewIssue(colId)}
            readOnly={isArchived}
            emptyMessage={t('noIssuesFound') || '등록된 이슈가 없습니다'}
          />
        </div>
      </div>

      {/* ── 우측 새 이슈 추가 패널 (slide-over) ── */}
      {isNewIssueOpen && project && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <NewIssuePanel
            project={project}
            initialStatus={selectedStatusForNewIssue}
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
