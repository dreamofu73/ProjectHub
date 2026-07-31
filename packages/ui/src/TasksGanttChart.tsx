import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

import { useLanguage } from 'shared/hooks/LanguageContext';

import { getStatusColor } from './TaskStatusBadge';

import type { Task } from 'shared/types/index';

interface TasksGanttChartProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onDateChange?: (taskId: string, plannedStartDate: string, plannedEndDate: string) => void;
}

const DAY_WIDTH = 40;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 50;
const MIN_BAR_WIDTH = 8;

interface DragState {
  taskId: string;
  field: 'planned_start_date' | 'planned_end_date';
  startX: number;
  startDate: string;
  endDate: string;
}

interface DatePreview {
  taskId: string;
  startDate: string;
  endDate: string;
}

export const TasksGanttChart: React.FC<TasksGanttChartProps> = ({
  tasks,
  onTaskClick,
  onDateChange,
}) => {
  const { t } = useLanguage();
  const [viewStartDate, setViewStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DatePreview | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate 30 days of columns
  const days = useMemo(() => {
    const result: Date[] = [];
    const d = new Date(viewStartDate);
    for (let i = 0; i < 30; i++) {
      result.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [viewStartDate]);

  // Format date as local "YYYY-MM-DD" (timezone-safe)
  const formatDate = useCallback((d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Parse "YYYY-MM-DD" as local midnight (timezone-safe)
  const parseDate = useCallback((dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }, []);

  // Calculate bar position for an issue
  const getBarPosition = useCallback((task: Task) => {
    const preview = dragPreview?.taskId === task.id ? dragPreview : null;
    const start = parseDate(preview ? preview.startDate : task.planned_start_date);
    const end = parseDate(preview ? preview.endDate : task.planned_end_date);

    if (!start || !end) return null;

    const viewStart = new Date(viewStartDate);
    const viewEnd = new Date(viewStartDate);
    viewEnd.setDate(viewEnd.getDate() + 29);

    // Clamp dates to view range
    const clampedStart = start < viewStart ? viewStart : start;
    const clampedEnd = end > viewEnd ? viewEnd : end;

    const startOffset = Math.floor((clampedStart.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.floor((clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (startOffset < 0 && startOffset + duration < 0) return null;

    return {
      left: Math.max(0, startOffset) * DAY_WIDTH,
      width: Math.max(MIN_BAR_WIDTH, duration * DAY_WIDTH),
    };
  }, [viewStartDate, parseDate, dragPreview]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent, task: Task, field: 'planned_start_date' | 'planned_end_date') => {
    e.stopPropagation();
    setDragPreview(null);
    setDragging({
      taskId: task.id,
      field,
      startX: e.clientX,
      startDate: task.planned_start_date || '',
      endDate: task.planned_end_date || '',
    });
  }, []);

  // Handle drag move (live preview) and drag end (commit once via onDateChange)
  useEffect(() => {
    if (!dragging) return;

    const computePreview = (clientX: number): DatePreview => {
      const daysDelta = Math.round((clientX - dragging.startX) / DAY_WIDTH);
      const start = parseDate(dragging.startDate);
      const end = parseDate(dragging.endDate);
      let startDate = dragging.startDate;
      let endDate = dragging.endDate;
      if (start) {
        start.setDate(start.getDate() + (dragging.field === 'planned_start_date' ? daysDelta : 0));
        startDate = formatDate(start);
      }
      if (end) {
        end.setDate(end.getDate() + (dragging.field === 'planned_end_date' ? daysDelta : 0));
        endDate = formatDate(end);
      }
      return { taskId: dragging.taskId, startDate, endDate };
    };

    const handleMouseMove = (e: MouseEvent) => {
      setDragPreview(computePreview(e.clientX));
    };

    const handleMouseUp = (e: MouseEvent) => {
      const preview = computePreview(e.clientX);
      setDragging(null);
      setDragPreview(null);
      if (onDateChange) {
        onDateChange(preview.taskId, preview.startDate, preview.endDate);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, formatDate, parseDate, onDateChange]);

  // Navigate dates
  const navigate = useCallback((direction: number) => {
    const newDate = new Date(viewStartDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setViewStartDate(newDate);
  }, [viewStartDate]);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    setViewStartDate(today);
  }, []);

  return (
    <div className="flex flex-col h-full border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <button
          onClick={() => navigate(-1)}
          className="px-2 py-1 text-xs font-semibold bg-[var(--bg-surface-2)] border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          ←
        </button>
        <button
          onClick={scrollToToday}
          className="px-3 py-1 text-xs font-semibold bg-[var(--bg-surface-2)] border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          오늘
        </button>
        <button
          onClick={() => navigate(1)}
          className="px-2 py-1 text-xs font-semibold bg-[var(--bg-surface-2)] border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          →
        </button>
        <span className="text-xs text-[var(--text-muted)] ml-2">
          {viewStartDate.toLocaleDateString('ko-KR')} ~ {days[days.length - 1]?.toLocaleDateString('ko-KR')}
        </span>
      </div>

      {/* Chart area */}
      <div className="flex flex-1 overflow-auto">
        {/* Issue list sidebar */}
        <div className="flex-shrink-0 border-r border-[var(--border)]" style={{ width: 240 }}>
          {/* Header */}
          <div className="flex items-center px-3 border-b border-[var(--border)] bg-[var(--bg-surface-2)]" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase">일감</span>
          </div>
          {/* Issue rows */}
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="flex items-center px-3 border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer"
              style={{ height: ROW_HEIGHT }}
              onClick={() => onTaskClick?.(task)}
            >
              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={`#${task.id}`}>
                  {index + 1}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px]">
                  {task.title}
                </span>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-[var(--text-muted)]">
              {t('noTasksFound')}
            </div>
          )}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto" ref={containerRef}>
          <div className="relative" style={{ minWidth: days.length * DAY_WIDTH }}>
            {/* Day headers */}
            <div className="flex border-b border-[var(--border)] bg-[var(--bg-surface-2)]" style={{ height: HEADER_HEIGHT }}>
              {days.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center border-r border-[var(--border)] ${isWeekend ? 'bg-[var(--bg-surface)]' : ''} ${isToday ? 'bg-[var(--primary)] bg-opacity-10' : ''}`}
                    style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                  >
                    <span className={`text-[10px] ${isToday ? 'font-bold text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                      {day.toLocaleDateString('ko-KR', { day: 'numeric' })}
                    </span>
                    <span className={`text-[9px] ${isToday ? 'font-bold text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                      {day.toLocaleDateString('ko-KR', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Today marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[var(--primary)] z-10"
              style={{
                left: days.findIndex(d => d.toDateString() === new Date().toDateString()) * DAY_WIDTH + DAY_WIDTH / 2,
              }}
            />

            {/* Issue rows with bars */}
            {tasks.map(task => {
              const bar = getBarPosition(task);
              const colors = getStatusColor(task.status);
              return (
                <div
                  key={task.id}
                  className="relative border-b border-[var(--border)]"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Day grid lines */}
                  {days.map((day, i) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r border-[var(--border)] ${isWeekend ? 'bg-[var(--bg-surface)]' : ''}`}
                        style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                      />
                    );
                  })}

                  {/* Bar */}
                  {bar && (
                    <div
                      className="absolute top-2 bottom-2 rounded cursor-pointer flex items-center px-1"
                      style={{
                        left: bar.left,
                        width: bar.width,
                        backgroundColor: colors.bg,
                        border: `1px solid ${colors.border}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(task);
                      }}
                    >
                      {/* Left drag handle */}
                      <div
                        className="w-1.5 h-full cursor-col-resize hover:bg-black/10 rounded-l"
                        onMouseDown={(e) => handleDragStart(e, task, 'planned_start_date')}
                      />
                      
                      {/* Bar content */}
                      <div className="flex-1 min-w-0 px-1">
                        <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>
                          {task.title}
                        </div>
                        {task.progress !== undefined && task.progress > 0 && (
                          <div className="h-0.5 rounded-full bg-black/10 mt-0.5">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${task.progress}%`, backgroundColor: colors.border }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Right drag handle */}
                      <div
                        className="w-1.5 h-full cursor-col-resize hover:bg-black/10 rounded-r"
                        onMouseDown={(e) => handleDragStart(e, task, 'planned_end_date')}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasksGanttChart;
