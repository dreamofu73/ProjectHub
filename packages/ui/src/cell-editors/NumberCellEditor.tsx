import React, { useEffect, useRef } from 'react';

interface NumberCellEditorProps {
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  onCancel: () => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberCellEditor({
  value,
  onChange,
  onCommit,
  onCancel,
  min = 0,
  max = 100,
  step = 5,
}: NumberCellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      e.stopPropagation();
      onCommit();
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      value={value}
      onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      step={step}
      className="w-full h-full px-2 py-1 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] border-none outline-none tabular-nums font-medium"
      style={{ minWidth: 50, maxWidth: 80 }}
    />
  );
}
