import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, ChevronRight, ChevronDown, Flag } from 'lucide-react';

import { useLanguage } from 'shared/hooks/LanguageContext';
import { flattenTaskTree } from 'shared/lib/taskTree';

import { getStatusColor } from './TaskStatusBadge';

import type { Task, Milestone } from 'shared/types/index';

/** 간트 차트에서 드래그로 바꿀 수 있는 날짜 필드. */
export type GanttDateField =
  | 'planned_start_date'
  | 'planned_end_date'
  | 'actual_start_date'
  | 'actual_end_date';

export type GanttDatePatch = Partial<Record<GanttDateField, string>>;

/** 타임라인 눈금 단위. */
export type GanttScale = 'day' | 'week' | 'month';

interface TasksGanttChartProps {
  tasks: Task[];
  milestones?: Milestone[];
  onTaskClick?: (task: Task) => void;
  /** 드래그가 끝났을 때 변경된 날짜 필드 하나만 담아 호출된다. */
  onDateChange?: (taskId: string, patch: GanttDatePatch) => void;
  onAddSubtask?: (taskId: string) => void;
  onAddMilestone?: () => void;
  /** 보관된 프로젝트 등 편집이 불가능한 경우 드래그와 추가 버튼을 감춘다. */
  readOnly?: boolean;
  /** 처음 표시할 눈금 단위. */
  defaultScale?: GanttScale;
}

/**
 * 눈금 단위별 설정.
 * - `pxPerDay`: 하루가 차지하는 가로 픽셀. 막대·마커 위치는 모두 이 값으로 계산한다.
 * - `columns`: 화면에 그릴 열 개수.
 * - `navigateDays` / `navigateMonths`: 이전·다음 버튼의 이동 폭.
 */
const SCALE_CONFIG: Record<GanttScale, {
  pxPerDay: number;
  columns: number;
  navigateDays?: number;
  navigateMonths?: number;
  todayOffsetDays?: number;
  todayOffsetMonths?: number;
}> = {
  day: { pxPerDay: 40, columns: 30, navigateDays: 7, todayOffsetDays: 7 },
  week: { pxPerDay: 14, columns: 16, navigateDays: 28, todayOffsetDays: 21 },
  month: { pxPerDay: 5, columns: 12, navigateMonths: 3, todayOffsetMonths: 2 },
};

const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 50;
const MILESTONE_LANE_HEIGHT = 28;
const SIDEBAR_WIDTH = 260;
const MIN_BAR_WIDTH = 8;
const INDENT_PER_DEPTH = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const PLANNED_BAR_TOP = 5;
const PLANNED_BAR_HEIGHT = 26;
const ACTUAL_BAR_TOP = 35;
const ACTUAL_BAR_HEIGHT = 12;

/** 이 폭보다 좁은 막대에는 제목을 그리지 않는다. */
const BAR_LABEL_MIN_WIDTH = 48;

interface GanttColumn {
  key: string;
  start: Date;
  /** 이 열이 포함하는 날짜 수 (월 단위에서는 달마다 다르다). */
  days: number;
  /** 뷰 시작일로부터의 날짜 오프셋. */
  offsetDays: number;
  topLabel: string;
  bottomLabel: string;
  isToday: boolean;
  isWeekend: boolean;
}

type BarKind = 'planned' | 'actual';

interface DragState {
  taskId: string;
  kind: BarKind;
  field: GanttDateField;
  startX: number;
  /** 드래그 시작 시점의 막대 시작일. */
  startDate: string;
  /** 드래그 시작 시점의 막대 종료일. 진행 중인 실제 일정이면 오늘 날짜. */
  endDate: string;
  /** 실제 종료일이 저장되어 있는지 여부 (진행 중이면 false). */
  hasRealEnd: boolean;
}

interface DatePreview {
  taskId: string;
  kind: BarKind;
  startDate: string;
  endDate: string;
}

const isStartField = (field: GanttDateField) => field.endsWith('_start_date');

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** 두 날짜 사이의 일수 차이. 두 값 모두 자정 기준이라고 가정한다. */
const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);

