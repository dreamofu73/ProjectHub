import React, { useState, useMemo, useCallback } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { useLanguage } from 'shared/hooks/LanguageContext';

export interface KanbanColumnDef {
  id: string;
  label: string;
  color?: string;
  defaultWip?: number;
}

export interface KanbanCardData {
  id: string;
  title: string;
  badgeText?: string;
  badgeVariant?: 'bug' | 'feature' | 'task' | 'default' | string;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | 'immediate' | string;
  progress?: number;
  assigneeName?: string;
  subtitle?: string;
}

export interface KanbanBoardProps<T> {
  items: T[];
  columns: KanbanColumnDef[];
  getItemId: (item: T) => string;
  getItemStatus: (item: T) => string;
  getItemCardProps: (item: T) => KanbanCardData;
  renderCustomCard?: (item: T, isDragging: boolean) => React.ReactNode;
  onItemClick?: (item: T) => void;
  onStatusChange?: (itemId: string, newStatus: string) => void;
  onNewItemClick?: (columnId: string) => void;
  readOnly?: boolean;
  wipLimits?: Record<string, number>;
  emptyMessage?: string;
  className?: string;
}

export function getWorkflowStatusRank(status: string): number {
  const s = (status || '').trim().toLowerCase();
  if (s.includes('신규') || s.includes('new') || s.includes('open') || s.includes('backlog')) return 1;
  if (s.includes('진행') || s.includes('progress') || s.includes('working') || s.includes('doing')) return 2;
  if (s.includes('피드백') || s.includes('검토') || s.includes('feedback') || s.includes('review') || s.includes('testing') || s.includes('qa')) return 3;
  if (s.includes('해결') || s.includes('resolved') || s.includes('fixed')) return 4;
  if (s.includes('완료') || s.includes('종료') || s.includes('closed') || s.includes('done') || s.includes('completed')) return 5;
  if (s.includes('보류') || s.includes('거절') || s.includes('rejected') || s.includes('hold') || s.includes('cancelled')) return 6;
  return 99;
}

const TRACKER_STYLES: Record<string, string> = {
  bug: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  feature: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  task: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  support: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  default: 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)] border-[var(--border)]',
};

