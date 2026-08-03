import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Plus, Search, 
  Clock, ArrowLeft,
  AlertCircle, 
  ChevronRight,
  Layers
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { PageHeader } from 'ui/PageHeader';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Badge } from 'ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';
import { NewIssuePanel } from '../components/issues/NewIssuePanel';


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

const priorityConfig: Record<string, { label: string, color: string, icon: LucideIcon }> = {
  low: { label: '낮음', color: 'text-gray-500 bg-gray-100', icon: ChevronRight },
  normal: { label: '보통', color: 'text-blue-600 bg-blue-50', icon: ChevronRight },
  high: { label: '높음', color: 'text-orange-600 bg-orange-50', icon: ChevronRight },
  urgent: { label: '긴급', color: 'text-red-600 bg-red-50', icon: AlertCircle },
  immediate: { label: '즉시', color: 'text-white bg-rose-600 animate-pulse', icon: AlertCircle },
};

export default function KanbanPage() {
  const { formatDate, t, language } = useLanguage();
  const { id } = useParams<{ id: string }>();
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

  const statusColumns = project?.statuses 
    ? JSON.parse(project.statuses).map((s: string) => ({ id: s, label: s, color: 'bg-gray-500', bgColor: 'bg-gray-50/20' }))
    : [
        { id: 'new', label: '신규', color: 'bg-indigo-500', bgColor: 'bg-indigo-50/20' },
        { id: 'in_progress', label: '진행 중', color: 'bg-blue-500', bgColor: 'bg-blue-50/20' },
        { id: 'feedback', label: '피드백', color: 'bg-purple-500', bgColor: 'bg-purple-50/20' },
        { id: 'resolved', label: '해결됨', color: 'bg-emerald-500', bgColor: 'bg-emerald-50/20' },
        { id: 'closed', label: '완료', color: 'bg-gray-600', bgColor: 'bg-gray-100/30' },
      ];

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const issueId = String(draggableId);
    const newStatus = destination.droppableId;

    // Optimistic UI update
    const updatedIssues = [...issues];
    const issueIndex = updatedIssues.findIndex(i => i.id === issueId);
    if (issueIndex !== -1) {
      updatedIssues[issueIndex] = { ...updatedIssues[issueIndex], status: newStatus };
      setIssues(updatedIssues);
    }

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
      console.error('Failed to update status:', err);
      fetchIssues();
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTracker = trackerFilter === 'all' || issue.tracker === trackerFilter;
    return matchesSearch && matchesTracker;
  });

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-140px)] overflow-hidden">
      <div className="flex items-center gap-4">
        <Link to={`/projects/${id}/dashboard`} className="btn btn-secondary btn-icon rounded-full">
          <ArrowLeft size={16} />
        </Link>
        <PageHeader 
          title="칸반 보드" 
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
            <div className="w-2 h-2 rounded-full bg-gray-300"></div>
            <span>{language === 'ko' ? '미지정' : language === 'ja' ? '未指定' : language === 'zh' ? '未指派' : 'Unassigned'}</span>
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
                  {type === 'all' ? (language === 'ko' ? '전체' : language === 'ja' ? 'すべて' : language === 'zh' ? '全部' : 'All') : type === 'bug' ? t('bug') : type === 'feature' ? t('feature') : t('task')}
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

      <DragDropContext onDragEnd={isArchived ? () => {} : onDragEnd}>
        <div className="flex-1 flex gap-4 overflow-hidden items-start">
          {statusColumns.map((column: any) => {
            const columnIssues = filteredIssues.filter(i => i.status === column.id);
            
            return (
              <div key={column.id} className="flex-1 min-w-0 flex flex-col h-full bg-gray-50/40 rounded-2xl border border-gray-100 p-1.5">
                <div className="flex items-center justify-between mb-3 px-1.5 pt-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-3 rounded-full ${column.color} shadow-sm shrink-0`}></div>
                    <span className="font-bold text-gray-900 text-xs tracking-tight truncate">{column.label}</span>
                    <span className="bg-white border border-border px-1.5 py-0.5 rounded-full text-xs font-extrabold text-muted shrink-0">
                      {columnIssues.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!isArchived && (
                      <button type="button" onClick={() => handleOpenNewIssue(column.id)} className="p-1 hover:bg-white rounded-md text-muted hover:text-primary transition-all border-none bg-transparent cursor-pointer">
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <Droppable droppableId={column.id as string}>
                  {(provided, snapshot) => (
                    <div className="flex-1 min-h-0 relative scroll-shadow-container">
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`h-full flex flex-col gap-2.5 overflow-y-auto pr-0.5 transition-all duration-300 rounded-xl p-0.5 ${snapshot.isDraggingOver ? 'bg-primary/5 ring-2 ring-primary/10' : ''} custom-scrollbar`}
                      >
                        {columnIssues.map((issue, index) => {
                          const PriorityIcon = priorityConfig[issue.priority]?.icon || ChevronRight;
                          return (
                            <Draggable key={issue.id} draggableId={issue.id.toString()} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{ ...provided.draggableProps.style }}
                                  className={`group ${snapshot.isDragging ? 'z-50' : ''}`}
                                >
                                  <Card className={`card-hover-lift hover:border-primary/40 transition-all duration-300 border-border/50 shadow-sm bg-white dark:bg-slate-900 ${snapshot.isDragging ? 'shadow-2xl border-primary ring-4 ring-primary/5 -rotate-1' : ''}`}>
                                    <CardBody className="p-3 flex flex-col gap-2.5">
                                      <div className="flex justify-between items-start">
                                        <div className="flex flex-wrap gap-1">
                                          <Badge variant={issue.tracker} className="text-xs px-1 py-0.5">
                                            {issue.tracker === 'bug' ? t('bug') : issue.tracker === 'feature' ? t('feature') : t('task')}
                                          </Badge>
                                          <div className={`flex items-center gap-1 text-xs px-1 py-0.5 rounded-full font-extrabold uppercase tracking-tighter ${priorityConfig[issue.priority]?.color || 'bg-gray-100'}`}>
                                            <PriorityIcon size={8} />
                                            {t(issue.priority) || issue.priority}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <Link 
                                        to={`/projects/${id}/issues/${issue.id}`} 
                                        className="font-bold text-xs text-gray-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-primary transition-colors tracking-tight"
                                        onClick={(e) => snapshot.isDragging && e.preventDefault()}
                                      >
                                        {issue.subject}
                                      </Link>
  
                                      {issue.done_ratio > 0 && (
                                        <div className="flex flex-col gap-1">
                                          <div className="h-1 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-primary transition-all duration-500" 
                                              style={{ width: `${issue.done_ratio}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      )}
  
                                      <div className="flex items-center justify-between mt-0.5 pt-2 border-t border-gray-50/50 dark:border-slate-800">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <div className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-primary font-black text-xs shadow-sm shrink-0">
                                            {issue.assigned_name?.[0] || '?'}
                                          </div>
                                          <span className="text-xs font-bold text-gray-600 dark:text-slate-400 truncate">
                                            {issue.assigned_name || (language === 'ko' ? '미배정' : language === 'ja' ? '未割り当て' : language === 'zh' ? '未分配' : 'Unassigned')}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 text-xs text-muted font-bold shrink-0">
                                          <Clock size={9} className="opacity-50" />
                                          {formatDate(issue.updated_at, { month: 'numeric', day: 'numeric' })}
                                        </div>
                                      </div>
                                    </CardBody>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        
                        {columnIssues.length === 0 && !snapshot.isDraggingOver && (
                          <div className="h-20 border-2 border-dashed border-gray-200/40 dark:border-slate-800/80 rounded-2xl flex flex-col items-center justify-center gap-1 text-muted/30">
                            <Layers size={16} className="opacity-10" />
                            <span className="text-xs font-black uppercase tracking-widest">Empty</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

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
