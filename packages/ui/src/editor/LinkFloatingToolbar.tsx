import type { HTMLEditorLabels } from './labels';
import type { FloatingPos } from './useEditorSelectionState';

interface Props {
  href: string;
  position: FloatingPos;
  labels: HTMLEditorLabels;
  onEdit: () => void;
  onUnlink: () => void;
}

/** 커서가 링크 안에 있을 때 나타나는 편집/해제 플로팅 메뉴 */
export function LinkFloatingToolbar({ href, position, labels, onEdit, onUnlink }: Props) {
  return (
    <div
      className="absolute z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg ring-1 ring-black/5 dark:ring-white/10 select-none whitespace-nowrap"
      style={{ top: `${position.top}px`, left: `${position.left}px`, transform: 'translateX(-50%)' }}
    >
      <span className="max-w-[180px] truncate text-[11px] text-slate-500 dark:text-slate-400">{href}</span>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onEdit}
        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
        title={labels.editLink}
      >
        {labels.editLink}
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onUnlink}
        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
        title={labels.unlink}
      >
        {labels.unlink}
      </button>
    </div>
  );
}
