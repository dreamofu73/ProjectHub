import { useState, useEffect } from 'react';
import { Plus, CheckSquare, Upload } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTasks } from './useTasks';
import { NewTaskPanel } from '../components/tasks/NewTaskPanel';
import { TaskDetailPanel } from '../components/tasks/TaskDetailPanel';
import { BulkUploadModal } from '../components/tasks/BulkUploadModal';
import { TasksGanttChart } from '../components/tasks/TasksGanttChart';
import { useLocation } from 'react-router-dom';

export default function TasksPage() {
  const { t } = useLanguage();
  const { tasks, loading, error, project, fetchTasks } = useTasks();
  const isArchived = project?.status === 'archived';
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const location = useLocation();
  const viewMode = new URLSearchParams(location.search).get('view') === 'gantt' ? 'gantt' : 'table';

  // ESC 키로 상세보기 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (isNewTaskOpen || isBulkUploadOpen) return;
      if (selectedTaskId !== null) {
        e.preventDefault();
        setSelectedTaskId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, isNewTaskOpen, isBulkUploadOpen]);

  if (!project) return null;

  return (
    <div className="w-full h-[calc(100vh-105px)] animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <CheckSquare size={16} className="text-[var(--primary)]" />
          <span>{t('tasks')} - {project.name}</span>
        </h2>
        <div className="flex gap-2">
          {!isArchived && (
            <>
              <button
                type="button"
                onClick={() => setIsBulkUploadOpen(true)}
                className="h-8.5 px-3.5 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border border-[var(--border)]"
              >
                <Upload size={13} />
                {t('bulkUpload')}
              </button>
              <button
                type="button"
                onClick={() => setIsNewTaskOpen(true)}
                className="h-8.5 px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
              >
                <Plus size={13} />
                {t('addNewTask')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div>{t('loading')}...</div>
        ) : error ? (
          <div className="text-[var(--danger)]">{error}</div>
        ) : (
          
          <>
            {viewMode === 'gantt' ? (
            <TasksGanttChart tasks={tasks} onTaskClick={(task) => setSelectedTaskId(task.id)} />
          ) : (
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left py-2">{t('title')}</th>
                <th className="text-left py-2">{t('task_type')}</th>
                <th className="text-left py-2">{t('task_category')}</th>
                <th className="text-left py-2">{t('status')}</th>
                <th className="text-left py-2">{t('planned_dates')}</th>
                <th className="text-left py-2">{t('actual_dates')}</th>
                <th className="text-left py-2">{t('progress')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>
                  <td className="py-2">{task.title}</td>
                  <td className="py-2">{task.task_type}</td>
                  <td className="py-2">{task.task_category}</td>
                  <td className="py-2">{task.status}</td>
                  <td className="py-2">{task.planned_start_date} - {task.planned_end_date}</td>
                  <td className="py-2">{task.actual_start_date} - {task.actual_end_date}</td>
                  <td className="py-2">{task.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
            )}
          </>
    
        )}
      </div>

      {selectedTaskId !== null && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <TaskDetailPanel
            taskId={selectedTaskId}
            isArchived={isArchived}
            onClose={() => setSelectedTaskId(null)}
            onUpdated={fetchTasks}
          />
        </div>
      )}

      {isNewTaskOpen && project && (
        <div className="fixed top-[calc(var(--header-height)+1rem)] bottom-4 right-0 w-2/3 z-50 bg-[var(--bg-surface)] border-l border-y border-[var(--border)] rounded-l-xl shadow-2xl animate-slide-in-right flex flex-col overflow-hidden">
          <NewTaskPanel
            project={project}
            onClose={() => setIsNewTaskOpen(false)}
            onCreated={() => {
              setIsNewTaskOpen(false);
              fetchTasks();
            }}
          />
        </div>
      )}
      {isBulkUploadOpen && project && (
        <BulkUploadModal
          project={project}
          onClose={() => setIsBulkUploadOpen(false)}
          onUploaded={() => {
            setIsBulkUploadOpen(false);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}