export function KanbanBoard<T>({
  items,
  columns,
  getItemId,
  getItemStatus,
  getItemCardProps,
  renderCustomCard,
  onItemClick,
  onStatusChange,
  onNewItemClick,
  readOnly = false,
  wipLimits = {},
  emptyMessage,
  className = '',
}: KanbanBoardProps<T>) {
  const { t } = useLanguage();
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const PRIORITY_STYLES: Record<string, { label: string; color: string }> = useMemo(() => ({
    low: { label: t('low') || '낮음', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
    normal: { label: t('normal') || '보통', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/50' },
    high: { label: t('high') || '높음', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/50' },
    urgent: { label: t('urgent') || '긴급', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/50' },
    immediate: { label: t('immediate') || '즉시', color: 'text-white bg-rose-600 animate-pulse border-rose-700' },
  }), [t]);

  const resolvedEmptyMsg = emptyMessage || t('noItemsFound') || '등록된 항목이 없습니다.';

  const itemsByStatus = useMemo(() => {
    const map: Record<string, T[]> = {};
    columns.forEach(col => {
      map[col.id] = [];
    });

    items.forEach(item => {
      const status = getItemStatus(item) || '';
      const matchedCol = columns.find(c => c.id.toLowerCase() === status.toLowerCase());
      const colId = matchedCol ? matchedCol.id : columns[0]?.id;
      if (colId && map[colId]) {
        map[colId].push(item);
      } else {
        if (!map['other']) map['other'] = [];
        map['other'].push(item);
      }
    });

    return map;
  }, [items, columns, getItemStatus]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    if (readOnly) return;
    setDraggedItemId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, [readOnly]);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
    e.dataTransfer.dropEffect = 'move';
  }, [dragOverColumn]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData('text/plain') || draggedItemId;
    if (id && onStatusChange && !readOnly) {
      onStatusChange(id, columnId);
    }
    setDraggedItemId(null);
  }, [draggedItemId, onStatusChange, readOnly]);

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {/* Columns Area */}
      <div className="flex-1 overflow-hidden p-1">
        <div className="flex gap-3 w-full h-full items-stretch min-w-0">
          {columns.map(col => {
            const colItems = itemsByStatus[col.id] || [];
            const limit = wipLimits[col.id] ?? col.defaultWip ?? 0;
            const isExceeded = limit > 0 && colItems.length > limit;
            const isOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                className={`flex-1 min-w-0 flex flex-col h-full rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isOver
                    ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20 shadow-lg scale-[1.01] bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-[var(--border)] bg-[var(--bg-surface-2)]/40'
                }`}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column Header Bar Indicator */}
                {col.color && (
                  <div className={`h-1 w-full ${col.color} shrink-0`} />
                )}

                {/* Column Header */}
                <div className="p-3.5 border-b border-[var(--border)]/60 flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[var(--text-primary)] tracking-tight">{col.label}</span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      isExceeded
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        : 'bg-indigo-50 dark:bg-indigo-950/40 text-[var(--primary)] border border-indigo-100 dark:border-indigo-900/40 tabular-nums'
                    }`}>
                      {colItems.length} {limit > 0 && `/ ${limit}`}
                    </span>
                  </div>

                  {!readOnly && onNewItemClick && (
                    <button
                      type="button"
                      onClick={() => onNewItemClick(col.id)}
                      className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-all active:scale-95"
                      title={t('create')}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* WIP Warning Banner */}
                {isExceeded && (
                  <div className="mx-3 mt-2 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('wipLimitExceeded') || 'WIP 제한 초과! 병목을 점검하세요.'}</span>
                  </div>
                )}

                {/* Column Items */}
                <div className="flex-1 p-3 space-y-2.5 overflow-y-auto custom-scrollbar h-full">
                  {colItems.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-xs text-[var(--text-muted)] font-bold bg-[var(--bg-surface)]/30">
                      {resolvedEmptyMsg}
                    </div>
                  ) : (
                    colItems.map(item => {
                      const id = getItemId(item);
                      const isDragging = draggedItemId === id;

                      if (renderCustomCard) {
                        return (
                          <div
                            key={id}
                            draggable={!readOnly}
                            onDragStart={e => handleDragStart(e, id)}
                            onClick={() => onItemClick?.(item)}
                          >
                            {renderCustomCard(item, isDragging)}
                          </div>
                        );
                      }

                      const cardProps = getItemCardProps(item);
                      const prio = cardProps.priority ? PRIORITY_STYLES[cardProps.priority] : null;
                      const badgeClass = TRACKER_STYLES[cardProps.badgeVariant || 'default'] || TRACKER_STYLES.default;
                      const cleanTitle = (cardProps.title || '').replace(/^\[(SUPPORT|FEATURE|BUG|TASK)\]\s*/i, '');

                      return (
                        <div
                          key={id}
                          draggable={!readOnly}
                          onDragStart={e => handleDragStart(e, id)}
                          onClick={() => onItemClick?.(item)}
                          className={`p-3.5 border rounded-xl shadow-2xs hover:shadow-md cursor-pointer transition-all duration-200 ${
                            isDragging
                              ? 'opacity-40 scale-95 border-[var(--primary)] ring-2 ring-[var(--primary)]/20'
                              : 'border-[var(--border)] hover:border-[var(--primary)] active:scale-[0.98]'
                          } bg-[var(--bg-surface)]`}
                        >
                          {/* Header Badges */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-mono text-xs font-bold text-[var(--text-muted)] bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded tabular-nums">
                              #{cardProps.id}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {cardProps.badgeText && (
                                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border shadow-2xs ${badgeClass}`}>
                                  {cardProps.badgeText}
                                </span>
                              )}
                              {prio && (
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${prio.color}`}>
                                  {prio.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="text-xs sm:text-sm font-extrabold text-[var(--text-primary)] line-clamp-2 mb-2.5 leading-snug tracking-tight">
                            {cleanTitle}
                          </h4>

                          {/* Progress Bar (if provided) */}
                          {cardProps.progress !== undefined && (
                            <div className="w-full bg-[var(--bg-surface-2)] h-1.5 rounded-full overflow-hidden mb-2.5">
                              <div
                                className="h-full bg-[var(--primary)] transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, cardProps.progress))}%` }}
                              />
                            </div>
                          )}

                          {/* Card Footer */}
                          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]/60">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {cardProps.assigneeName && (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-[var(--primary)] font-extrabold text-[10px] shrink-0">
                                    {cardProps.assigneeName[0]}
                                  </div>
                                  <span className="truncate text-[var(--text-secondary)] font-semibold text-xs">{cardProps.assigneeName}</span>
                                </>
                              )}
                              {!cardProps.assigneeName && (
                                <span className="italic text-[var(--text-muted)] text-xs">{t('unassigned') || '담당자 미지정'}</span>
                              )}
                            </div>

                            {cardProps.subtitle && (
                              <span className="shrink-0 text-[11px] font-bold text-[var(--text-muted)] tabular-nums">{cardProps.subtitle}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
