import React, { useEffect, useRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectCellEditorProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  /** If true, show an empty/unassigned option at the top */
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function SelectCellEditor({
  value,
  options,
  onChange,
  onCommit,
  onCancel,
  allowEmpty,
  emptyLabel = '-',
}: SelectCellEditorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
    // Select commits immediately on change
    setTimeout(() => onCommit(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      e.stopPropagation();
      onCommit();
    }
  };

  return (
    <select
      ref={selectRef}
      value={value}
      onChange={handleChange}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-1 py-1 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] border-none outline-none cursor-pointer font-medium"
      style={{ minWidth: 80 }}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
