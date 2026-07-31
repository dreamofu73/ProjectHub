import type { HTMLEditorLabels } from './labels';

interface ColorSwatchesProps {
  colors: string[];
  onSelect: (color: string) => void;
  labels: HTMLEditorLabels;
  includeNone?: boolean;
}

/** 8열 색상 스와치 그리드 (글자색/배경색/셀 배경색/셀 테두리색 공용) */
export function ColorSwatches({ colors, onSelect, labels, includeNone = false }: ColorSwatchesProps) {
  return (
    <div className="absolute left-0 mt-1 p-1.5 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded shadow-lg z-30 grid grid-cols-8 gap-0.5 w-max" role="listbox" aria-label={labels.textColor}>
      {includeNone && (
        <button
          type="button"
          role="option"
          aria-label={labels.none}
          title={labels.none}
          className="w-4 h-4 border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
          style={{ backgroundColor: 'transparent', backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)', backgroundSize: '6px 6px', backgroundPosition: '0 0, 3px 3px' }}
          onClick={() => onSelect('')}
        />
      )}
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="option"
          aria-label={c}
          title={c}
          className="w-4 h-4 border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
          style={{ backgroundColor: c }}
          onClick={() => onSelect(c)}
        />
      ))}
    </div>
  );
}
