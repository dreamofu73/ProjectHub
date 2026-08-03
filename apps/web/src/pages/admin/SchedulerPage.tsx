import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { schedulerApi } from 'shared/lib/api';
import { Button } from 'ui/Button';
import {
  Clock,
  Send,
  AlertTriangle,
  Trash2,
  Play,
  Square,
  Timer,
  CalendarCheck,
  X,
  ChevronRight,
} from 'lucide-react';
import type { TaskStatus } from 'shared/lib/api';

const TASK_ICONS = [Send, AlertTriangle, Trash2];
const TASK_COLORS = [
  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
];

const CRON_PRESETS = [
  { label: '매 30초',      value: '*/30 * * * *' },
  { label: '매 1분',       value: '0 * * * *' },
  { label: '매 5분',       value: '0 */5 * * *' },
  { label: '매 30분',      value: '0 */30 * * *' },
  { label: '매 1시간',     value: '0 0 * * *' },
  { label: '매 6시간',     value: '0 */6 * * *' },
  { label: '매일 09:00',   value: '0 0 9 * *' },
  { label: '매일 자정',    value: '0 0 0 * *' },
];

export default function SchedulerPage() {
  const { t, formatDateTime } = useLanguage();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cronInputs, setCronInputs] = useState<Record<string, string>>({});
  const [openPreset, setOpenPreset] = useState<string | null>(null);

  // Split layout state
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('scheduler_leftWidth');
    return saved ? Number(saved) : 40;
  });
  const isResizing = useRef(false);
  const leftWidthRef = useRef(leftWidth);
  leftWidthRef.current = leftWidth;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await schedulerApi.status();
      if (res.success && res.data?.tasks) {
        setTasks(res.data.tasks);
        const inputs: Record<string, string> = {};
        res.data.tasks.forEach((t, i) => { inputs[i] = t.cron_expression; });
        setCronInputs(inputs);
      } else {
        showToast(t('schedulerFetchError'), 'error');
      }
    } catch {
      showToast(t('schedulerFetchError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-select first task
  useEffect(() => {
    if (!loading && tasks.length > 0 && selectedIdx === null) {
      setSelectedIdx(0);
    }
  }, [loading, tasks, selectedIdx]);

  // ESC key to deselect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (selectedIdx !== null || openPreset !== null) {
        e.preventDefault();
        setSelectedIdx(null);
        setOpenPreset(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIdx, openPreset]);

  // Prevent body scroll while in this page
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  // Persist leftWidth to localStorage (skip during active resize for perf)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!isResizing.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        localStorage.setItem('scheduler_leftWidth', String(leftWidth));
      }, 200);
    }
    return () => clearTimeout(saveTimer.current);
  }, [leftWidth]);

  // Drag resizer
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const container = document.getElementById('split-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      let pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(25, Math.min(75, pct));
      setLeftWidth(pct);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('scheduler_leftWidth', String(leftWidthRef.current));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const updateTask = async (taskId: string, data: { running?: boolean; cron_expression?: string }) => {
    setSavingId(taskId);
    try {
      const res = await schedulerApi.update({ task_id: taskId, ...data });
      if (res.success && res.data?.tasks) {
        setTasks(res.data.tasks);
        const inputs = { ...cronInputs };
        res.data.tasks.forEach((t, i) => { inputs[i] = t.cron_expression; });
        setCronInputs(inputs);
        showToast(t('schedulerUpdateSuccess'), 'success');
      } else {
        showToast(res.message || t('schedulerUpdateError'), 'error');
      }
    } catch {
      showToast(t('schedulerUpdateError'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleRunning = (taskId: string, current: boolean) => {
    updateTask(taskId, { running: !current });
  };

  const handleRunTask = async (taskId: string) => {
    try {
      const res = await schedulerApi.runTask(taskId);
      if (res.success && res.data?.tasks) {
        setTasks(res.data.tasks);
        showToast(t('schedulerTaskRunSuccess') || '작업이 강제 실행되었습니다.', 'success');
      } else {
        showToast(res.message || t('serverCommunicationError'), 'error');
      }
    } catch {
      showToast(t('serverCommunicationError'), 'error');
    }
  };

  const handleCronChange = (taskId: string, value: string) => {
    setCronInputs(prev => ({ ...prev, [taskId]: value }));
    setOpenPreset(null);
  };

  const handleCronSave = (taskId: string) => {
    const expr = cronInputs[taskId]?.trim();
    if (!expr) return;
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) {
      showToast(t('schedulerCronInvalid') || '올바른 cron 형식이 아닙니다. (초 분 시 일 월)', 'error');
      return;
    }
    updateTask(taskId, { cron_expression: expr });
  };

  const renderTaskCard = (task: TaskStatus, idx: number) => {
    const Icon = TASK_ICONS[idx] || Clock;
    const color = TASK_COLORS[idx] || 'bg-slate-100 dark:bg-slate-800 text-slate-500';
    const isSelected = selectedIdx === idx;

    return (
      <button
        key={task.id}
        onClick={() => setSelectedIdx(Number(idx))}
        className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer ${
          isSelected
            ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm ring-1 ring-[var(--primary)]/20'
            : 'border-[var(--border)] bg-[var(--bg-surface-2)]/20 hover:bg-[var(--bg-surface-2)]/40 hover:border-[var(--border-strong)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm truncate">{task.name}</span>
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  task.running
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${task.running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
                />
                {task.running ? t('schedulerRunning') : t('schedulerStopped')}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <CalendarCheck className="w-3 h-3" />
                {task.last_run ? formatDateTime(task.last_run) : t('schedulerNever')}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
        </div>
      </button>
    );
  };

  // ── Detail panel ──
  const renderDetailPanel = () => {
    if (selectedIdx === null || !tasks[Number(selectedIdx)]) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[var(--bg-surface-2)]/20">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto text-[var(--text-muted)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {t('schedulerSelectTask') || '왼쪽에서 작업을 선택하세요'}
            </p>
          </div>
        </div>
      );
    }

    const task = tasks[Number(selectedIdx)];
    const idx = selectedIdx;
    const Icon = TASK_ICONS[idx] || Clock;
    const color = TASK_COLORS[idx] || 'bg-slate-100 dark:bg-slate-800 text-slate-500';

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Detail header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{task.name}</h2>
              <span className="text-xs text-[var(--text-muted)] font-mono">{task.id}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIdx(null)}
            className="gap-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Detail body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          {/* Status & Processing (merged) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{t('schedulerStatus') || '상태'}:</span>
              {(() => {
                if (!task.running) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      {t('schedulerStopped')}
                    </span>
                  );
                }
                if (task.processing) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      {t('schedulerProcessing') || '처리중'}
                    </span>
                  );
                }
                if (!task.last_run) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {t('schedulerStarted') || '시작됨'}
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t('schedulerWaiting') || '대기중'}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleRunTask(task.id)}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Play className="w-4 h-4" />
                {t('schedulerRunNow') || '강제 실행'}
              </Button>
              <Button
                onClick={() => handleToggleRunning(task.id, task.running)}
                disabled={savingId === task.id}
                variant={task.running ? 'danger' : 'primary'}
                size="sm"
                className="gap-1.5"
              >
                {task.running ? (
                  <><Square className="w-4 h-4" /> {t('schedulerStop')}</>
                ) : (
                  <><Play className="w-4 h-4" /> {t('schedulerStart')}</>
                )}
              </Button>
            </div>
          </div>

          {/* Cron expression */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">
              <Timer className="w-3 h-3 inline mr-1" />
              {t('schedulerCron')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cronInputs[task.id] ?? task.cron_expression}
                onChange={(e) => handleCronChange(task.id, e.target.value)}
                placeholder="*/30 * * * *"
                className="flex-1 px-3 py-2 text-sm font-mono rounded-lg border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
              />
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenPreset(openPreset === task.id ? null : task.id)}
                  className="gap-1"
                >
                  {t('presets')}
                </Button>
                {openPreset === task.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenPreset(null)} />
                    <div className="absolute right-0 mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-lg z-20 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {CRON_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handleCronChange(task.id, preset.value)}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors"
                        >
                          <span className="font-medium">{preset.label}</span>
                          <span className="block text-xs text-[var(--text-muted)] font-mono">
                            {preset.value}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCronSave(task.id)}
                disabled={savingId === task.id}
                className="gap-1"
              >
                {savingId === task.id ? t('processing') : t('save')}
              </Button>
            </div>
          </div>

          {/* Last run */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-2.5 uppercase tracking-wider">
              {t('schedulerLastRun')}
            </h3>
            <div className="rounded-lg bg-[var(--bg-app)] p-3 border border-[var(--border)]">
              <div className="text-xs font-medium">
                {task.last_run ? formatDateTime(task.last_run) : (
                  <span className="text-[var(--text-muted)]">{t('schedulerNever')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Main layout ──
  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t('scheduler')}</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {t('schedulerCronFormat') || '초 분 시 일 월 — 크론탭 문법'}
            </p>
          </div>
        </div>
      </div>

      {/* Content area */}
      {loading && tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
          {t('schedulerFetchError')}
        </div>
      ) : (
        /* ── Master-detail split ── */
        <div id="split-container" className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Task list */}
          <div
            className="flex flex-col overflow-hidden min-w-[280px]"
            style={{ width: `${leftWidth}%` }}
          >
            <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
              {tasks.map((task, idx) => renderTaskCard(task, idx))}
            </div>
          </div>

          {/* Resizer */}
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-[var(--primary)] active:bg-[var(--primary)] transition-colors relative bg-[var(--border)] mx-0"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* Right: Detail panel */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-[350px]">
            {renderDetailPanel()}
          </div>
        </div>
      )}
    </div>
  );
}