export const TasksGanttChart: React.FC<TasksGanttChartProps> = ({
  tasks,
  milestones = [],
  onTaskClick,
  onDateChange,
  onAddSubtask,
  onAddMilestone,
  readOnly = false,
  defaultScale = 'day',
}) => {
  const { t } = useLanguage();
  const [scale, setScale] = useState<GanttScale>(defaultScale);
  const [viewAnchor, setViewAnchor] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return startOfDay(d);
  });
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DatePreview | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const canEdit = !readOnly && !!onDateChange;
  const { pxPerDay } = SCALE_CONFIG[scale];

  // 주 단위는 일요일, 월 단위는 1일에 맞춰 열이 떨어지도록 시작일을 스냅한다.
  const viewStart = useMemo(() => {
    const d = startOfDay(viewAnchor);
    if (scale === 'week') d.setDate(d.getDate() - d.getDay());
    if (scale === 'month') d.setDate(1);
    return d;
  }, [viewAnchor, scale]);

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

  const columns = useMemo<GanttColumn[]>(() => {
    const { columns: columnCount } = SCALE_CONFIG[scale];
    const today = startOfDay(new Date());
    const result: GanttColumn[] = [];
    const cursor = new Date(viewStart);
    let offsetDays = 0;

    for (let i = 0; i < columnCount; i++) {
      const start = new Date(cursor);
      let days: number;
      let topLabel: string;
      let bottomLabel: string;

      if (scale === 'day') {
        days = 1;
        topLabel = start.toLocaleDateString('ko-KR', { day: 'numeric' });
        bottomLabel = start.toLocaleDateString('ko-KR', { weekday: 'short' });
        cursor.setDate(cursor.getDate() + 1);
      } else if (scale === 'week') {
        days = 7;
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        topLabel = `${start.getMonth() + 1}/${start.getDate()}`;
        bottomLabel = `~${end.getMonth() + 1}/${end.getDate()}`;
        cursor.setDate(cursor.getDate() + 7);
      } else {
        // 달마다 길이가 다르므로 다음 달 1일까지의 일수를 그대로 쓴다.
        const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        days = daysBetween(start, next);
        topLabel = String(start.getFullYear());
        bottomLabel = start.toLocaleDateString('ko-KR', { month: 'short' });
        cursor.setFullYear(next.getFullYear(), next.getMonth(), 1);
      }

      const todayOffset = daysBetween(start, today);
      result.push({
        key: start.toISOString(),
        start,
        days,
        offsetDays,
        topLabel,
        bottomLabel,
        isToday: todayOffset >= 0 && todayOffset < days,
        isWeekend: scale === 'day' && (start.getDay() === 0 || start.getDay() === 6),
      });

      offsetDays += days;
    }

    return result;
  }, [viewStart, scale]);

  const totalDays = useMemo(
    () => columns.reduce((sum, column) => sum + column.days, 0),
    [columns],
  );
  const timelineWidth = totalDays * pxPerDay;

  const viewEnd = useMemo(() => {
    const d = new Date(viewStart);
    d.setDate(d.getDate() + totalDays - 1);
    return d;
  }, [viewStart, totalDays]);

  // Rows in tree order, with collapsed subtrees hidden
  const rows = useMemo(() => flattenTaskTree(tasks, collapsedIds), [tasks, collapsedIds]);

  const toggleCollapse = useCallback((taskId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }, []);

  /** 뷰 시작일로부터의 날짜 오프셋. 표시 범위 밖이면 null. */
  const dayOffsetOf = useCallback((dateStr: string | null | undefined): number | null => {
    const date = parseDate(dateStr);
    if (!date) return null;
    const offset = daysBetween(viewStart, date);
    return offset >= 0 && offset < totalDays ? offset : null;
  }, [parseDate, viewStart, totalDays]);

  // Calculate bar geometry for a date range, clamped to the visible window
  const getBarRange = useCallback((startStr: string | null | undefined, endStr: string | null | undefined) => {
    const start = parseDate(startStr);
    const end = parseDate(endStr);

    if (!start || !end || end < start) return null;

    // Clamp dates to view range
    const clampedStart = start < viewStart ? viewStart : start;
    const clampedEnd = end > viewEnd ? viewEnd : end;

    const startOffset = daysBetween(viewStart, clampedStart);
    const duration = daysBetween(clampedStart, clampedEnd) + 1;

    // Entirely outside the visible window
    if (duration <= 0) return null;

    return {
      left: startOffset * pxPerDay,
      width: Math.max(MIN_BAR_WIDTH, duration * pxPerDay),
    };
  }, [viewStart, viewEnd, parseDate, pxPerDay]);

  /**
   * Resolve the start/end a bar should currently render with, applying the live
   * drag preview when this bar is the one being dragged.
   */
  const getBarDates = useCallback((task: Task, kind: BarKind) => {
    const preview = dragPreview?.taskId === task.id && dragPreview.kind === kind ? dragPreview : null;
    if (preview) return { start: preview.startDate, end: preview.endDate };
    return kind === 'planned'
      ? { start: task.planned_start_date, end: task.planned_end_date }
      : { start: task.actual_start_date, end: task.actual_end_date };
  }, [dragPreview]);

  const getPlannedBar = useCallback((task: Task) => {
    const { start, end } = getBarDates(task, 'planned');
    return getBarRange(start, end);
  }, [getBarDates, getBarRange]);

  // An unfinished task runs from its actual start up to today
  const getActualBar = useCallback((task: Task) => {
    const { start, end } = getBarDates(task, 'actual');
    if (!start) return null;
    const isOngoing = !end;
    const range = getBarRange(start, end || formatDate(new Date()));
    return range ? { ...range, isOngoing } : null;
  }, [getBarDates, getBarRange, formatDate]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent, task: Task, kind: BarKind, field: GanttDateField) => {
    e.stopPropagation();
    e.preventDefault();
    const start = kind === 'planned' ? task.planned_start_date : task.actual_start_date;
    const end = kind === 'planned' ? task.planned_end_date : task.actual_end_date;
    if (!start) return;

    setDragPreview(null);
    setDragging({
      taskId: task.id,
      kind,
      field,
      startX: e.clientX,
      startDate: start,
      endDate: end || formatDate(new Date()),
      hasRealEnd: !!end,
    });
  }, [formatDate]);

  // Handle drag move (live preview) and drag end (commit once via onDateChange)
  useEffect(() => {
    if (!dragging) return;

    const computePreview = (clientX: number): DatePreview => {
      const daysDelta = Math.round((clientX - dragging.startX) / pxPerDay);
      let { startDate, endDate } = dragging;

      if (isStartField(dragging.field)) {
        const start = parseDate(dragging.startDate);
        if (start) {
          start.setDate(start.getDate() + daysDelta);
          const next = formatDate(start);
          // A real end date acts as a floor so the range never inverts.
          startDate = dragging.hasRealEnd && next > dragging.endDate ? dragging.endDate : next;
        }
      } else {
        const end = parseDate(dragging.endDate);
        if (end) {
          end.setDate(end.getDate() + daysDelta);
          const next = formatDate(end);
          endDate = next < dragging.startDate ? dragging.startDate : next;
        }
      }

      return { taskId: dragging.taskId, kind: dragging.kind, startDate, endDate };
    };

    const handleMouseMove = (e: MouseEvent) => {
      setDragPreview(computePreview(e.clientX));
    };

    const handleMouseUp = (e: MouseEvent) => {
      const preview = computePreview(e.clientX);
      const { field, taskId } = dragging;
      const value = isStartField(field) ? preview.startDate : preview.endDate;
      const unchanged = value === (isStartField(field) ? dragging.startDate : dragging.endDate);

      setDragging(null);
      setDragPreview(null);

      // Swallow the click that mouseup is about to produce so releasing a drag
      // handle does not also open the task detail panel.
      document.addEventListener(
        'click',
        (clickEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
        },
        { capture: true, once: true },
      );

      // Only the dragged field is committed — an ongoing task keeps its empty
      // end date unless the end handle itself was moved.
      if (onDateChange && !unchanged) {
        onDateChange(taskId, { [field]: value });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, formatDate, parseDate, onDateChange, pxPerDay]);

  // Navigate by roughly a quarter of the visible window
  const navigate = useCallback((direction: number) => {
    const config = SCALE_CONFIG[scale];
    setViewAnchor(prev => {
      const next = new Date(prev);
      if (config.navigateMonths) next.setMonth(next.getMonth() + direction * config.navigateMonths);
      else next.setDate(next.getDate() + direction * (config.navigateDays ?? 7));
      return next;
    });
  }, [scale]);

  // Bring today into view, leaving some context before it
  const scrollToToday = useCallback(() => {
    const config = SCALE_CONFIG[scale];
    const next = startOfDay(new Date());
    if (config.todayOffsetMonths) next.setMonth(next.getMonth() - config.todayOffsetMonths);
    else next.setDate(next.getDate() - (config.todayOffsetDays ?? 7));
    setViewAnchor(next);
  }, [scale]);

  const todayOffset = useMemo(() => {
    const offset = daysBetween(viewStart, startOfDay(new Date()));
    return offset >= 0 && offset < totalDays ? offset : null;
  }, [viewStart, totalDays]);

  // Milestones that fall inside the visible window, with their day offset
  const visibleMilestones = useMemo(
    () => milestones
      .map(milestone => ({ milestone, offset: dayOffsetOf(milestone.due_date) }))
      .filter((entry): entry is { milestone: Milestone; offset: number } => entry.offset !== null),
    [milestones, dayOffsetOf],
  );

  const hasMilestoneLane = milestones.length > 0 || !!onAddMilestone;

  const scaleOptions: { value: GanttScale; label: string }[] = [
    { value: 'day', label: t('ganttScaleDay') },
    { value: 'week', label: t('ganttScaleWeek') },
    { value: 'month', label: t('ganttScaleMonth') },
  ];

  return (
    <div className="flex flex-col h-full border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-wrap">
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
          {t('ganttToday')}
        </button>
        <button
          onClick={() => navigate(1)}
          className="px-2 py-1 text-xs font-semibold bg-[var(--bg-surface-2)] border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          →
        </button>

        {/* Scale switcher */}
        <div className="flex items-center rounded border border-[var(--border)] overflow-hidden ml-1" role="group">
          {scaleOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setScale(option.value)}
              aria-pressed={scale === option.value}
              className={`px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer border-r border-[var(--border)] last:border-r-0 ${
                scale === option.value
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-[var(--text-muted)] ml-2">
          {viewStart.toLocaleDateString('ko-KR')} ~ {viewEnd.toLocaleDateString('ko-KR')}
        </span>

        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="w-4 h-2.5 rounded-sm border border-[var(--text-muted)] bg-[var(--bg-surface-2)]" />
            {t('planned_dates')}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="w-4 h-2 rounded-sm bg-[var(--text-muted)]" />
            {t('actual_dates')}
          </span>
          {!readOnly && onAddMilestone && (
            <button
              type="button"
              onClick={onAddMilestone}
              className="px-2.5 py-1 text-xs font-semibold bg-[var(--bg-surface-2)] border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Flag size={12} />
              {t('addMilestone')}
            </button>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex flex-1 overflow-auto">
        {/* Task list sidebar */}
        <div className="flex-shrink-0 border-r border-[var(--border)]" style={{ width: SIDEBAR_WIDTH }}>
          {/* Header */}
          <div className="flex items-center px-3 border-b border-[var(--border)] bg-[var(--bg-surface-2)]" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase">{t('tasks')}</span>
          </div>

          {/* Milestone lane label */}
          {hasMilestoneLane && (
            <div
              className="flex items-center px-3 border-b border-[var(--border)] bg-[var(--bg-surface-2)]/60 gap-1.5"
              style={{ height: MILESTONE_LANE_HEIGHT }}
            >
              <Flag size={11} className="text-[var(--text-muted)]" />
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('milestones')}</span>
            </div>
          )}

          {/* Task rows */}
          {rows.map(({ task, depth, hasChildren }, index) => (
            <div
              key={task.id}
              className="flex items-center border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer group pr-2"
              style={{ height: ROW_HEIGHT, paddingLeft: 8 + depth * INDENT_PER_DEPTH }}
              onClick={() => onTaskClick?.(task)}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(task.id);
                  }}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] shrink-0 cursor-pointer"
                  aria-expanded={!collapsedIds.has(task.id)}
                  aria-label={collapsedIds.has(task.id) ? t('expand') : t('collapse')}
                >
                  {collapsedIds.has(task.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
              ) : (
                <span className="w-[18px] shrink-0" />
              )}

              <div className="flex flex-col min-w-0 gap-0.5 flex-1 ml-1">
                <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={`#${task.id}`}>
                  {index + 1}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] truncate" title={task.title}>
                  {task.title}
                </span>
              </div>

              {!readOnly && onAddSubtask && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSubtask(task.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-hover)] transition-all flex items-center justify-center shrink-0 border border-transparent hover:border-[var(--primary)]/30 cursor-pointer"
                  title={t('addSubtask')}
                  aria-label={t('addSubtask')}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          ))}

          {rows.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-[var(--text-muted)]">
              {t('noTasksFound')}
            </div>
          )}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto" ref={containerRef}>
          <div className="relative" style={{ minWidth: timelineWidth }}>
            {/* Column headers */}
            <div className="flex border-b border-[var(--border)] bg-[var(--bg-surface-2)]" style={{ height: HEADER_HEIGHT }}>
              {columns.map((column, i) => {
                const width = column.days * pxPerDay;
                const shaded = column.isWeekend || (scale !== 'day' && i % 2 === 1);
                return (
                  <div
                    key={column.key}
                    className={`flex flex-col items-center justify-center border-r border-[var(--border)] overflow-hidden ${shaded ? 'bg-[var(--bg-surface)]' : ''} ${column.isToday ? 'bg-[var(--primary)] bg-opacity-10' : ''}`}
                    style={{ width, minWidth: width }}
                    title={column.start.toLocaleDateString('ko-KR')}
                  >
                    <span className={`text-[10px] whitespace-nowrap ${column.isToday ? 'font-bold text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                      {column.topLabel}
                    </span>
                    <span className={`text-[9px] whitespace-nowrap ${column.isToday ? 'font-bold text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                      {column.bottomLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Milestone lane */}
            {hasMilestoneLane && (
              <div
                className="relative border-b border-[var(--border)] bg-[var(--bg-surface-2)]/60"
                style={{ height: MILESTONE_LANE_HEIGHT }}
              >
                {visibleMilestones.map(({ milestone, offset }) => (
                  <div
                    key={milestone.id}
                    className="absolute top-0 h-full flex items-center gap-1 pl-1 -translate-x-1/2"
                    style={{ left: (offset + 0.5) * pxPerDay }}
                    title={`${milestone.name} (${milestone.due_date ?? '-'})`}
                  >
                    <span className="w-2 h-2 rotate-45 bg-[var(--primary)] shrink-0" />
                    <span className="text-[10px] font-semibold text-[var(--primary)] whitespace-nowrap max-w-[120px] truncate">
                      {milestone.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Today marker */}
            {todayOffset !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[var(--primary)] z-10 pointer-events-none"
                style={{ left: (todayOffset + 0.5) * pxPerDay }}
              />
            )}

            {/* Milestone guide lines */}
            {visibleMilestones.map(({ milestone, offset }) => (
              <div
                key={milestone.id}
                className="absolute bottom-0 w-px z-10 pointer-events-none border-l border-dashed border-[var(--primary)]/50"
                style={{ top: HEADER_HEIGHT, left: (offset + 0.5) * pxPerDay }}
              />
            ))}

            {/* Task rows with bars */}
            {rows.map(({ task }) => {
              const plannedBar = getPlannedBar(task);
              const actualBar = getActualBar(task);
              const colors = getStatusColor(task.status);
              const plannedTitle = `${t('planned_dates')}: ${task.planned_start_date || '-'} ~ ${task.planned_end_date || '-'}`;
              const actualTitle = `${t('actual_dates')}: ${task.actual_start_date || '-'} ~ ${task.actual_end_date || '-'}`;
              // 눈금이 좁아지면 핸들도 같이 줄여 막대를 덮어버리지 않게 한다.
              const plannedHandle = plannedBar ? Math.max(3, Math.min(6, Math.floor(plannedBar.width / 3))) : 0;
              const actualHandle = actualBar ? Math.max(3, Math.min(6, Math.floor(actualBar.width / 3))) : 0;
              return (
                <div
                  key={task.id}
                  className="relative border-b border-[var(--border)]"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Column grid lines */}
                  {columns.map((column, i) => {
                    const shaded = column.isWeekend || (scale !== 'day' && i % 2 === 1);
                    return (
                      <div
                        key={column.key}
                        className={`absolute top-0 bottom-0 border-r border-[var(--border)] ${shaded ? 'bg-[var(--bg-surface)]' : ''}`}
                        style={{ left: column.offsetDays * pxPerDay, width: column.days * pxPerDay }}
                      />
                    );
                  })}

                  {/* Planned bar */}
                  {plannedBar && (
                    <div
                      className="absolute rounded cursor-pointer flex items-center"
                      style={{
                        left: plannedBar.left,
                        width: plannedBar.width,
                        top: PLANNED_BAR_TOP,
                        height: PLANNED_BAR_HEIGHT,
                        backgroundColor: colors.bg,
                        border: `1px solid ${colors.border}`,
                      }}
                      title={plannedTitle}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(task);
                      }}
                    >
                      {canEdit && (
                        <div
                          className="h-full cursor-col-resize hover:bg-black/20 rounded-l shrink-0"
                          style={{ width: plannedHandle }}
                          onMouseDown={(e) => handleDragStart(e, task, 'planned', 'planned_start_date')}
                        />
                      )}

                      {/* Bar content */}
                      <div className="flex-1 min-w-0 px-1 overflow-hidden">
                        {plannedBar.width >= BAR_LABEL_MIN_WIDTH && (
                          <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>
                            {task.title}
                          </div>
                        )}
                        {task.progress !== undefined && task.progress > 0 && (
                          <div className="h-0.5 rounded-full bg-black/10 mt-0.5">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${task.progress}%`, backgroundColor: colors.border }}
                            />
                          </div>
                        )}
                      </div>

                      {canEdit && (
                        <div
                          className="h-full cursor-col-resize hover:bg-black/20 rounded-r shrink-0"
                          style={{ width: plannedHandle }}
                          onMouseDown={(e) => handleDragStart(e, task, 'planned', 'planned_end_date')}
                        />
                      )}
                    </div>
                  )}

                  {/* Actual bar — solid fill, ongoing tasks keep an open right edge */}
                  {actualBar && (
                    <div
                      className={`absolute cursor-pointer flex items-center justify-between rounded-l-sm ${actualBar.isOngoing ? '' : 'rounded-r-sm'}`}
                      style={{
                        left: actualBar.left,
                        width: actualBar.width,
                        top: ACTUAL_BAR_TOP,
                        height: ACTUAL_BAR_HEIGHT,
                        backgroundColor: colors.border,
                        opacity: actualBar.isOngoing ? 0.6 : 0.9,
                      }}
                      title={actualTitle}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(task);
                      }}
                    >
                      {canEdit && (
                        <>
                          <div
                            className="h-full cursor-col-resize hover:bg-black/20 rounded-l-sm shrink-0"
                            style={{ width: actualHandle }}
                            onMouseDown={(e) => handleDragStart(e, task, 'actual', 'actual_start_date')}
                          />
                          <div
                            className="h-full cursor-col-resize hover:bg-black/20 rounded-r-sm shrink-0"
                            style={{ width: actualHandle }}
                            onMouseDown={(e) => handleDragStart(e, task, 'actual', 'actual_end_date')}
                          />
                        </>
                      )}
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
