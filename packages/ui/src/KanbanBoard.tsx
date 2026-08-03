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

const TRACKER_STYLES: Record<string, string> = {
  bug: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  task: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
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
    low: { label: t('low') || '낮음', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
    normal: { label: t('normal') || '보통', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60' },
    high: { label: t('high') || '높음', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60' },
    urgent: { label: t('urgent') || '긴급', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60' },
    immediate: { label: t('immediate') || '즉시', color: 'text-white bg-rose-600 animate-pulse' },
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
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max p-1 h-full items-start">
          {columns.map(col => {
            const colItems = itemsByStatus[col.id] || [];
            const limit = wipLimits[col.id] ?? col.defaultWip ?? 0;
            const isExceeded = limit > 0 && colItems.length > limit;
            const isOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                className={`w-80 flex flex-col rounded-xl border transition-all duration-300 ${
                  isOver
                    ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20 shadow-lg scale-[1.01]'
                    : 'border-[var(--border)] bg-[var(--bg-surface-2)]/80'
                }`}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-[var(--border)]/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {col.color && (
                      <span className={`w-2.5 h-2.5 rounded-full ${col.color} shrink-0`} />
                    )}
                    <span className="font-bold text-sm text-[var(--text-primary)]">{col.label}</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      isExceeded
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)]'
                    }`}>
                      {colItems.length} {limit > 0 && `/ ${limit}`}
                    </span>
                  </div>

                  {!readOnly && onNewItemClick && (
                    <button
                      type="button"
                      onClick={() => onNewItemClick(col.id)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
                      title={t('create')}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* WIP Warning Banner */}
                {isExceeded && (
                  <div className="mx-3 mt-2 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('wipLimitExceeded') || 'WIP 제한 초과! 병목을 점검하세요.'}</span>
                  </div>
                )}

                {/* Column Items */}
                <div className="flex-1 p-3 space-y-2.5 overflow-y-auto min-h-[400px] max-h-[calc(100vh-280px)]">
                  {colItems.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-[var(--border)] rounded-lg flex items-center justify-center text-xs text-[var(--text-muted)] font-medium">
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

                      return (
                        <div
                          key={id}
                          draggable={!readOnly}
                          onDragStart={e => handleDragStart(e, id)}
                          onClick={() => onItemClick?.(item)}
                          className={`p-3 border rounded-lg shadow-xs hover:shadow-md cursor-pointer transition-all duration-300 ${
                            isDragging
                              ? 'opacity-40 scale-95 border-[var(--primary)]'
                              : 'border-[var(--border)] hover:border-[var(--primary)]'
                          } bg-[var(--bg-surface)]`}
                        >
                          {/* Header Badges */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-[var(--text-muted)]">
                              #{cardProps.id}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {cardProps.badgeText && (
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badgeClass}`}>
                                  {cardProps.badgeText}
                                </span>
                              )}
                              {prio && (
                                <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full ${prio.color}`}>
                                  {prio.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 mb-2">
                            {cardProps.title}
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
                          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1.5 border-t border-[var(--border)]/60">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {cardProps.assigneeName && (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] font-extrabold text-[10px] shrink-0">
                                    {cardProps.assigneeName[0]}
                                  </div>
                                  <span className="truncate text-[var(--text-secondary)]">{cardProps.assigneeName}</span>
                                </>
                              )}
                              {!cardProps.assigneeName && (
                                <span className="italic text-[var(--text-muted)]">{t('unassigned') || '담당자 미지정'}</span>
                              )}
                            </div>

                            {cardProps.subtitle && (
                              <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">{cardProps.subtitle}</span>
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
