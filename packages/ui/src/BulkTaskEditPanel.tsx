import { useState, useEffect, useMemo, useRef } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from './Button';
import { Input, Select } from './Input';
import { useToast } from './Toast';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { useProjectMembers, type Member } from 'shared/hooks/useProjectMembers';
import { api } from 'shared/lib/api';
import { getStatusLabel } from './taskStatus';
import type { Project, Task } from 'shared/types';

interface BulkTaskEditPanelProps {
  project: Project;
  taskIds: string[];
  onSave: (updates: Record<string, unknown>) => Promise<boolean>;
  onClose: (success?: boolean) => void;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function memberName(m: Member): string {
  const fullName = [m.firstname, m.lastname].filter(Boolean).join(' ').trim();
  return fullName || m.login;
}

export function BulkTaskEditPanel({ project, taskIds, onSave, onClose }: BulkTaskEditPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { members } = useProjectMembers(project.id);

  const [activeTab, setActiveTab] = useState<'basic' | 'dates' | 'hierarchy'>('basic');
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Fetch all tasks for the project (for Parent Task hierarchy)
    api(`/api/tasks?project=${project.id}`)
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: Task[] }) => {
        if (json && json.success && Array.isArray(json.data)) {
          setAllTasks(json.data);
        }
      })
      .catch(console.error);
  }, [project.id]);

  const taskStatuses = safeJsonParse<string[]>(project.task_statuses, ['New', 'In Progress', 'Done']);
  const taskTypes = safeJsonParse<string[]>(project.task_types, ['Task', 'Bug']);
  const taskCategories = safeJsonParse<string[]>(project.task_categories, []);

  // Form State (빈 문자열 = t('bulkUnchanged'))
  const [assignee, setAssignee] = useState('');
  const [progress, setProgress] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [taskType, setTaskType] = useState('');
  const [taskCategory, setTaskCategory] = useState('');

  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [actualStartDate, setActualStartDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');

  const [parentTask, setParentTask] = useState(''); // ID string
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parentDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (parentDropdownRef.current && !parentDropdownRef.current.contains(e.target as Node)) {
        setShowParentDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const assigneeOptions = [
    { value: '', label: t('bulkUnchanged') },
    { value: 'unassigned', label: t('unassigned') },
    ...members.map((m) => ({ value: m.user_id, label: memberName(m) })),
  ];

  const statusOptions = [{ value: '', label: t('bulkUnchanged') }, ...taskStatuses.map((s) => ({ value: s, label: getStatusLabel(s, t) }))];
  const priorityOptions = [
    { value: '', label: t('bulkUnchanged') },
    { value: 'low', label: t('low') },
    { value: 'normal', label: t('normal') },
    { value: 'high', label: t('high') },
    { value: 'urgent', label: t('urgent') },
    { value: 'immediate', label: t('immediate') },
  ];
  const typeOptions = [{ value: '', label: t('bulkUnchanged') }, ...taskTypes.map((s) => ({ value: s, label: s }))];
  const categoryOptions = [{ value: '', label: t('bulkUnchanged') }, ...taskCategories.map((s) => ({ value: s, label: s }))];

  const availableParents = useMemo(() => {
    const selectedSet = new Set(taskIds);
    const descendants = new Set<string>();
    let currentBatch = [...taskIds];
    
    // Find all descendants of selected tasks to prevent circular loops
    while (currentBatch.length > 0) {
      const nextBatch: string[] = [];
      for (const t of allTasks) {
        if (t.parent_task_id && currentBatch.includes(t.parent_task_id)) {
          if (!descendants.has(t.id)) {
            descendants.add(t.id);
            nextBatch.push(t.id);
          }
        }
      }
      currentBatch = nextBatch;
    }

    return allTasks.filter(t => !selectedSet.has(t.id) && !descendants.has(t.id));
  }, [allTasks, taskIds]);

  const filteredParents = useMemo(() => {
    return availableParents.filter(t => 
      t.title.toLowerCase().includes(parentSearchQuery.toLowerCase()) ||
      t.id.includes(parentSearchQuery)
    );
  }, [availableParents, parentSearchQuery]);

  const hasChanges = 
    assignee !== '' || progress.trim() !== '' || status !== '' || priority !== '' ||
    taskType !== '' || taskCategory !== '' ||
    plannedStartDate !== '' || plannedEndDate !== '' || actualStartDate !== '' || actualEndDate !== '' ||
    parentTask !== '';

  const handleSave = async () => {
    const updates: Record<string, unknown> = {};

    if (assignee !== '') updates.assignee_id = assignee === 'unassigned' ? null : assignee;
    if (progress.trim() !== '') {
      const progressNum = Number(progress);
      if (!Number.isNaN(progressNum)) updates.progress = Math.max(0, Math.min(100, progressNum));
    }
    if (status !== '') updates.status = status;
    if (priority !== '') updates.priority = priority;
    if (taskType !== '') updates.task_type = taskType;
    if (taskCategory !== '') updates.task_category = taskCategory;

    if (plannedStartDate !== '') updates.planned_start_date = plannedStartDate === 'clear' ? null : plannedStartDate;
    if (plannedEndDate !== '') updates.planned_end_date = plannedEndDate === 'clear' ? null : plannedEndDate;
    if (actualStartDate !== '') updates.actual_start_date = actualStartDate === 'clear' ? null : actualStartDate;
    if (actualEndDate !== '') updates.actual_end_date = actualEndDate === 'clear' ? null : actualEndDate;

    if (parentTask !== '') updates.parent_task_id = parentTask === 'unassigned' ? null : parentTask;

    if (Object.keys(updates).length === 0) return;

    setIsSubmitting(true);
    try {
      const ok = await onSave(updates);
      if (ok) {
        showToast(t('bulkEditSuccess'), 'success');
        onClose(true);
      } else {
        showToast(t('bulkEditError'), 'error');
      }
    } catch {
      showToast(t('bulkEditError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getParentDisplay = () => {
    if (parentTask === '') return '';
    if (parentTask === 'unassigned') return t('unassigned');
    const p = allTasks.find(t => t.id === parentTask);
    return p ? `#${p.id} - ${p.title}` : parentTask;
  };

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug">
            {t('bulkEdit')}
            <span className="ml-2 text-sm font-bold text-[var(--primary)]">
              {t('bulkSelectCount').replace('{count}', String(taskIds.length))}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex items-center gap-1 border-b border-[var(--border)] w-full">
          {(['basic', 'dates', 'hierarchy'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-[var(--primary)] text-[var(--primary)]' 
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'basic' ? t('basic_info') : tab === 'dates' ? t('schedule') : t('hierarchy')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <Select label={t('assignee')} value={assignee} onChange={(e) => setAssignee(e.target.value)} options={assigneeOptions} fullWidth />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('tracker')} value={taskType} onChange={(e) => setTaskType(e.target.value)} options={typeOptions} fullWidth />
              <Select label={t('category')} value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)} options={categoryOptions} fullWidth />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('status')} value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} fullWidth />
              <Select label={t('priority')} value={priority} onChange={(e) => setPriority(e.target.value)} options={priorityOptions} fullWidth />
            </div>
            <Input label={t('progress')} type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} fullWidth />
          </div>
        )}

        {activeTab === 'dates' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Planned Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('planned_start_date')} type="date" value={plannedStartDate === 'clear' ? '' : plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value || 'clear')} fullWidth />
                <Input label={t('planned_end_date')} type="date" value={plannedEndDate === 'clear' ? '' : plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value || 'clear')} fullWidth />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Actual Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('actual_start_date')} type="date" value={actualStartDate === 'clear' ? '' : actualStartDate} onChange={(e) => setActualStartDate(e.target.value || 'clear')} fullWidth />
                <Input label={t('actual_end_date')} type="date" value={actualEndDate === 'clear' ? '' : actualEndDate} onChange={(e) => setActualEndDate(e.target.value || 'clear')} fullWidth />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hierarchy' && (
          <div className="space-y-4">
            <div className="form-group relative" ref={parentDropdownRef}>
              <label className="form-label mb-1 block">{t('parent_task')}</label>
              
              <div className="relative">
                <input
                  type="text"
                  className="form-control w-full cursor-text"
                  placeholder={parentTask === '' ? t('bulkUnchanged') : getParentDisplay()}
                  value={showParentDropdown ? parentSearchQuery : getParentDisplay()}
                  onChange={(e) => {
                    setParentSearchQuery(e.target.value);
                    if (!showParentDropdown) setShowParentDropdown(true);
                  }}
                  onFocus={() => {
                    setShowParentDropdown(true);
                    setParentSearchQuery('');
                  }}
                />
                
                {showParentDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-[var(--bg-surface-2)] text-sm border-b border-[var(--border)]"
                      onClick={() => {
                        setParentTask('');
                        setShowParentDropdown(false);
                      }}
                    >
                      {t('bulkUnchanged')}
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-[var(--bg-surface-2)] text-sm font-medium border-b border-[var(--border)]"
                      onClick={() => {
                        setParentTask('unassigned');
                        setShowParentDropdown(false);
                      }}
                    >
                      [{t('unassigned')}]
                    </button>
                    
                    {filteredParents.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-[var(--text-secondary)] text-center">
                        No tasks found
                      </div>
                    ) : (
                      filteredParents.map(task => (
                        <button
                          key={task.id}
                          className="w-full text-left px-3 py-2 hover:bg-[var(--bg-surface-2)] text-sm flex items-center justify-between group"
                          onClick={() => {
                            setParentTask(task.id);
                            setShowParentDropdown(false);
                          }}
                        >
                          <span className="truncate pr-2">#{task.id} - {task.title}</span>
                          <span className="text-[10px] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="form-error mt-1 text-xs text-[var(--text-secondary)]">
                Selecting a parent task will update all selected tasks. Existing child relationships that create a loop are automatically hidden.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50 flex justify-end gap-2 shrink-0">
        <Button type="button" variant="secondary" onClick={() => onClose()}>{t('cancel')}</Button>
        <Button icon={Save} disabled={isSubmitting || !hasChanges} onClick={handleSave}>{isSubmitting ? t('saving') : t('save')}</Button>
      </div>
    </div>
  );
}
