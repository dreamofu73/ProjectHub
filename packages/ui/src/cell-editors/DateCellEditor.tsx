import React, { useEffect, useRef } from 'react';

interface DateCellEditorProps {
  startValue: string;
  endValue: string;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  validateOrder?: boolean;
  errorMessage?: string;
}

export function DateCellEditor({
  startValue,
  endValue,
  onChangeStart,
  onChangeEnd,
  onCommit,
  onCancel,
  validateOrder,
  errorMessage,
}: DateCellEditorProps) {
  const startRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startRef.current?.focus();
  }, []);

  const hasError = validateOrder && startValue && endValue && startValue > endValue;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // If focus is on end date, commit and leave
      if (document.activeElement === containerRef.current?.querySelector('[data-date-end]')) {
        e.stopPropagation();
        if (hasError) {
          e.preventDefault();
          return;
        }
        onCommit();
      }
      // else let Tab move from start to end date naturally
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (hasError) return;
      onCommit();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only commit when focus leaves the entire container
    const related = e.relatedTarget as Node | null;
    if (containerRef.current && related && containerRef.current.contains(related)) {
      return; // Focus moving between start/end inputs
    }
    if (!hasError) {
      onCommit();
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <input
        ref={startRef}
        type="date"
        value={startValue}
        onChange={(e) => onChangeStart(e.target.value)}
        className={`w-[7rem] px-1 py-0.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] border rounded outline-none font-medium ${
          hasError ? 'border-[var(--danger)]' : 'border-[var(--border)]'
        }`}
      />
      <span className="text-[var(--text-muted)] text-xs">~</span>
      <input
        data-date-end
        type="date"
        value={endValue}
        onChange={(e) => onChangeEnd(e.target.value)}
        className={`w-[7rem] px-1 py-0.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] border rounded outline-none font-medium ${
          hasError ? 'border-[var(--danger)]' : 'border-[var(--border)]'
        }`}
      />
      {hasError && errorMessage && (
        <span className="text-[10px] text-[var(--danger)] whitespace-nowrap">{errorMessage}</span>
      )}
    </div>
  );
}
