import React, { useEffect, useRef } from 'react';

interface TextCellEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  required?: boolean;
  placeholder?: string;
}

export function TextCellEditor({ value, onChange, onCommit, onCancel, required, placeholder }: TextCellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (required && !value.trim()) return;
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      e.stopPropagation();
      if (required && !value.trim()) {
        e.preventDefault();
        return;
      }
      onCommit();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (required && !value.trim()) {
          onCancel();
          return;
        }
        onCommit();
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className="w-full h-full px-2 py-1 text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] border-none outline-none font-medium"
      style={{ minWidth: 60 }}
    />
  );
}
