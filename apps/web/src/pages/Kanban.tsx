import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowLeft } from 'lucide-react';
import { PageHeader } from 'ui/PageHeader';
import { Card } from 'ui/Card';
import { Button } from 'ui/Button';
import { KanbanBoard, type KanbanColumnDef } from 'ui/KanbanBoard';
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
    if (project?.statuses) {
      try {
        const parsed = JSON.parse(project.statuses);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: string) => ({ id: s, label: s, color: 'bg-indigo-500', defaultWip: 10 }));
        }
      } catch {
        /* ignore invalid JSON */
      }
    }
    return [
      { id: 'new', label: '신규', color: 'bg-indigo-500', defaultWip: 10 },
      { id: 'in_progress', label: '진행 중', color: 'bg-blue-500', defaultWip: 5 },
      { id: 'feedback', label: '피드백', color: 'bg-purple-500', defaultWip: 5 },
      { id: 'resolved', label: '해결됨', color: 'bg-emerald-500', defaultWip: 10 },
      { id: 'closed', label: '완료', color: 'bg-slate-500', defaultWip: 20 },
    ];
  }, [project?.statuses]);

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
      const matchesSearch = issue.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTracker = trackerFilter === 'all' || issue.tracker === trackerFilter;
      return matchesSearch && matchesTracker;
    });
  }, [issues, searchTerm, trackerFilter]);

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-140px)] overflow-hidden relative">
      <div className="flex items-center gap-4">
        <Link to={`/projects/${id}/dashboard`} className="btn btn-secondary btn-icon rounded-full">
          <ArrowLeft size={16} />
        </Link>
        <PageHeader 
          title="이슈 칸반 보드" 
          description="이슈를 시각적으로 관리하고 드래그하여 상태를 변경하세요."
          className="mb-0 flex-1"
          actions={
            <div className="flex items-center gap-3">
              {isUpdating && <div className="spinner text-primary w-4 h-4 border-2" />}
              {!isArchived && (
                <Button icon={Plus} size="sm" onClick={() => handleOpenNewIssue()}>
                  이슈 추가
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs font-bold text-muted uppercase tracking-widest pl-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
            <span>{t('unspecified')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span>{t('in_progress')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span>{t('closed')}</span>
          </div>
        </div>

        <Card className="p-1.5 shadow-sm w-full md:w-auto border-border/50">
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
            <div className="flex bg-gray-50 dark:bg-slate-800 p-1 rounded-lg border border-border">
              {['all', 'bug', 'feature', 'task'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTrackerFilter(type)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    trackerFilter === type 
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
                    : 'text-muted hover:text-secondary'
                  }`}
                >
                  {type === 'all' ? t('kanbanAll') : type === 'bug' ? t('bug') : type === 'feature' ? t('feature') : t('task')}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input 
                type="text" 
                placeholder="이슈 제목으로 검색..." 
                className="form-control pl-9 h-9 border-none bg-gray-50 dark:bg-slate-800 focus:ring-0 transition-all text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Button variant="primary" size="sm" className="shrink-0" onClick={() => fetchIssues()}>
              {t('search') || '검색'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Unified KanbanBoard component */}
      <div className="flex-1 min-h-0 overflow-hidden">
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
          emptyMessage="등록된 이슈가 없습니다"
        />
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
